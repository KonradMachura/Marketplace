from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Complaint, Purchase

complaints_bp = Blueprint('complaints', __name__, url_prefix='/api')

VALID_TYPES = {'Complaint', 'Return'}


@complaints_bp.route('/complaints', methods=['GET'])
@jwt_required()
def list_complaints():
    uid = int(get_jwt_identity())
    complaints = db.session.execute(
        db.select(Complaint)
        .where(Complaint.user_id == uid)
        .order_by(Complaint.created_at.desc())
    ).scalars().all()
    return jsonify([c.to_dict() for c in complaints]), 200


@complaints_bp.route('/complaints', methods=['POST'])
@jwt_required()
def create_complaint():
    uid  = int(get_jwt_identity())
    data = request.get_json() or {}

    purchase_id = data.get('purchase_id')
    ctype       = (data.get('type') or '').strip()
    description = (data.get('description') or '').strip()

    if not purchase_id:
        return jsonify({'error': 'purchase_id is required.'}), 400

    purchase = db.session.get(Purchase, purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase not found.'}), 404
    if purchase.buyer_id != uid:
        return jsonify({'error': 'Access denied.'}), 403

    if ctype not in VALID_TYPES:
        return jsonify({'error': f'type must be one of: {", ".join(VALID_TYPES)}.'}), 400
    if len(description) < 10:
        return jsonify({'error': 'Description must be at least 10 characters.'}), 400

    complaint = Complaint(
        purchase_id = purchase_id,
        user_id     = uid,
        type        = ctype,
        description = description,
    )
    db.session.add(complaint)
    db.session.commit()

    return jsonify(complaint.to_dict()), 201
