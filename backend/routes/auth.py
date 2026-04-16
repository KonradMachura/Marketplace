import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db
from models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email    = (data.get('email')    or '').strip().lower()
    password =  data.get('password') or ''
    city     = (data.get('city')     or '').strip()

    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password are required.'}), 400
    if not re.match(r'^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$', email):
        return jsonify({'error': 'Please enter a valid email address (e.g. you@example.com).'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400

    if db.session.execute(db.select(User).where(User.email == email)).scalar_one_or_none():
        return jsonify({'error': 'Email already registered.'}), 400
    if db.session.execute(db.select(User).where(User.username == username)).scalar_one_or_none():
        return jsonify({'error': 'Username already taken.'}), 400

    user = User(
        username      = username,
        email         = email,
        password_hash = generate_password_hash(password),
        city          = city,
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    email    = (data.get('email')    or '').strip().lower()
    password =  data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = db.session.execute(
        db.select(User).where(User.email == email)
    ).scalar_one_or_none()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    uid  = int(get_jwt_identity())
    user = db.session.get(User, uid)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    data     = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email    = (data.get('email')    or '').strip().lower()
    city     = (data.get('city')     or '').strip()

    if not username or not email:
        return jsonify({'error': 'Username and email are required.'}), 400
    if not re.match(r'^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$', email):
        return jsonify({'error': 'Please enter a valid email address (e.g. you@example.com).'}), 400

    # Uniqueness checks — skip own current values
    if email != user.email:
        if db.session.execute(db.select(User).where(User.email == email)).scalar_one_or_none():
            return jsonify({'error': 'Email already registered.'}), 400
    if username != user.username:
        if db.session.execute(db.select(User).where(User.username == username)).scalar_one_or_none():
            return jsonify({'error': 'Username already taken.'}), 400

    user.username = username
    user.email    = email
    user.city     = city
    db.session.commit()

    return jsonify(user.to_dict()), 200


@auth_bp.route('/password', methods=['PUT'])
@jwt_required()
def change_password():
    uid  = int(get_jwt_identity())
    user = db.session.get(User, uid)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    data             = request.get_json() or {}
    current_password = data.get('current_password') or ''
    new_password     = data.get('new_password')     or ''

    if not current_password or not new_password:
        return jsonify({'error': 'current_password and new_password are required.'}), 400
    if not check_password_hash(user.password_hash, current_password):
        return jsonify({'error': 'Current password is incorrect.'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters.'}), 400

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({'message': 'Password updated.'}), 200
