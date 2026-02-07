from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_file
from flask_login import login_required, current_user
from services.file_handler import FileHandler
from services.json_handler import JSONHandler
from pathlib import Path
from config import Config
from functools import wraps

upload_bp = Blueprint('upload', __name__)

def editor_required(f):
    """Decorator to require editor or admin role"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        # Check if user has editor or admin role
        if current_user.role not in ['editor', 'admin']:
            flash('Editor or Admin access required to modify assets.', 'error')
            return redirect(url_for('upload.list'))
        return f(*args, **kwargs)
    return decorated_function

@upload_bp.route('/')
@login_required
def list():
    """List all assets"""
    handler = FileHandler()
    
    # Get assets by type - models are grouped by base name
    models = handler.list_models_grouped()
    shadows = handler.list_assets('shadow')
    found = handler.list_assets('found')
    badges = handler.list_assets('badge')
    
    return render_template('assets/list.html', 
                         models=models, shadows=shadows, found=found, badges=badges)

@upload_bp.route('/upload', methods=['GET', 'POST'])
@editor_required
def upload():
    """Upload new asset"""
    if request.method == 'POST':
        file_type = request.form.get('file_type')
        
        if not file_type:
            flash('File type not specified', 'error')
            return redirect(url_for('upload.upload'))
        
        handler = FileHandler()
        
        try:
            # Handle model package upload
            if file_type == 'model_package':
                if 'model_glb' not in request.files or 'model_usdz' not in request.files:
                    flash('Missing required model files', 'error')
                    return redirect(url_for('upload.upload'))
                
                glb_file = request.files['model_glb']
                usdz_file = request.files['model_usdz']
                shadow_icon = request.files.get('icon_shadow')
                found_icon = request.files.get('icon_found')
                base_name = request.form.get('base_name', '').strip()
                
                if glb_file.filename == '' or usdz_file.filename == '':
                    flash('GLB and USDZ files are required', 'error')
                    return redirect(url_for('upload.upload'))
                
                if not shadow_icon or shadow_icon.filename == '':
                    flash('Shadow icon is required', 'error')
                    return redirect(url_for('upload.upload'))
                
                if not found_icon or found_icon.filename == '':
                    flash('Found icon is required', 'error')
                    return redirect(url_for('upload.upload'))
                
                # Get base name from GLB if not provided
                if not base_name:
                    base_name = Path(glb_file.filename).stem
                
                # Save all files with matching base name
                saved_files = []
                
                # Save GLB model
                glb_name = f"{base_name}.glb"
                glb_path = handler.save_file(glb_file, 'model', glb_name)
                saved_files.append(f"GLB: {glb_path}")
                
                # Save USDZ model
                usdz_name = f"{base_name}.usdz"
                usdz_path = handler.save_file(usdz_file, 'model', usdz_name)
                saved_files.append(f"USDZ: {usdz_path}")
                
                # Save shadow icon
                shadow_ext = Path(shadow_icon.filename).suffix
                shadow_name = f"{base_name}_shadow{shadow_ext}"
                shadow_path = handler.save_file(shadow_icon, 'shadow', shadow_name)
                saved_files.append(f"Shadow icon: {shadow_path}")
                
                # Save found icon
                found_ext = Path(found_icon.filename).suffix
                found_name = f"{base_name}_found{found_ext}"
                found_path = handler.save_file(found_icon, 'found', found_name)
                saved_files.append(f"Found icon: {found_path}")
                
                flash(f'Model package uploaded successfully! Files: {", ".join(saved_files)}. Create an item to use this model.', 'success')
                return redirect(url_for('item.create', model=base_name))
            
            # Handle standard single file upload
            else:
                if 'file' not in request.files:
                    flash('No file selected', 'error')
                    return redirect(url_for('upload.upload'))
                
                file = request.files['file']
                custom_name = request.form.get('custom_name', '').strip()
                
                if file.filename == '':
                    flash('No file selected', 'error')
                    return redirect(url_for('upload.upload'))
                
                # Save file
                if custom_name:
                    # Ensure extension matches
                    ext = Path(file.filename).suffix
                    if not custom_name.endswith(ext):
                        custom_name = custom_name + ext
                    file_path = handler.save_file(file, file_type, custom_name)
                else:
                    file_path = handler.save_file(file, file_type)
                
                flash(f'File uploaded successfully: {file_path}', 'success')
                return redirect(url_for('upload.list'))
        except Exception as e:
            flash(f'Error uploading file: {str(e)}', 'error')
    
    return render_template('assets/upload.html')

@upload_bp.route('/delete', methods=['POST'])
@editor_required
def delete():
    """Delete asset - for models, deletes both GLB and USDZ"""
    file_path = request.form.get('file_path')
    
    if not file_path:
        flash('File path not provided', 'error')
        return redirect(url_for('upload.list'))
    
    handler = FileHandler()
    json_handler = JSONHandler()
    data = json_handler.read()
    
    # Determine if this is a model file
    is_model = 'model' in file_path or file_path.lower().endswith(('.glb', '.usdz'))
    
    if is_model:
        # For models, find the base name and delete both GLB and USDZ
        file_name = Path(file_path).name
        base_name = Path(file_name).stem
        ext = Path(file_name).suffix.lower()
        
        # Get the model directory
        models_dir = handler.get_upload_directory('model')
        glb_path = models_dir / f"{base_name}.glb"
        usdz_path = models_dir / f"{base_name}.usdz"
        
        # Check if files are used in JSON
        used_in = []
        for item in data.get('items', []):
            model_url = item.get('model', {}).get('url', '')
            model_usdz = item.get('model', {}).get('usdz', '')
            
            # Check if GLB is used
            if model_url and Path(model_url).stem == base_name:
                used_in.append(f"Item: {item.get('name')} (GLB model)")
            # Check if USDZ is used
            if model_usdz and Path(model_usdz).stem == base_name:
                used_in.append(f"Item: {item.get('name')} (USDZ model)")
        
        if used_in:
            flash(f'Model is in use and cannot be deleted. Used in: {", ".join(used_in)}', 'error')
            return redirect(url_for('upload.list'))
        
        # Delete both files
        deleted_files = []
        try:
            if glb_path.exists():
                relative_glb = glb_path.relative_to(Config.BASE_DIR)
                glb_relative_path = f"../../{relative_glb.as_posix()}"
                handler.delete_file(glb_relative_path)
                deleted_files.append('GLB')
            
            if usdz_path.exists():
                relative_usdz = usdz_path.relative_to(Config.BASE_DIR)
                usdz_relative_path = f"../../{relative_usdz.as_posix()}"
                handler.delete_file(usdz_relative_path)
                deleted_files.append('USDZ')
            
            if deleted_files:
                flash(f'Model deleted successfully ({", ".join(deleted_files)} files removed)', 'success')
            else:
                flash('No model files found to delete', 'warning')
        except Exception as e:
            flash(f'Error deleting model: {str(e)}', 'error')
    else:
        # For non-model files, check usage and delete normally
        used_in = []
        for item in data.get('items', []):
            if item.get('icon', {}).get('shadow') == file_path:
                used_in.append(f"Item: {item.get('name')} (shadow icon)")
            if item.get('icon', {}).get('found') == file_path:
                used_in.append(f"Item: {item.get('name')} (found icon)")
            if item.get('badge', {}).get('icon') == file_path:
                used_in.append(f"Item: {item.get('name')} (badge icon)")
        
        # Check game badges
        for badge in data.get('gameBadges', []):
            if badge.get('icon') == file_path:
                used_in.append(f"Game Badge: {badge.get('name')}")
        
        if used_in:
            flash(f'File is in use and cannot be deleted. Used in: {", ".join(used_in)}', 'error')
            return redirect(url_for('upload.list'))
        
        try:
            handler.delete_file(file_path)
            flash('File deleted successfully', 'success')
        except Exception as e:
            flash(f'Error deleting file: {str(e)}', 'error')
    
    return redirect(url_for('upload.list'))

@upload_bp.route('/replace', methods=['POST'])
@editor_required
def replace():
    """Replace existing asset - for models, requires both GLB and USDZ"""
    old_path = request.form.get('old_path')
    
    if not old_path:
        flash('Missing required information', 'error')
        return redirect(url_for('upload.list'))
    
    # Check if this is a model file
    is_model = 'model' in old_path or old_path.lower().endswith(('.glb', '.usdz'))
    
    if is_model:
        # For models, require both GLB and USDZ files
        if 'model_glb' not in request.files or 'model_usdz' not in request.files:
            flash('Both GLB and USDZ files are required to replace a model', 'error')
            return redirect(url_for('upload.list'))
        
        glb_file = request.files['model_glb']
        usdz_file = request.files['model_usdz']
        
        if glb_file.filename == '' or usdz_file.filename == '':
            flash('Both GLB and USDZ files are required', 'error')
            return redirect(url_for('upload.list'))
        
        # Get base name from old path
        old_filename = Path(old_path).name
        base_name = Path(old_filename).stem
        
        handler = FileHandler()
        json_handler = JSONHandler()
        
        try:
            # Save both files with same base name
            glb_name = f"{base_name}.glb"
            usdz_name = f"{base_name}.usdz"
            
            new_glb_path = handler.save_file(glb_file, 'model', glb_name)
            new_usdz_path = handler.save_file(usdz_file, 'model', usdz_name)
            
            # Update JSON if paths changed
            data = json_handler.read()
            updated = False
            
            for item in data.get('items', []):
                model_url = item.get('model', {}).get('url', '')
                model_usdz = item.get('model', {}).get('usdz', '')
                
                # Check if old GLB path matches
                if model_url and Path(model_url).stem == base_name:
                    item['model']['url'] = new_glb_path
                    updated = True
                
                # Check if old USDZ path matches
                if model_usdz and Path(model_usdz).stem == base_name:
                    item['model']['usdz'] = new_usdz_path
                    updated = True
            
            if updated:
                json_handler.write(data)
                flash('Model replaced and JSON updated', 'success')
            else:
                flash('Model replaced successfully', 'success')
            
            return redirect(url_for('upload.list'))
        except Exception as e:
            flash(f'Error replacing model: {str(e)}', 'error')
            return redirect(url_for('upload.list'))
    else:
        # For non-model files, handle normally
        if 'file' not in request.files:
            flash('No file selected', 'error')
            return redirect(url_for('upload.list'))
        
        file = request.files['file']
        
        if file.filename == '':
            flash('No file selected', 'error')
            return redirect(url_for('upload.list'))
        
        # Determine file type from old path
        if 'shadows' in old_path:
            file_type = 'shadow'
        elif 'found' in old_path:
            file_type = 'found'
        elif 'badges' in old_path:
            file_type = 'badge'
        else:
            flash('Could not determine file type', 'error')
            return redirect(url_for('upload.list'))
        
        handler = FileHandler()
        json_handler = JSONHandler()
        
        try:
            # Get filename from old path
            old_filename = Path(old_path).name
            
            # Save new file with same name (replaces old)
            new_path = handler.save_file(file, file_type, old_filename)
            
            # Update JSON if paths differ
            if new_path != old_path:
                data = json_handler.read()
                updated = False
                
                # Update in items
                for item in data.get('items', []):
                    if item.get('icon', {}).get('shadow') == old_path:
                        item['icon']['shadow'] = new_path
                        updated = True
                    if item.get('icon', {}).get('found') == old_path:
                        item['icon']['found'] = new_path
                        updated = True
                    if item.get('badge', {}).get('icon') == old_path:
                        item['badge']['icon'] = new_path
                        updated = True
                
                # Update in game badges
                for badge in data.get('gameBadges', []):
                    if badge.get('icon') == old_path:
                        badge['icon'] = new_path
                        updated = True
                
                if updated:
                    json_handler.write(data)
                    flash('File replaced and JSON updated', 'success')
                else:
                    flash('File replaced (not used in JSON)', 'success')
            else:
                flash('File replaced successfully', 'success')
            
            return redirect(url_for('upload.list'))
        except Exception as e:
            flash(f'Error replacing file: {str(e)}', 'error')
            return redirect(url_for('upload.list'))

