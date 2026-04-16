from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Conversation, Message, Purchase

purchases_bp = Blueprint('purchases', __name__, url_prefix='/api')

VALID_PAYMENT  = {'Bank Transfer', 'Cash', 'PayPal'}
VALID_DELIVERY = {'Shipping', 'In-Person Pickup'}


@purchases_bp.route('/purchases', methods=['POST'])
@jwt_required()
def create_purchase():
    uid  = int(get_jwt_identity())
    data = request.get_json() or {}

    conv_id         = data.get('conversation_id')
    payment_method  = (data.get('payment_method')  or '').strip()
    delivery_method = (data.get('delivery_method') or '').strip()
    delivery_address = (data.get('delivery_address') or '').strip()
    notes           = (data.get('notes') or '').strip()

    if not conv_id:
        return jsonify({'error': 'conversation_id is required.'}), 400

    conv = db.session.get(Conversation, conv_id)
    if not conv:
        return jsonify({'error': 'Conversation not found.'}), 404

    if conv.buyer_id != uid:
        return jsonify({'error': 'Only the buyer can finalize a purchase.'}), 403

    existing = db.session.execute(
        db.select(Purchase).where(Purchase.conversation_id == conv_id)
    ).scalar_one_or_none()
    if existing:
        return jsonify({'error': 'A purchase for this conversation already exists.'}), 409

    accepted_msg = db.session.execute(
        db.select(Message)
        .where(
            Message.conversation_id == conv_id,
            Message.message_type    == 'price_offer',
            Message.price_status    == 'accepted',
        )
        .order_by(Message.created_at.desc())
    ).scalars().first()
    if not accepted_msg:
        return jsonify({'error': 'No accepted price offer found in this conversation.'}), 400

    if payment_method not in VALID_PAYMENT:
        return jsonify({'error': f'payment_method must be one of: {", ".join(VALID_PAYMENT)}.'}), 400
    if delivery_method not in VALID_DELIVERY:
        return jsonify({'error': f'delivery_method must be one of: {", ".join(VALID_DELIVERY)}.'}), 400
    if delivery_method == 'Shipping' and not delivery_address:
        return jsonify({'error': 'delivery_address is required when delivery_method is Shipping.'}), 400

    purchase = Purchase(
        conversation_id  = conv_id,
        offer_id         = conv.offer_id,
        buyer_id         = uid,
        seller_id        = conv.offer.owner_id,
        price_paid       = accepted_msg.price_amount,
        payment_method   = payment_method,
        delivery_method  = delivery_method,
        delivery_address = delivery_address,
        notes            = notes,
    )
    db.session.add(purchase)
    db.session.commit()

    return jsonify(purchase.to_dict()), 201


@purchases_bp.route('/purchases', methods=['GET'])
@jwt_required()
def list_purchases():
    uid = int(get_jwt_identity())
    purchases = db.session.execute(
        db.select(Purchase)
        .where(Purchase.buyer_id == uid)
        .order_by(Purchase.created_at.desc())
    ).scalars().all()
    return jsonify([p.to_dict() for p in purchases]), 200


@purchases_bp.route('/purchases/<int:pid>', methods=['GET'])
@jwt_required()
def get_purchase(pid):
    uid = int(get_jwt_identity())
    purchase = db.session.get(Purchase, pid)
    if not purchase:
        return jsonify({'error': 'Purchase not found.'}), 404
    if purchase.buyer_id != uid:
        return jsonify({'error': 'Access denied.'}), 403
    return jsonify(purchase.to_dict()), 200
