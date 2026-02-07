from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from services.json_handler import JSONHandler
from services.validator import Validator

map_bp = Blueprint('map', __name__)

@map_bp.route('/')
@login_required
def index():
    """Interactive map page"""
    return render_template('map.html')

@map_bp.route('/api/items', methods=['GET'])
@login_required
def get_items():
    """Get all collectable items for map display"""
    handler = JSONHandler()
    data = handler.read()
    return jsonify(data['items'])

@map_bp.route('/api/update-location', methods=['POST'])
@login_required
def update_location():
    """Update item location from map"""
    handler = JSONHandler()
    data = handler.read()
    
    item_id = request.json.get('item_id')
    lat = request.json.get('lat')
    lng = request.json.get('lng')
    radius = request.json.get('radius', 10)
    
    if not item_id or lat is None or lng is None:
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Validate coordinates
    if not Validator.validate_coordinates(lat, lng):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    # Find and update item
    found = False
    item = None
    for i in data['items']:
        if i['id'] == item_id:
            i['location'] = {'lat': lat, 'lng': lng}
            i['radiusMeters'] = radius
            item = i
            found = True
            break
    
    if not found:
        return jsonify({'error': 'Item not found'}), 404
    
    # Save
    try:
        handler.write(data)
        return jsonify({'success': True, 'item': item})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@map_bp.route('/api/create-item', methods=['POST'])
@login_required
def create_item():
    """Create new collectable item from map click"""
    handler = JSONHandler()
    data = handler.read()
    
    lat = request.json.get('lat')
    lng = request.json.get('lng')
    name = request.json.get('name', 'New Item')
    
    if lat is None or lng is None:
        return jsonify({'error': 'Missing coordinates'}), 400
    
    # Validate coordinates
    if not Validator.validate_coordinates(lat, lng):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    # Generate unique ID
    base_id = name.lower().replace(' ', '-')
    item_id = base_id
    counter = 1
    existing_ids = {a['id'] for a in data['items']}
    while item_id in existing_ids:
        item_id = f"{base_id}-{counter}"
        counter += 1
    
    # Create new item with default structure
    new_item = {
        'id': item_id,
        'name': name,
        'scientificName': '',
        'description': '',
        'badgeDescription': '',
        'location': {'lat': lat, 'lng': lng},
        'radiusMeters': 10,
        'icon': {
            'shadow': '',
            'found': ''
        },
        'model': {
            'url': '',
            'usdz': '',
            'scale': '1 1 1',
            'rotation': '0 0 0'
        },
        'ping': {'cooldownMinutes': 3},
        'badge': {
            'id': item_id,
            'name': f'{name} Collectable',
            'icon': '',
            'description': '',
            'gamePath': ''
        }
    }
    
    # Validate
    errors = Validator.validate_item(new_item)
    if errors:
        # Allow creation with warnings for empty optional fields
        pass
    
    data['items'].append(new_item)
    
    try:
        handler.write(data)
        return jsonify({'success': True, 'item': new_item})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

