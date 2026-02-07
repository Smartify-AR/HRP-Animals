// Map Manager for Interactive Item Placement

let map;
let markers = {};
let circles = {};
let currentMarker = null;
let currentItem = null;
let items = [];
let selectedLat = null;
let selectedLng = null;

// Map bounds: adjust for your map image and coordinate system
const MAP_BOUNDS = {
    north: 51.444171827359355,
    south: 51.44035,
    east: -0.05601640222409181,
    west: -0.06662
};

// Calculate center point
const MAP_CENTER = [
    (MAP_BOUNDS.north + MAP_BOUNDS.south) / 2,
    (MAP_BOUNDS.east + MAP_BOUNDS.west) / 2
];

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadItems();
    setupEventListeners();
});

function initMap() {
    // Initialize Leaflet map (centre and bounds set below)
    // Centre of the map image
    // Disable attribution control to hide Leaflet logo
    map = L.map('map-container', {
        attributionControl: false
    }).setView(MAP_CENTER, 17);
    
    // Add custom map image as tile layer
    // Map image: replace with your map asset. Leaflet bounds: [[south, west], [north, east]]
    const mapBounds = [
        [MAP_BOUNDS.south, MAP_BOUNDS.west],
        [MAP_BOUNDS.north, MAP_BOUNDS.east]
    ];
    const mapImageUrl = '../../assets/map-placeholder.png';
    
    L.imageOverlay(mapImageUrl, mapBounds).addTo(map);
    
    // Add click handler for placing pins
    map.on('click', function(e) {
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;
        updateCoordinateDisplay();
        
        // Remove existing temporary marker
        if (currentMarker && !currentItem) {
            map.removeLayer(currentMarker);
        }
        
        // Add temporary marker
        currentMarker = L.marker([selectedLat, selectedLng], {
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        
        currentMarker.on('dragend', function() {
            selectedLat = currentMarker.getLatLng().lat;
            selectedLng = currentMarker.getLatLng().lng;
            updateCoordinateDisplay();
        });
        
        // Enable save buttons
        document.getElementById('save-location-btn').disabled = !currentItem;
        document.getElementById('create-item-btn').disabled = false;
    });
}

function loadItems() {
    fetch('/map/api/items')
        .then(response => response.json())
        .then(data => {
            items = data;
            populateItemSelect();
            addItemsToMap();
            updateItemsTable();
        })
        .catch(error => {
            console.error('Error loading items:', error);
            document.getElementById('items-table-body').innerHTML = 
                '<tr><td colspan="6" class="text-danger">Error loading items</td></tr>';
        });
}

function populateItemSelect() {
    const select = document.getElementById('item-select');
    select.innerHTML = '<option value="">-- Create New Item --</option>';
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.id})`;
        select.appendChild(option);
    });
}

function addItemsToMap() {
    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};
    
    // Clear existing circles
    Object.values(circles).forEach(circle => map.removeLayer(circle));
    circles = {};
    
    items.forEach(item => {
        if (item.location && item.location.lat && item.location.lng) {
            const marker = L.marker([item.location.lat, item.location.lng], {
                draggable: true,
                title: item.name
            }).addTo(map);
            
            // Add popup
            marker.bindPopup(`
                <strong>${item.name}</strong><br>
                ${item.scientificName || ''}<br>
                <small>ID: ${item.id}</small>
            `);
            
            // Add radius circle
            if (item.radiusMeters) {
                const circle = L.circle([item.location.lat, item.location.lng], {
                    radius: item.radiusMeters,
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.2
                }).addTo(map);
                circles[item.id] = circle;
            }
            
            // Handle drag end
            marker.on('dragend', function() {
                const newLat = marker.getLatLng().lat;
                const newLng = marker.getLatLng().lng;
                updateItemLocation(item.id, newLat, newLng);
            });
            
            markers[item.id] = marker;
        }
    });
}

function updateItemLocation(itemId, lat, lng) {
    const radius = parseInt(document.getElementById('radius-input').value) || 10;
    
    fetch('/map/api/update-location', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            item_id: itemId,
            lat: lat,
            lng: lng,
            radius: radius
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadItems();
            alert('Location updated successfully!');
        } else {
            alert('Error: ' + (data.error || 'Failed to update location'));
        }
    })
    .catch(error => {
        console.error('Error updating location:', error);
        alert('Error updating location');
    });
}

function updateCoordinateDisplay() {
    const display = document.getElementById('coordinate-display');
    if (selectedLat !== null && selectedLng !== null) {
        display.textContent = `Lat: ${selectedLat.toFixed(6)}, Lng: ${selectedLng.toFixed(6)}`;
    } else {
        display.textContent = 'Click on map to set coordinates';
    }
}

function setupEventListeners() {
    // Item select change
    document.getElementById('item-select').addEventListener('change', function(e) {
        const itemId = e.target.value;
        if (itemId) {
            currentItem = items.find(a => a.id === itemId);
            if (currentItem && currentItem.location) {
                selectedLat = currentItem.location.lat;
                selectedLng = currentItem.location.lng;
                map.setView([selectedLat, selectedLng], 17);
                
                // Remove temporary marker
                if (currentMarker && !currentItem) {
                    map.removeLayer(currentMarker);
                }
                
                if (markers[itemId]) {
                    map.setView(markers[itemId].getLatLng(), 17);
                }
            }
            document.getElementById('save-location-btn').disabled = false;
        } else {
            currentItem = null;
            document.getElementById('save-location-btn').disabled = true;
        }
    });
    
    // Save location button
    document.getElementById('save-location-btn').addEventListener('click', function() {
        if (currentItem && selectedLat !== null && selectedLng !== null) {
            updateItemLocation(currentItem.id, selectedLat, selectedLng);
        }
    });
    
    // Create new item button
    document.getElementById('create-item-btn').addEventListener('click', function() {
        if (selectedLat === null || selectedLng === null) {
            alert('Please click on the map to set coordinates first');
            return;
        }
        
        const name = prompt('Enter item name:');
        if (!name) return;
        
        const radius = parseInt(document.getElementById('radius-input').value) || 10;
        
        fetch('/map/api/create-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                lat: selectedLat,
                lng: selectedLng,
                radius: radius
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Item created successfully!');
                loadItems();
                document.getElementById('item-select').value = data.item.id;
                document.getElementById('item-select').dispatchEvent(new Event('change'));
            } else {
                alert('Error: ' + (data.error || 'Failed to create item'));
            }
        })
        .catch(error => {
            console.error('Error creating item:', error);
            alert('Error creating item');
        });
    });
    
    // Center map button
    document.getElementById('center-map-btn').addEventListener('click', function() {
        map.setView(MAP_CENTER, 17);
    });
}

function updateItemsTable() {
    const tbody = document.getElementById('items-table-body');
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const lat = item.location?.lat || 'N/A';
        const lng = item.location?.lng || 'N/A';
        const radius = item.radiusMeters || 10;
        
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${lat}</td>
                <td>${lng}</td>
                <td>${radius}m</td>
                <td>
                    <a href="/items/edit/${item.id}" class="btn btn-sm btn-primary">Edit</a>
                </td>
            </tr>
        `;
    }).join('');
}

