from pathlib import Path
from datetime import datetime
from config import Config
from services.json_handler import JSONHandler

class BackupService:
    """Service for managing backups"""
    
    def __init__(self):
        self.backup_dir = Config.BACKUP_DIR
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.json_handler = JSONHandler()
    
    def list_backups(self, limit=50):
        """List available backups"""
        backups = self.json_handler.get_backups()
        return backups[:limit]
    
    def restore_backup(self, backup_name):
        """Restore from backup"""
        return self.json_handler.restore_backup(backup_name)
    
    def get_backup_info(self):
        """Get backup directory info"""
        backups = self.list_backups()
        total_size = sum(b['size'] for b in backups)
        
        return {
            'count': len(backups),
            'total_size': total_size,
            'directory': str(self.backup_dir)
        }

