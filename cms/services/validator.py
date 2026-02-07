from pathlib import Path
from typing import Dict, Any, List, Optional
from config import Config
import re

class Validator:
    """Validates collectable item and badge data"""
    
    @staticmethod
    def validate_item(item: Dict[str, Any]) -> List[str]:
        """Validate collectable item data and return list of errors"""
        errors = []
        
        # Required fields
        required_fields = ['id', 'name', 'scientificName', 'description', 
                          'badgeDescription', 'location', 'radiusMeters', 
                          'icon', 'model', 'ping', 'badge']
        for field in required_fields:
            if field not in item:
                errors.append(f"Missing required field: {field}")
        
        if errors:
            return errors
        
        # Validate ID
        if not isinstance(item['id'], str) or not item['id']:
            errors.append("'id' must be a non-empty string")
        
        # Validate name
        if not isinstance(item['name'], str) or not item['name']:
            errors.append("'name' must be a non-empty string")
        
        # Validate location
        if not isinstance(item['location'], dict):
            errors.append("'location' must be an object")
        else:
            if 'lat' not in item['location'] or 'lng' not in item['location']:
                errors.append("'location' must have 'lat' and 'lng'")
            else:
                lat = item['location']['lat']
                lng = item['location']['lng']
                if not isinstance(lat, (int, float)) or not (-90 <= lat <= 90):
                    errors.append("'location.lat' must be between -90 and 90")
                if not isinstance(lng, (int, float)) or not (-180 <= lng <= 180):
                    errors.append("'location.lng' must be between -180 and 180")
        
        # Validate radiusMeters
        if not isinstance(item['radiusMeters'], (int, float)) or item['radiusMeters'] <= 0:
            errors.append("'radiusMeters' must be a positive number")
        
        # Validate icon
        if not isinstance(item['icon'], dict):
            errors.append("'icon' must be an object")
        else:
            if 'shadow' not in item['icon'] or 'found' not in item['icon']:
                errors.append("'icon' must have 'shadow' and 'found'")
            else:
                errors.extend(Validator._validate_asset_path(item['icon']['shadow'], 'icon.shadow'))
                errors.extend(Validator._validate_asset_path(item['icon']['found'], 'icon.found'))
        
        # Validate model
        if not isinstance(item['model'], dict):
            errors.append("'model' must be an object")
        else:
            if 'url' not in item['model']:
                errors.append("'model' must have 'url'")
            else:
                errors.extend(Validator._validate_asset_path(item['model']['url'], 'model.url'))
            
            if 'usdz' in item['model']:
                errors.extend(Validator._validate_asset_path(item['model']['usdz'], 'model.usdz'))
        
        # Validate badge
        if not isinstance(item['badge'], dict):
            errors.append("'badge' must be an object")
        else:
            if 'id' not in item['badge']:
                errors.append("'badge' must have 'id'")
            if 'name' not in item['badge']:
                errors.append("'badge' must have 'name'")
            if 'icon' in item['badge']:
                errors.extend(Validator._validate_asset_path(item['badge']['icon'], 'badge.icon'))
        
        return errors
    
    @staticmethod
    def validate_badge(badge: Dict[str, Any]) -> List[str]:
        """Validate game badge data and return list of errors"""
        errors = []
        
        # Required fields
        if 'id' not in badge:
            errors.append("Missing required field: id")
        if 'name' not in badge:
            errors.append("Missing required field: name")
        if 'description' not in badge:
            errors.append("Missing required field: description")
        
        if errors:
            return errors
        
        # Validate ID
        if not isinstance(badge['id'], str) or not badge['id']:
            errors.append("'id' must be a non-empty string")
        
        # Validate icon path if present
        if 'icon' in badge:
            errors.extend(Validator._validate_asset_path(badge['icon'], 'icon'))
        
        return errors
    
    @staticmethod
    def _validate_asset_path(path: str, field_name: str) -> List[str]:
        """Validate asset path exists"""
        errors = []
        
        if not isinstance(path, str):
            errors.append(f"'{field_name}' must be a string")
            return errors
        
        if not path:
            return errors  # Empty path is allowed (optional fields)
        
        # Check if path is relative (starts with ../)
        if not path.startswith('../../'):
            errors.append(f"'{field_name}' must be a relative path starting with '../../'")
            return errors
        
        # Resolve path relative to project root
        try:
            # Remove '../../' prefix and resolve
            relative_path = path[6:]  # Remove '../../'
            full_path = Config.BASE_DIR / relative_path
            
            if not full_path.exists():
                errors.append(f"'{field_name}' path does not exist: {path}")
        except Exception as e:
            errors.append(f"'{field_name}' invalid path: {e}")
        
        return errors
    
    @staticmethod
    def validate_coordinates(lat: float, lng: float) -> bool:
        """Validate coordinate ranges"""
        return -90 <= lat <= 90 and -180 <= lng <= 180
    
    @staticmethod
    def validate_scale(scale_str: str) -> bool:
        """Validate scale string format (e.g., '1 1 1')"""
        if not isinstance(scale_str, str):
            return False
        parts = scale_str.split()
        if len(parts) != 3:
            return False
        try:
            for part in parts:
                float(part)
            return True
        except ValueError:
            return False
    
    @staticmethod
    def validate_rotation(rotation_str: str) -> bool:
        """Validate rotation string format (e.g., '0 180 0')"""
        return Validator.validate_scale(rotation_str)  # Same format

