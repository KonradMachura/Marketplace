import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))


class Config:
    SECRET_KEY    = os.environ.get('SECRET_KEY', 'dev-secret')
    DEBUG         = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')
    PORT          = int(os.environ.get('PORT', 5000))

    SQLALCHEMY_DATABASE_URI      = os.environ.get('DATABASE_URL', 'sqlite:///marketplace.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY            = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(
        hours=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 24))
    )

    UPLOAD_FOLDER        = os.environ.get('UPLOAD_FOLDER', os.path.join('static', 'uploads'))
    MAX_CONTENT_LENGTH   = int(os.environ.get('MAX_CONTENT_LENGTH', 32 * 1024 * 1024))
