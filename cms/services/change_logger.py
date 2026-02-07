from models import db, ChangeLog
from datetime import datetime

class ChangeLogger:
    """Service for logging changes"""
    
    @staticmethod
    def log_change(user_id, action, entity_type, entity_id, changes=None):
        """Log a change"""
        change = ChangeLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes or f"{action} {entity_type} {entity_id}"
        )
        db.session.add(change)
        db.session.commit()
        return change
    
    @staticmethod
    def get_recent_changes(limit=50):
        """Get recent changes"""
        return ChangeLog.query.order_by(ChangeLog.timestamp.desc()).limit(limit).all()
    
    @staticmethod
    def get_changes_for_entity(entity_type, entity_id, limit=20):
        """Get changes for a specific entity"""
        return ChangeLog.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(ChangeLog.timestamp.desc()).limit(limit).all()

