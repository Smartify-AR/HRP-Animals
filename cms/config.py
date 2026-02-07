import os
from pathlib import Path

class Config:
    """Application configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///cms.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Paths relative to project root
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / 'data'
    # Assets JSON path: schema is items + gameBadges. Change here to use a different filename or path.
    ASSETS_JSON = DATA_DIR / 'assets.json'
    ASSETS_DIR = BASE_DIR / 'assets'
    
    # Asset directories (icons: shadow/found images for collectable items)
    MODELS_DIR = ASSETS_DIR / 'wayfinding' / 'model'
    SHADOWS_DIR = ASSETS_DIR / 'icons' / 'shadows'
    FOUND_DIR = ASSETS_DIR / 'icons' / 'found'
    BADGES_DIR = ASSETS_DIR / 'badges' / 'icons'
    
    # Backup directory
    BACKUP_DIR = BASE_DIR / 'cms' / 'backups'
    
    # File upload settings
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    UPLOAD_EXTENSIONS = {
        'models': ['.glb', '.usdz'],
        'icons': ['.svg', '.png'],
        'badges': ['.svg', '.png']
    }
    
    # Session settings
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour
    _production = os.environ.get('FLASK_ENV') == 'production'
    SESSION_COOKIE_SECURE = _production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PREFERRED_URL_SCHEME = 'https' if _production else 'http'
    
    # Map settings
    MAP_CENTER_LAT = 51.442
    MAP_CENTER_LNG = -0.063
    MAP_DEFAULT_ZOOM = 17

