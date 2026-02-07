import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
try:
    import filelock
except ImportError:
    # Fallback if filelock not available
    class filelock:
        class FileLock:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

from config import Config

# Use filelock if available, otherwise no-op
try:
    from filelock import FileLock
except ImportError:
    class FileLock:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

class JSONHandler:
    """Handles reading and writing to the assets JSON file (see Config.ASSETS_JSON) with backup and validation."""
    
    def __init__(self):
        self.json_path = Config.ASSETS_JSON
        self.backup_dir = Config.BACKUP_DIR
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.lock_file = self.json_path.parent / '.assets.json.lock'
    
    def read(self) -> Dict[str, Any]:
        """Read JSON file and return data"""
        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            # Return empty structure if file doesn't exist
            return {"items": [], "gameBadges": []}
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {self.json_path}: {e}")
    
    def write(self, data: Dict[str, Any], validate: bool = True) -> bool:
        """Write data to JSON file with backup and validation"""
        if validate:
            self._validate_structure(data)
        
        # Create backup before writing
        backup_path = self._create_backup()
        
        try:
            # Use file lock to prevent concurrent writes
            with FileLock(str(self.lock_file)):
                # Write to temporary file first
                temp_path = self.json_path.with_suffix('.json.tmp')
                with open(temp_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                # Validate the written file
                with open(temp_path, 'r', encoding='utf-8') as f:
                    json.load(f)  # Will raise if invalid
                
                # Replace original file
                temp_path.replace(self.json_path)
                return True
        except Exception as e:
            # Restore from backup on error
            if backup_path.exists():
                shutil.copy(backup_path, self.json_path)
            raise Exception(f"Failed to write JSON: {e}")
    
    def _create_backup(self) -> Path:
        """Create timestamped backup of current JSON file"""
        if not self.json_path.exists():
            return None
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = self.backup_dir / f'assets_{timestamp}.json'
        shutil.copy(self.json_path, backup_path)
        
        # Keep only last 50 backups
        backups = sorted(self.backup_dir.glob('assets_*.json'), reverse=True)
        for old_backup in backups[50:]:
            old_backup.unlink()
        
        return backup_path
    
    def _validate_structure(self, data: Dict[str, Any]) -> None:
        """Validate JSON structure"""
        if not isinstance(data, dict):
            raise ValueError("Root must be an object")
        
        if 'items' not in data:
            raise ValueError("Missing 'items' key")
        
        if 'gameBadges' not in data:
            raise ValueError("Missing 'gameBadges' key")
        
        if not isinstance(data['items'], list):
            raise ValueError("'items' must be a list")
        
        if not isinstance(data['gameBadges'], list):
            raise ValueError("'gameBadges' must be a list")
        
        # Validate each item
        item_ids = set()
        for i, item in enumerate(data['items']):
            if not isinstance(item, dict):
                raise ValueError(f"Item at index {i} must be an object")
            
            if 'id' not in item:
                raise ValueError(f"Item at index {i} missing 'id'")
            
            if item['id'] in item_ids:
                raise ValueError(f"Duplicate item ID: {item['id']}")
            item_ids.add(item['id'])
        
        # Validate each game badge
        badge_ids = set()
        for i, badge in enumerate(data['gameBadges']):
            if not isinstance(badge, dict):
                raise ValueError(f"Game badge at index {i} must be an object")
            
            if 'id' not in badge:
                raise ValueError(f"Game badge at index {i} missing 'id'")
            
            if badge['id'] in badge_ids:
                raise ValueError(f"Duplicate game badge ID: {badge['id']}")
            badge_ids.add(badge['id'])
    
    def get_backups(self) -> List[Dict[str, Any]]:
        """Get list of available backups"""
        backups = []
        for backup_file in sorted(self.backup_dir.glob('assets_*.json'), reverse=True):
            stat = backup_file.stat()
            backups.append({
                'path': backup_file,
                'name': backup_file.name,
                'size': stat.st_size,
                'created': datetime.fromtimestamp(stat.st_mtime)
            })
        return backups
    
    def restore_backup(self, backup_name: str) -> bool:
        """Restore from a backup"""
        backup_path = self.backup_dir / backup_name
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup {backup_name} not found")
        
        # Create backup of current before restoring
        self._create_backup()
        
        # Restore
        shutil.copy(backup_path, self.json_path)
        return True

