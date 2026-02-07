from flask import Flask, redirect, url_for, send_file
from flask_login import LoginManager, login_required
from werkzeug.middleware.proxy_fix import ProxyFix
from config import Config
from models import db, User
from pathlib import Path
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_app(config_class=Config):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_for=1)

    # Initialize extensions
    db.init_app(app)
    
    # Initialize Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.item_routes import item_bp
    from routes.badge_routes import badge_bp
    from routes.map_routes import map_bp
    from routes.upload_routes import upload_bp
    from routes.content_routes import content_bp
    from routes.leaderboard_routes import leaderboard_bp
    from routes.admin_routes import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(item_bp, url_prefix='/items')
    app.register_blueprint(badge_bp, url_prefix='/badges')
    app.register_blueprint(map_bp, url_prefix='/map')
    app.register_blueprint(upload_bp, url_prefix='/upload')
    app.register_blueprint(content_bp, url_prefix='/content')
    app.register_blueprint(leaderboard_bp, url_prefix='/leaderboard')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    
    # Root route
    @app.route('/')
    def index():
        from flask_login import current_user
        if current_user.is_authenticated:
            return redirect(url_for('auth.dashboard'))
        return redirect(url_for('auth.login'))
    
    # Serve assets from the project's assets directory
    @app.route('/assets/<path:filename>')
    @login_required
    def serve_asset(filename):
        """Serve assets from the project's assets directory"""
        asset_path = Config.ASSETS_DIR / filename
        if asset_path.exists() and asset_path.is_file():
            # Ensure the file is within the assets directory (security check)
            try:
                asset_path.resolve().relative_to(Config.ASSETS_DIR.resolve())
            except ValueError:
                # Path traversal attempt
                return {'error': 'Invalid path'}, 403
            
            # Determine MIME type based on extension
            mime_type = None
            if filename.lower().endswith('.glb'):
                mime_type = 'model/gltf-binary'
            elif filename.lower().endswith('.usdz'):
                mime_type = 'model/usd'
            elif filename.lower().endswith('.svg'):
                mime_type = 'image/svg+xml; charset=utf-8'
            elif filename.lower().endswith('.png'):
                mime_type = 'image/png'
            elif filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
                mime_type = 'image/jpeg'
            
            response = send_file(
                str(asset_path),
                mimetype=mime_type,
                as_attachment=False
            )
            
            # Add CORS headers for SVG files to allow embedding
            if filename.lower().endswith('.svg'):
                response.headers['Access-Control-Allow-Origin'] = '*'
            
            return response
        return {'error': 'File not found'}, 404
    
    # Create database tables
    with app.app_context():
        db.create_all()
        
        # Migration: Add role column if it doesn't exist (for existing databases)
        try:
            from sqlalchemy import text, inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('user')]
            
            if 'role' not in columns:
                # Column doesn't exist - add it
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE user ADD COLUMN role VARCHAR(20) DEFAULT 'admin'"))
                    conn.commit()
                    print("Migration: Added 'role' column to user table")
                    # Set all existing users to admin role
                    conn.execute(text("UPDATE user SET role = 'admin' WHERE role IS NULL OR role = ''"))
                    conn.commit()
                    print("Migration: Set all existing users to 'admin' role")
        except Exception as migration_error:
            # If migration fails, try to continue - might be a new database
            if 'no such table' not in str(migration_error).lower():
                print(f"Migration warning: {migration_error}")
                print("If you see errors, try deleting instance/cms.db and restarting")
        
        # Create default admin user if it doesn't exist
        try:
            if not User.query.filter_by(username='admin').first():
                admin = User(username='admin', role='admin')
                admin.set_password('admin')  # Change this in production!
                db.session.add(admin)
                db.session.commit()
                print("Default admin user created: username='admin', password='admin', role='admin'")
        except Exception as e:
            # If this fails, the database might need to be recreated
            print(f"Error: Could not check/create admin user. The database may need to be recreated.")
            print(f"Details: {e}")
            print("Solution: Delete the file 'instance/cms.db' and restart the application")
            raise
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return {'error': 'Internal server error'}, 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=5000)

