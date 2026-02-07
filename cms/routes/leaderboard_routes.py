from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required

leaderboard_bp = Blueprint('leaderboard', __name__)

@leaderboard_bp.route('/users')
@login_required
def users():
    """List leaderboard users"""
    # Note: This is a placeholder for future leaderboard backend integration
    # Currently, leaderboard data is stored in localStorage on the client side
    # This will need to be updated when the backend API is ready
    
    # For now, show a message about future integration
    return render_template('leaderboard/users.html', 
                         message="Leaderboard user management will be available when the backend API is integrated.")

@leaderboard_bp.route('/user/<user_id>')
@login_required
def user_detail(user_id):
    """View user details"""
    # Placeholder for future implementation
    return render_template('leaderboard/user_detail.html', 
                         user_id=user_id,
                         message="User details will be available when the backend API is integrated.")

@leaderboard_bp.route('/user/<user_id>/delete', methods=['POST'])
@login_required
def delete_user(user_id):
    """Delete user"""
    # Placeholder for future implementation
    flash('User deletion will be available when the backend API is integrated.', 'info')
    return redirect(url_for('leaderboard.users'))

@leaderboard_bp.route('/api/users', methods=['GET'])
@login_required
def api_users():
    """API endpoint for user list (placeholder)"""
    # This will connect to the leaderboard backend when ready
    return jsonify({
        'users': [],
        'message': 'Leaderboard API integration pending'
    })

