from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """User model for authentication"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='admin', nullable=False)  # basic, editor, admin
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def has_role(self, required_role):
        """Check if user has required role or higher"""
        role_hierarchy = {'basic': 1, 'editor': 2, 'admin': 3}
        user_level = role_hierarchy.get(self.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        return user_level >= required_level
    
    def can_delete(self):
        """Check if user can delete content (admin only)"""
        return self.has_role('admin')
    
    def can_edit(self):
        """Check if user can edit content (editor or admin)"""
        # Explicitly check for editor or admin role
        if not self.is_active:
            return False
        return self.role in ['editor', 'admin']
    
    def can_view(self):
        """Check if user can view content (all roles)"""
        return self.is_active
    
    def __repr__(self):
        return f'<User {self.username} ({self.role})>'

class ChangeLog(db.Model):
    """Change log for tracking modifications"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # create, update, delete
    entity_type = db.Column(db.String(50), nullable=False)  # item, badge, etc.
    entity_id = db.Column(db.String(100), nullable=True)
    changes = db.Column(db.Text, nullable=True)  # JSON string of changes
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('changes', lazy=True))
    
    def __repr__(self):
        return f'<ChangeLog {self.action} {self.entity_type} {self.entity_id}>'

