from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from services.json_handler import JSONHandler
from services.validator import Validator
from models import db, ChangeLog

badge_bp = Blueprint('badge', __name__)

@badge_bp.route('/')
@login_required
def list():
    """List all badges"""
    handler = JSONHandler()
    data = handler.read()
    
    items = data.get('items', [])
    game_badges = data.get('gameBadges', [])
    
    # Extract item badges (collectable badges linked to items)
    item_badges = []
    for item in items:
        if item.get('badge'):
            badge = item['badge'].copy()
            badge['_type'] = 'item'
            badge['_item_id'] = item['id']
            badge['_item_name'] = item['name']
            item_badges.append(badge)
    
    # Mark game badges
    for badge in game_badges:
        badge['_type'] = 'game'
    
    # Search filter
    search = request.args.get('search', '').lower()
    if search:
        item_badges = [b for b in item_badges if 
                        search in b.get('name', '').lower() or 
                        search in b.get('id', '').lower()]
        game_badges = [b for b in game_badges if 
                      search in b.get('name', '').lower() or 
                      search in b.get('id', '').lower()]
    
    return render_template('badges/list.html', 
                         item_badges=item_badges, 
                         game_badges=game_badges,
                         search=search)

@badge_bp.route('/edit-game/<badge_id>', methods=['GET', 'POST'])
@login_required
def edit_game(badge_id):
    """Edit game badge"""
    handler = JSONHandler()
    data = handler.read()
    
    # Find badge
    badge = None
    badge_index = None
    for i, b in enumerate(data['gameBadges']):
        if b['id'] == badge_id:
            badge = b
            badge_index = i
            break
    
    if not badge:
        flash('Badge not found', 'error')
        return redirect(url_for('badge.list'))
    
    if request.method == 'POST':
        # Update badge
        badge['name'] = request.form.get('name', '')
        badge['description'] = request.form.get('description', '')
        badge['icon'] = request.form.get('icon', '')
        badge['gamePath'] = request.form.get('gamePath', '')
        
        # Validate
        errors = Validator.validate_badge(badge)
        if errors:
            flash('Validation errors: ' + ', '.join(errors), 'error')
            return render_template('badges/edit.html', badge=badge, badge_type='game')
        
        # Save
        try:
            handler.write(data)
            
            # Log change
            change = ChangeLog(
                user_id=current_user.id,
                action='update',
                entity_type='game_badge',
                entity_id=badge_id,
                changes=f"Updated game badge: {badge['name']}"
            )
            db.session.add(change)
            db.session.commit()
            
            flash('Badge updated successfully', 'success')
            return redirect(url_for('badge.list'))
        except Exception as e:
            flash(f'Error saving badge: {str(e)}', 'error')
    
    return render_template('badges/edit.html', badge=badge, badge_type='game')

@badge_bp.route('/edit-item/<item_id>', methods=['GET', 'POST'])
@login_required
def edit_item(item_id):
    """Edit item badge (redirects to item edit)"""
    return redirect(url_for('item.edit', item_id=item_id))

@badge_bp.route('/create-game', methods=['GET', 'POST'])
@login_required
def create_game():
    """Create new game badge"""
    if request.method == 'POST':
        handler = JSONHandler()
        data = handler.read()
        
        badge_id = request.form.get('id', '').strip()
        if not badge_id:
            flash('Badge ID is required', 'error')
            return render_template('badges/edit.html', badge={}, badge_type='game')
        
        # Check for duplicate
        if any(b['id'] == badge_id for b in data['gameBadges']):
            flash('Badge ID already exists', 'error')
            return render_template('badges/edit.html', badge={}, badge_type='game')
        
        # Create new badge
        new_badge = {
            'id': badge_id,
            'name': request.form.get('name', ''),
            'description': request.form.get('description', ''),
            'icon': request.form.get('icon', ''),
            'gamePath': request.form.get('gamePath', '')
        }
        
        # Validate
        errors = Validator.validate_badge(new_badge)
        if errors:
            flash('Validation errors: ' + ', '.join(errors), 'error')
            return render_template('badges/edit.html', badge=new_badge, badge_type='game')
        
        # Add to data
        data['gameBadges'].append(new_badge)
        
        # Save
        try:
            handler.write(data)
            
            # Log change
            change = ChangeLog(
                user_id=current_user.id,
                action='create',
                entity_type='game_badge',
                entity_id=badge_id,
                changes=f"Created game badge: {new_badge['name']}"
            )
            db.session.add(change)
            db.session.commit()
            
            flash('Badge created successfully', 'success')
            return redirect(url_for('badge.list'))
        except Exception as e:
            flash(f'Error creating badge: {str(e)}', 'error')
    
    return render_template('badges/edit.html', badge={}, badge_type='game')

@badge_bp.route('/delete-game/<badge_id>', methods=['POST'])
@login_required
def delete_game(badge_id):
    """Delete game badge"""
    handler = JSONHandler()
    data = handler.read()
    
    # Find and remove badge
    badge = None
    for i, b in enumerate(data['gameBadges']):
        if b['id'] == badge_id:
            badge = b
            data['gameBadges'].pop(i)
            break
    
    if not badge:
        flash('Badge not found', 'error')
        return redirect(url_for('badge.list'))
    
    # Save
    try:
        handler.write(data)
        
        # Log change
        change = ChangeLog(
            user_id=current_user.id,
            action='delete',
            entity_type='game_badge',
            entity_id=badge_id,
            changes=f"Deleted game badge: {badge['name']}"
        )
        db.session.add(change)
        db.session.commit()
        
        flash('Badge deleted successfully', 'success')
    except Exception as e:
        flash(f'Error deleting badge: {str(e)}', 'error')
    
    return redirect(url_for('badge.list'))

