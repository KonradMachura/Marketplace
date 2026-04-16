import os
import json
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import Offer
from utils import allowed_file, CATEGORIES

offers_bp = Blueprint('offers', __name__, url_prefix='/api')


# ── Categories ────────────────────────────────────────────────────────────────

@offers_bp.route('/categories', methods=['GET'])
def get_categories():
    return jsonify(CATEGORIES), 200


# ── Offers ────────────────────────────────────────────────────────────────────

@offers_bp.route('/offers', methods=['GET'])
def list_offers():
    q = db.select(Offer)

    search    = request.args.get('search',    '').strip()
    category  = request.args.get('category',  '').strip()
    condition = request.args.get('condition', '').strip()
    status    = request.args.get('status',    '').strip()
    city      = request.args.get('city',      '').strip()
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    if search:
        q = q.where(Offer.title.ilike(f'%{search}%') | Offer.description.ilike(f'%{search}%'))
    if category:
        q = q.where(Offer.category == category)
    if condition:
        q = q.where(Offer.condition == condition)
    if status:
        q = q.where(Offer.status == status)
    if city:
        q = q.where(Offer.city.ilike(f'%{city}%'))
    if min_price is not None:
        q = q.where(Offer.price >= min_price)
    if max_price is not None:
        q = q.where(Offer.price <= max_price)

    offers = db.session.execute(q.order_by(Offer.created_at.desc())).scalars().all()
    return jsonify([o.to_dict() for o in offers]), 200


@offers_bp.route('/offers', methods=['POST'])
@jwt_required()
def create_offer():
    uid      = int(get_jwt_identity())
    title    = (request.form.get('title')    or '').strip()
    category = (request.form.get('category') or '').strip()
    price    =  request.form.get('price')

    if not title or not category or not price:
        return jsonify({'error': 'Title, category and price are required.'}), 400

    photos = []
    for i, file in enumerate(request.files.getlist('photos')[:5]):
        if file and allowed_file(file.filename):
            ext      = file.filename.rsplit('.', 1)[1].lower()
            filename = secure_filename(f'{uid}_{int(datetime.utcnow().timestamp())}_{i}.{ext}')
            file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
            photos.append(f'/static/uploads/{filename}')

    raw_attrs = (request.form.get('attributes') or '{}').strip()
    try:
        attr_dict = json.loads(raw_attrs)
        attr_dict = {
            str(k).strip(): str(v).strip()
            for k, v in attr_dict.items()
            if str(k).strip() and str(v).strip()
        }
        if len(attr_dict) > 10:
            return jsonify({'error': 'Maximum 10 attributes allowed.'}), 400
        attributes = json.dumps(attr_dict)
    except (json.JSONDecodeError, ValueError):
        attributes = '{}'

    offer = Offer(
        title       = title,
        owner_id    = uid,
        category    = category,
        description = (request.form.get('description') or '').strip(),
        price       = float(price),
        condition   = request.form.get('condition', 'Good'),
        status      = request.form.get('status',    'Active'),
        city        = (request.form.get('city')     or '').strip(),
        photos      = json.dumps(photos),
        attributes  = attributes,
    )
    db.session.add(offer)
    db.session.commit()
    return jsonify(offer.to_dict()), 201


@offers_bp.route('/offers/<int:oid>', methods=['GET'])
def get_offer(oid):
    offer = db.session.get(Offer, oid)
    if not offer:
        return jsonify({'error': 'Not found.'}), 404
    return jsonify(offer.to_dict()), 200


@offers_bp.route('/offers/<int:oid>', methods=['DELETE'])
@jwt_required()
def delete_offer(oid):
    uid   = int(get_jwt_identity())
    offer = db.session.get(Offer, oid)
    if not offer:
        return jsonify({'error': 'Not found.'}), 404
    if offer.owner_id != uid:
        return jsonify({'error': 'Forbidden.'}), 403
    db.session.delete(offer)
    db.session.commit()
    return jsonify({'message': 'Deleted.'}), 200
