import os
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename
from config import Config
from PIL import Image

class FileHandler:
    """Handles file uploads and management"""
    
    def __init__(self):
        self.config = Config
    
    def get_upload_directory(self, file_type: str) -> Path:
        """Get upload directory based on file type"""
        if file_type == 'model':
            return self.config.MODELS_DIR
        elif file_type == 'shadow':
            return self.config.SHADOWS_DIR
        elif file_type == 'found':
            return self.config.FOUND_DIR
        elif file_type == 'badge':
            return self.config.BADGES_DIR
        else:
            raise ValueError(f"Unknown file type: {file_type}")
    
    def allowed_file(self, filename: str, file_type: str) -> bool:
        """Check if file extension is allowed"""
        if file_type == 'model':
            extensions = self.config.UPLOAD_EXTENSIONS['models']
        else:
            extensions = self.config.UPLOAD_EXTENSIONS['icons']
        
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in [ext.lstrip('.') for ext in extensions]
    
    def save_file(self, file, file_type: str, custom_name: str = None) -> str:
        """Save uploaded file and return relative path"""
        if not file or not file.filename:
            raise ValueError("No file provided")
        
        if not self.allowed_file(file.filename, file_type):
            raise ValueError(f"File type not allowed for {file_type}")
        
        # Get upload directory
        upload_dir = self.get_upload_directory(file_type)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        if custom_name:
            filename = secure_filename(custom_name)
        else:
            # Keep original name but make it safe
            original_name = secure_filename(file.filename)
            name, ext = os.path.splitext(original_name)
            # Add UUID to prevent conflicts
            filename = f"{name}_{uuid.uuid4().hex[:8]}{ext}"
        
        filepath = upload_dir / filename
        
        # Save file
        file.save(str(filepath))
        
        # Validate image if it's an icon (skip SVG files as PIL can't handle them)
        if file_type in ['shadow', 'found', 'badge']:
            # Check if it's an SVG file - skip PIL validation for SVGs
            is_svg = filename.lower().endswith('.svg')
            
            if not is_svg:
                # Only validate non-SVG images with PIL
                try:
                    img = Image.open(filepath)
                    img.verify()
                except Exception as e:
                    filepath.unlink()  # Delete invalid file
                    raise ValueError(f"Invalid image file: {e}")
            # SVG files are valid if they pass the extension check
        
        # Return relative path (from wayfinding pages perspective)
        relative_path = filepath.relative_to(self.config.BASE_DIR)
        return f"../../{relative_path.as_posix()}"
    
    def delete_file(self, file_path: str) -> bool:
        """Delete file by relative path"""
        try:
            # Convert relative path to absolute
            if file_path.startswith('../../'):
                relative = file_path[6:]  # Remove '../../'
                full_path = self.config.BASE_DIR / relative
            else:
                full_path = Path(file_path)
            
            if full_path.exists() and full_path.is_file():
                full_path.unlink()
                return True
            return False
        except Exception as e:
            raise Exception(f"Error deleting file: {e}")
    
    def file_exists(self, file_path: str) -> bool:
        """Check if file exists"""
        try:
            if file_path.startswith('../../'):
                relative = file_path[6:]
                full_path = self.config.BASE_DIR / relative
            else:
                full_path = Path(file_path)
            
            return full_path.exists() and full_path.is_file()
        except:
            return False
    
    def get_file_info(self, file_path: str) -> dict:
        """Get file information"""
        try:
            if file_path.startswith('../../'):
                relative = file_path[6:]
                full_path = self.config.BASE_DIR / relative
            else:
                full_path = Path(file_path)
            
            if not full_path.exists():
                return None
            
            stat = full_path.stat()
            return {
                'path': file_path,
                'name': full_path.name,
                'size': stat.st_size,
                'exists': True
            }
        except:
            return {'path': file_path, 'exists': False}
    
    def list_assets(self, file_type: str) -> list:
        """List all assets of a given type"""
        upload_dir = self.get_upload_directory(file_type)
        
        if not upload_dir.exists():
            return []
        
        assets = []
        for file_path in upload_dir.iterdir():
            if file_path.is_file():
                relative = file_path.relative_to(self.config.BASE_DIR)
                assets.append({
                    'name': file_path.name,
                    'path': f"../../{relative.as_posix()}",
                    'size': file_path.stat().st_size
                })
        
        return sorted(assets, key=lambda x: x['name'])
    
    def list_models_grouped(self) -> list:
        """List 3D models grouped by base name (GLB and USDZ together)"""
        upload_dir = self.get_upload_directory('model')
        
        if not upload_dir.exists():
            return []
        
        # Group files by base name
        model_groups = {}
        
        for file_path in upload_dir.iterdir():
            if file_path.is_file():
                name = file_path.name
                base_name = Path(name).stem
                ext = Path(name).suffix.lower()
                
                if ext not in ['.glb', '.usdz']:
                    continue
                
                if base_name not in model_groups:
                    model_groups[base_name] = {
                        'name': base_name,
                        'glb': None,
                        'usdz': None,
                        'glb_path': None,
                        'usdz_path': None,
                        'glb_size': 0,
                        'usdz_size': 0
                    }
                
                relative = file_path.relative_to(self.config.BASE_DIR)
                path = f"../../{relative.as_posix()}"
                size = file_path.stat().st_size
                
                if ext == '.glb':
                    model_groups[base_name]['glb'] = name
                    model_groups[base_name]['glb_path'] = path
                    model_groups[base_name]['glb_size'] = size
                elif ext == '.usdz':
                    model_groups[base_name]['usdz'] = name
                    model_groups[base_name]['usdz_path'] = path
                    model_groups[base_name]['usdz_size'] = size
        
        # Convert to list and filter to only include groups with at least GLB
        grouped_models = [
            group for group in model_groups.values()
            if group['glb'] is not None  # Only show models that have GLB
        ]
        
        return sorted(grouped_models, key=lambda x: x['name'])

