import os
from flask import Flask

from config import Config
from extensions import db, jwt
from routes.pages import pages_bp
from routes.auth import auth_bp
from routes.offers import offers_bp
from routes.conversations import conv_bp

# Absolute paths — works regardless of the working directory the app is launched from
_BACKEND_DIR  = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.normpath(os.path.join(_BACKEND_DIR, '..', 'frontend'))


def create_app(config_class=Config):
    app = Flask(
        __name__,
        template_folder=os.path.join(_FRONTEND_DIR, 'templates'),
        static_folder=os.path.join(_FRONTEND_DIR, 'static'),
    )
    app.config.from_object(config_class)

    # Override UPLOAD_FOLDER with the absolute path derived from the layout
    app.config['UPLOAD_FOLDER'] = os.path.join(_FRONTEND_DIR, 'static', 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialise extensions
    db.init_app(app)
    jwt.init_app(app)

    # Register blueprints
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(offers_bp)
    app.register_blueprint(conv_bp)

    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=Config.DEBUG, port=Config.PORT)
