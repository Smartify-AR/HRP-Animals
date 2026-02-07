from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required
from services.json_handler import JSONHandler

content_bp = Blueprint('content', __name__)

@content_bp.route('/bulk-edit')
@login_required
def bulk_edit():
    """Bulk content editor"""
    handler = JSONHandler()
    data = handler.read()
    
    return render_template('content/bulk_edit.html', data=data)

@content_bp.route('/update', methods=['POST'])
@login_required
def update():
    """Update content via AJAX"""
    handler = JSONHandler()
    data = handler.read()
    
    entity_type = request.json.get('type')  # 'item' or 'badge'
    entity_id = request.json.get('id')
    field = request.json.get('field')
    value = request.json.get('value')
    
    if not all([entity_type, entity_id, field, value is not None]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Find and update
    if entity_type == 'item':
        for item in data['items']:
            if item['id'] == entity_id:
                if field in item:
                    item[field] = value
                elif field == 'badge_description' and item.get('badge'):
                    item['badge']['description'] = value
                elif field == 'badge_name' and item.get('badge'):
                    item['badge']['name'] = value
                break
    elif entity_type == 'game_badge':
        for badge in data['gameBadges']:
            if badge['id'] == entity_id:
                if field in badge:
                    badge[field] = value
                break
    
    # Save
    try:
        handler.write(data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_bp.route('/find-replace', methods=['POST'])
@login_required
def find_replace():
    """Find and replace text across all content"""
    handler = JSONHandler()
    data = handler.read()
    
    find_text = request.form.get('find', '').strip()
    replace_text = request.form.get('replace', '').strip()
    scope = request.form.get('scope', 'all')  # all, items, badges
    
    if not find_text:
        flash('Find text is required', 'error')
        return redirect(url_for('content.bulk_edit'))
    
    changes = []
    
    if scope in ['all', 'items']:
        for item in data['items']:
            # Update description fields
            for field in ['name', 'scientificName', 'description', 'badgeDescription']:
                if field in item and find_text in str(item[field]):
                    item[field] = str(item[field]).replace(find_text, replace_text)
                    changes.append(f"Item {item['id']}: {field}")
            
            # Update badge fields
            if item.get('badge'):
                for field in ['name', 'description']:
                    if field in item['badge'] and find_text in str(item['badge'][field]):
                        item['badge'][field] = str(item['badge'][field]).replace(find_text, replace_text)
                        changes.append(f"Item {item['id']} badge: {field}")
    
    if scope in ['all', 'badges']:
        for badge in data['gameBadges']:
            for field in ['name', 'description']:
                if field in badge and find_text in str(badge[field]):
                    badge[field] = str(badge[field]).replace(find_text, replace_text)
                    changes.append(f"Game badge {badge['id']}: {field}")
    
    if changes:
        try:
            handler.write(data)
            flash(f'Replaced "{find_text}" with "{replace_text}" in {len(changes)} locations', 'success')
        except Exception as e:
            flash(f'Error saving changes: {str(e)}', 'error')
    else:
        flash('No matches found', 'info')
    
    return redirect(url_for('content.bulk_edit'))

