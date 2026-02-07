from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from models import db, User
from services.backup_service import BackupService
from services.change_logger import ChangeLogger
from functools import wraps

admin_bp = Blueprint('admin', __name__)

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.has_role('admin'):
            flash('Admin access required.', 'error')
            return redirect(url_for('auth.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/backups')
@login_required
def backups():
    """View backups"""
    service = BackupService()
    backups = service.list_backups()
    return render_template('admin/backups.html', backups=backups)

@admin_bp.route('/restore-backup', methods=['POST'])
@login_required
def restore_backup():
    """Restore from backup"""
    backup_name = request.form.get('backup_name')
    if not backup_name:
        flash('Backup name required', 'error')
        return redirect(url_for('admin.backups'))
    
    service = BackupService()
    try:
        service.restore_backup(backup_name)
        flash('Backup restored successfully', 'success')
    except Exception as e:
        flash(f'Error restoring backup: {str(e)}', 'error')
    
    return redirect(url_for('admin.backups'))

@admin_bp.route('/history')
@login_required
def history():
    """View change history"""
    logger = ChangeLogger()
    changes = logger.get_recent_changes(100)
    return render_template('admin/history.html', changes=changes)

@admin_bp.route('/users')
@admin_required
def users():
    """List all users"""
    all_users = User.query.order_by(User.username).all()
    return render_template('admin/users.html', users=all_users)

@admin_bp.route('/users/add', methods=['GET', 'POST'])
@admin_required
def add_user():
    """Add a new user"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        role = request.form.get('role', 'basic')
        is_active = request.form.get('is_active') == 'on'
        
        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('admin/user_form.html', user=None, roles=['basic', 'editor', 'admin'])
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return render_template('admin/user_form.html', user=None, roles=['basic', 'editor', 'admin'])
        
        if role not in ['basic', 'editor', 'admin']:
            flash('Invalid role selected.', 'error')
            return render_template('admin/user_form.html', user=None, roles=['basic', 'editor', 'admin'])
        
        new_user = User(username=username, role=role, is_active=is_active)
        new_user.set_password(password)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            flash(f'User "{username}" created successfully.', 'success')
            return redirect(url_for('admin.users'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error creating user: {str(e)}', 'error')
    
    return render_template('admin/user_form.html', user=None, roles=['basic', 'editor', 'admin'])

@admin_bp.route('/users/<int:user_id>/edit', methods=['GET', 'POST'])
@admin_required
def edit_user(user_id):
    """Edit an existing user"""
    user = User.query.get_or_404(user_id)
    
    # Prevent editing yourself to remove admin access
    if user.id == current_user.id and request.method == 'POST':
        new_role = request.form.get('role', 'basic')
        if new_role != 'admin':
            flash('You cannot remove admin access from your own account.', 'error')
            return render_template('admin/user_form.html', user=user, roles=['basic', 'editor', 'admin'])
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        role = request.form.get('role', 'basic')
        is_active = request.form.get('is_active') == 'on'
        
        if not username:
            flash('Username is required.', 'error')
            return render_template('admin/user_form.html', user=user, roles=['basic', 'editor', 'admin'])
        
        # Check if username is taken by another user
        existing_user = User.query.filter_by(username=username).first()
        if existing_user and existing_user.id != user.id:
            flash('Username already exists.', 'error')
            return render_template('admin/user_form.html', user=user, roles=['basic', 'editor', 'admin'])
        
        if role not in ['basic', 'editor', 'admin']:
            flash('Invalid role selected.', 'error')
            return render_template('admin/user_form.html', user=user, roles=['basic', 'editor', 'admin'])
        
        user.username = username
        user.role = role
        user.is_active = is_active
        
        # Only update password if provided
        if password:
            user.set_password(password)
        
        try:
            db.session.commit()
            flash(f'User "{username}" updated successfully.', 'success')
            return redirect(url_for('admin.users'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating user: {str(e)}', 'error')
    
    return render_template('admin/user_form.html', user=user, roles=['basic', 'editor', 'admin'])

@admin_bp.route('/users/<int:user_id>/delete', methods=['POST'])
@admin_required
def delete_user(user_id):
    """Delete a user"""
    user = User.query.get_or_404(user_id)
    
    # Prevent deleting yourself
    if user.id == current_user.id:
        flash('You cannot delete your own account.', 'error')
        return redirect(url_for('admin.users'))
    
    username = user.username
    try:
        db.session.delete(user)
        db.session.commit()
        flash(f'User "{username}" deleted successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting user: {str(e)}', 'error')
    
    return redirect(url_for('admin.users'))
