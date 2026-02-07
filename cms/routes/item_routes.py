from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, make_response
from flask_login import login_required, current_user
from services.json_handler import JSONHandler
from services.validator import Validator
from services.file_handler import FileHandler
from models import db, ChangeLog
from datetime import datetime
from pathlib import Path

item_bp = Blueprint('item', __name__)

@item_bp.route('/')
@login_required
def list():
    """List all collectable items - always reads fresh from JSON file"""
    handler = JSONHandler()
    # Always read fresh data from file (no caching)
    data = handler.read()
    all_items = data.get('items', [])
    
    # Sort items by name for dropdown
    all_items = sorted(all_items, key=lambda x: x.get('name', '').lower())
    
    # Get selected item ID from query parameter
    selected_id = request.args.get('item_id', '')
    
    # If an item is selected, show only that one; otherwise show empty list
    if selected_id:
        items = [a for a in all_items if a.get('id') == selected_id]
        selected_item = items[0] if items else None
    else:
        items = []
        selected_item = None
    
    # Render template and create response object
    response = make_response(render_template('items/list.html', 
                         all_items=all_items, 
                         items=items, 
                         selected_item=selected_item,
                         selected_id=selected_id))
    
    # Add cache control headers to ensure fresh data
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

@item_bp.route('/edit/<item_id>', methods=['GET', 'POST'])
@login_required
def edit(item_id):
    """Edit collectable item"""
    handler = JSONHandler()
    data = handler.read()
    
    # Find item
    item = None
    for a in data['items']:
        if a['id'] == item_id:
            item = a
            break
    
    if not item:
        flash('Item not found', 'error')
        return redirect(url_for('item.list'))
    
    if request.method == 'POST':
        # Update item data from form
        item['name'] = request.form.get('name', '')
        item['scientificName'] = request.form.get('scientificName', '')
        item['description'] = request.form.get('description', '')
        # Badge description is entered in the Badge section; sync to top-level badgeDescription
        badge_desc = request.form.get('badge_description', '')
        item['badgeDescription'] = badge_desc
        
        # Location
        try:
            lat = float(request.form.get('lat', 0))
            lng = float(request.form.get('lng', 0))
            item['location'] = {'lat': lat, 'lng': lng}
            item['radiusMeters'] = int(request.form.get('radiusMeters', 10))
        except ValueError:
            flash('Invalid location coordinates', 'error')
            # Get available models, icons, and badges for dropdowns
            file_handler = FileHandler()
            available_models = file_handler.list_models_grouped()
            available_shadows = file_handler.list_assets('shadow')
            available_found = file_handler.list_assets('found')
            available_badges = file_handler.list_assets('badge')
            return render_template('items/edit.html', 
                                 item=item, 
                                 available_models=available_models,
                                 available_shadows=available_shadows,
                                 available_found=available_found,
                                 available_badges=available_badges)
        
        # Handle file uploads for assets
        file_handler = FileHandler()
        
        # Icons - handle file uploads or use existing paths
        icon_shadow_file = request.files.get('icon_shadow')
        icon_found_file = request.files.get('icon_found')
        
        icon_shadow_path = request.form.get('icon_shadow_path', '')
        icon_found_path = request.form.get('icon_found_path', '')
        
        if icon_shadow_file and icon_shadow_file.filename:
            try:
                # Generate filename based on item name
                item_name_safe = item.get('name', item_id).lower().replace(' ', '_')
                custom_name = f"{item_name_safe}_shadow{Path(icon_shadow_file.filename).suffix}"
                icon_shadow_path = file_handler.save_file(icon_shadow_file, 'shadow', custom_name)
            except Exception as e:
                flash(f'Error uploading shadow icon: {str(e)}', 'error')
        
        if icon_found_file and icon_found_file.filename:
            try:
                item_name_safe = item.get('name', item_id).lower().replace(' ', '_')
                custom_name = f"{item_name_safe}_found{Path(icon_found_file.filename).suffix}"
                icon_found_path = file_handler.save_file(icon_found_file, 'found', custom_name)
            except Exception as e:
                flash(f'Error uploading found icon: {str(e)}', 'error')
        
        item['icon'] = {
            'shadow': icon_shadow_path,
            'found': icon_found_path
        }
        
        # Model - use existing paths only (no file uploads from this form)
        # Users must upload 3D models via Asset Manager
        model_url_path = request.form.get('model_url_path', '')
        model_usdz_path = request.form.get('model_usdz_path', '')
        
        # Scale - convert single value to "x x x" format
        scale_value = request.form.get('model_scale', '1')
        try:
            scale_float = float(scale_value)
            scale_str = f"{scale_float} {scale_float} {scale_float}"
        except ValueError:
            scale_str = '1 1 1'
        
        item['model'] = {
            'url': model_url_path,
            'usdz': model_usdz_path,
            'scale': scale_str,
            'rotation': request.form.get('model_rotation', '0 0 0')
        }
        
        # Ping
        try:
            item['ping'] = {
                'cooldownMinutes': int(request.form.get('cooldownMinutes', 3))
            }
        except ValueError:
            item['ping'] = {'cooldownMinutes': 3}
        
        # Badge - handle file upload or use existing path
        badge_icon_file = request.files.get('badge_icon')
        badge_icon_path = request.form.get('badge_icon_path', '')
        
        if badge_icon_file and badge_icon_file.filename:
            try:
                item_name_safe = item.get('name', item_id).lower().replace(' ', '_')
                custom_name = f"{item_name_safe}_badge{Path(badge_icon_file.filename).suffix}"
                badge_icon_path = file_handler.save_file(badge_icon_file, 'badge', custom_name)
            except Exception as e:
                flash(f'Error uploading badge icon: {str(e)}', 'error')
        
        item['badge'] = {
            'id': request.form.get('badge_id', item_id),
            'name': request.form.get('badge_name', ''),
            'icon': badge_icon_path,
            'description': request.form.get('badge_description', ''),
            'gamePath': request.form.get('badge_gamePath', '')
        }
        
        # Validate
        errors = Validator.validate_item(item)
        if errors:
            flash('Validation errors: ' + ', '.join(errors), 'error')
            # Get available models, icons, and badges for dropdowns
            file_handler = FileHandler()
            available_models = file_handler.list_models_grouped()
            available_shadows = file_handler.list_assets('shadow')
            available_found = file_handler.list_assets('found')
            available_badges = file_handler.list_assets('badge')
            return render_template('items/edit.html', 
                                 item=item, 
                                 available_models=available_models,
                                 available_shadows=available_shadows,
                                 available_found=available_found,
                                 available_badges=available_badges)
        
        # Save
        try:
            handler.write(data)
            
            # Log change
            change = ChangeLog(
                user_id=current_user.id,
                action='update',
                entity_type='item',
                entity_id=item_id,
                changes=f"Updated item: {item['name']}"
            )
            db.session.add(change)
            db.session.commit()
            
            flash('Item updated successfully', 'success')
            return redirect(url_for('item.list'))
        except Exception as e:
            flash(f'Error saving item: {str(e)}', 'error')
    
    # Get available models, icons, and badges for dropdowns
    file_handler = FileHandler()
    available_models = file_handler.list_models_grouped()
    available_shadows = file_handler.list_assets('shadow')
    available_found = file_handler.list_assets('found')
    available_badges = file_handler.list_assets('badge')
    
    return render_template('items/edit.html', 
                         item=item, 
                         available_models=available_models,
                         available_shadows=available_shadows,
                         available_found=available_found,
                         available_badges=available_badges)

@item_bp.route('/create', methods=['GET', 'POST'])
@login_required
def create():
    """Create new collectable item"""
    if request.method == 'POST':
        handler = JSONHandler()
        data = handler.read()
        
        # Get form data
        item_id = request.form.get('id', '').strip()
        if not item_id:
            flash('Item ID is required', 'error')
            # Get available models, icons, and badges for dropdowns
            file_handler = FileHandler()
            available_models = file_handler.list_models_grouped()
            available_shadows = file_handler.list_assets('shadow')
            available_found = file_handler.list_assets('found')
            available_badges = file_handler.list_assets('badge')
            return render_template('items/edit.html', 
                                 item={}, 
                                 available_models=available_models,
                                 available_shadows=available_shadows,
                                 available_found=available_found,
                                 available_badges=available_badges)
        
        # Check for duplicate ID
        if any(a['id'] == item_id for a in data['items']):
            flash('Item ID already exists', 'error')
            # Get available models, icons, and badges for dropdowns
            file_handler = FileHandler()
            available_models = file_handler.list_models_grouped()
            available_shadows = file_handler.list_assets('shadow')
            available_found = file_handler.list_assets('found')
            available_badges = file_handler.list_assets('badge')
            return render_template('items/edit.html', 
                                 item={}, 
                                 available_models=available_models,
                                 available_shadows=available_shadows,
                                 available_found=available_found,
                                 available_badges=available_badges)
        
        # Resolve icon/badge paths: handle file uploads or use path fields (same as edit)
        file_handler = FileHandler()
        item_name = request.form.get('name', '').strip() or item_id
        item_name_safe = item_name.lower().replace(' ', '_')
        
        icon_shadow_path = request.form.get('icon_shadow_path', '')
        icon_found_path = request.form.get('icon_found_path', '')
        icon_shadow_file = request.files.get('icon_shadow')
        icon_found_file = request.files.get('icon_found')
        if icon_shadow_file and icon_shadow_file.filename:
            try:
                custom_name = f"{item_name_safe}_shadow{Path(icon_shadow_file.filename).suffix}"
                icon_shadow_path = file_handler.save_file(icon_shadow_file, 'shadow', custom_name)
            except Exception as e:
                flash(f'Error uploading shadow icon: {str(e)}', 'error')
        if icon_found_file and icon_found_file.filename:
            try:
                custom_name = f"{item_name_safe}_found{Path(icon_found_file.filename).suffix}"
                icon_found_path = file_handler.save_file(icon_found_file, 'found', custom_name)
            except Exception as e:
                flash(f'Error uploading found icon: {str(e)}', 'error')
        
        badge_icon_path = request.form.get('badge_icon_path', '')
        badge_icon_file = request.files.get('badge_icon')
        if badge_icon_file and badge_icon_file.filename:
            try:
                custom_name = f"{item_name_safe}_badge{Path(badge_icon_file.filename).suffix}"
                badge_icon_path = file_handler.save_file(badge_icon_file, 'badge', custom_name)
            except Exception as e:
                flash(f'Error uploading badge icon: {str(e)}', 'error')
        
        # Model scale: convert single value to "x x x" (same as edit)
        scale_value = request.form.get('model_scale', '1')
        try:
            scale_float = float(scale_value)
            scale_str = f"{scale_float} {scale_float} {scale_float}"
        except ValueError:
            scale_str = '1 1 1'
        
        # Create new item
        new_item = {
            'id': item_id,
            'name': item_name,
            'scientificName': request.form.get('scientificName', ''),
            'description': request.form.get('description', ''),
            'badgeDescription': request.form.get('badge_description', ''),
            'location': {
                'lat': float(request.form.get('lat', 51.442)),
                'lng': float(request.form.get('lng', -0.063))
            },
            'radiusMeters': int(request.form.get('radiusMeters', 10)),
            'icon': {
                'shadow': icon_shadow_path,
                'found': icon_found_path
            },
            'model': {
                'url': request.form.get('model_url_path', ''),
                'usdz': request.form.get('model_usdz_path', ''),
                'scale': scale_str,
                'rotation': request.form.get('model_rotation', '0 0 0')
            },
            'ping': {
                'cooldownMinutes': int(request.form.get('cooldownMinutes', 3))
            },
            'badge': {
                'id': request.form.get('badge_id', item_id),
                'name': request.form.get('badge_name', ''),
                'icon': badge_icon_path,
                'description': request.form.get('badge_description', ''),
                'gamePath': request.form.get('badge_gamePath', '')
            }
        }
        
        # Validate
        errors = Validator.validate_item(new_item)
        if errors:
            flash('Validation errors: ' + ', '.join(errors), 'error')
            # Get available models, icons, and badges for dropdowns
            file_handler = FileHandler()
            available_models = file_handler.list_models_grouped()
            available_shadows = file_handler.list_assets('shadow')
            available_found = file_handler.list_assets('found')
            available_badges = file_handler.list_assets('badge')
            return render_template('items/edit.html', 
                                 item=new_item, 
                                 available_models=available_models,
                                 available_shadows=available_shadows,
                                 available_found=available_found,
                                 available_badges=available_badges)
        
        # Add to data
        data['items'].append(new_item)
        
        # Save
        try:
            handler.write(data)
            
            # Log change
            change = ChangeLog(
                user_id=current_user.id,
                action='create',
                entity_type='item',
                entity_id=item_id,
                changes=f"Created item: {new_item['name']}"
            )
            db.session.add(change)
            db.session.commit()
            
            flash('Item created successfully', 'success')
            return redirect(url_for('item.list'))
        except Exception as e:
            flash(f'Error creating item: {str(e)}', 'error')
    
    # Get available models, icons, and badges for dropdowns
    file_handler = FileHandler()
    available_models = file_handler.list_models_grouped()
    available_shadows = file_handler.list_assets('shadow')
    available_found = file_handler.list_assets('found')
    available_badges = file_handler.list_assets('badge')
    
    # Pre-select model when redirected from upload (e.g. ?model=base_name)
    pre_selected_model = request.args.get('model', '')
    
    return render_template('items/edit.html', 
                         item={}, 
                         available_models=available_models,
                         available_shadows=available_shadows,
                         available_found=available_found,
                         available_badges=available_badges,
                         pre_selected_model=pre_selected_model)

@item_bp.route('/delete/<item_id>', methods=['POST'])
@login_required
def delete(item_id):
    """Delete collectable item"""
    handler = JSONHandler()
    data = handler.read()
    
    # Find and remove item
    item = None
    for i, a in enumerate(data['items']):
        if a['id'] == item_id:
            item = a
            data['items'].pop(i)
            break
    
    if not item:
        flash('Item not found', 'error')
        return redirect(url_for('item.list'))
    
    # Save
    try:
        handler.write(data)
        
        # Log change
        change = ChangeLog(
            user_id=current_user.id,
            action='delete',
            entity_type='item',
            entity_id=item_id,
            changes=f"Deleted item: {item['name']}"
        )
        db.session.add(change)
        db.session.commit()
        
        flash('Item deleted successfully', 'success')
    except Exception as e:
        flash(f'Error deleting item: {str(e)}', 'error')
    
    return redirect(url_for('item.list'))

@item_bp.route('/duplicate/<item_id>', methods=['POST'])
@login_required
def duplicate(item_id):
    """Duplicate collectable item"""
    handler = JSONHandler()
    data = handler.read()
    
    # Find item
    item = None
    for a in data['items']:
        if a['id'] == item_id:
            item = a.copy()
            break
    
    if not item:
        flash('Item not found', 'error')
        return redirect(url_for('item.list'))
    
    # Generate new ID
    base_id = item['id']
    counter = 1
    new_id = f"{base_id}-copy-{counter}"
    while any(a['id'] == new_id for a in data['items']):
        counter += 1
        new_id = f"{base_id}-copy-{counter}"
    
    item['id'] = new_id
    item['name'] = f"{item['name']} (Copy)"
    if item.get('badge'):
        item['badge']['id'] = new_id
        item['badge']['name'] = f"{item['badge'].get('name', '')} (Copy)"
    
    # Add to data
    data['items'].append(item)
    
    # Save
    try:
        handler.write(data)
        flash('Item duplicated successfully', 'success')
    except Exception as e:
        flash(f'Error duplicating item: {str(e)}', 'error')
    
    return redirect(url_for('item.list'))
