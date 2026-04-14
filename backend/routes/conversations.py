from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Conversation, Message, Offer

conv_bp = Blueprint('conversations', __name__, url_prefix='/api')


# ── Conversations ─────────────────────────────────────────────────────────────

@conv_bp.route('/conversations', methods=['GET'])
@jwt_required()
def list_conversations():
    uid = int(get_jwt_identity())

    buyer_convs = db.session.execute(
        db.select(Conversation).where(Conversation.buyer_id == uid)
    ).scalars().all()

    seller_offer_ids = [
        o.id for o in db.session.execute(
            db.select(Offer).where(Offer.owner_id == uid)
        ).scalars().all()
    ]
    seller_convs = db.session.execute(
        db.select(Conversation).where(Conversation.offer_id.in_(seller_offer_ids))
    ).scalars().all() if seller_offer_ids else []

    merged = {c.id: c for c in list(buyer_convs) + list(seller_convs)}
    convs  = sorted(merged.values(), key=lambda c: c.created_at, reverse=True)
    return jsonify([c.to_dict(current_user_id=uid) for c in convs]), 200


@conv_bp.route('/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    uid  = int(get_jwt_identity())
    data = request.get_json() or {}
    oid  = data.get('offer_id')

    if not oid:
        return jsonify({'error': 'offer_id required.'}), 400

    offer = db.session.get(Offer, oid)
    if not offer:
        return jsonify({'error': 'Offer not found.'}), 404
    if offer.owner_id == uid:
        return jsonify({'error': 'Cannot message yourself.'}), 400

    existing = db.session.execute(
        db.select(Conversation).where(
            Conversation.offer_id == oid,
            Conversation.buyer_id == uid,
        )
    ).scalar_one_or_none()

    if existing:
        return jsonify(existing.to_dict(current_user_id=uid)), 200

    conv = Conversation(offer_id=oid, buyer_id=uid)
    db.session.add(conv)
    db.session.commit()
    return jsonify(conv.to_dict(current_user_id=uid)), 201


@conv_bp.route('/conversations/<int:cid>/messages', methods=['GET'])
@jwt_required()
def get_messages(cid):
    uid  = int(get_jwt_identity())
    conv = db.session.get(Conversation, cid)
    if not conv:
        return jsonify({'error': 'Not found.'}), 404
    if conv.buyer_id != uid and conv.offer.owner_id != uid:
        return jsonify({'error': 'Forbidden.'}), 403

    msgs = db.session.execute(
        db.select(Message)
        .where(Message.conversation_id == cid)
        .order_by(Message.created_at)
    ).scalars().all()

    return jsonify({
        'conversation': conv.to_dict(current_user_id=uid),
        'messages':     [m.to_dict() for m in msgs],
    }), 200


@conv_bp.route('/conversations/<int:cid>/messages', methods=['POST'])
@jwt_required()
def send_message(cid):
    uid  = int(get_jwt_identity())
    conv = db.session.get(Conversation, cid)
    if not conv:
        return jsonify({'error': 'Not found.'}), 404
    if conv.buyer_id != uid and conv.offer.owner_id != uid:
        return jsonify({'error': 'Forbidden.'}), 403

    data     = request.get_json() or {}
    mtype    = data.get('type', 'text')
    content  = (data.get('content') or '').strip()
    price_am =  data.get('price_amount')

    if mtype == 'text' and not content:
        return jsonify({'error': 'Message content required.'}), 400
    if mtype == 'price_offer' and (price_am is None or float(price_am) <= 0):
        return jsonify({'error': 'Valid price amount required.'}), 400

    msg = Message(
        conversation_id = cid,
        sender_id       = uid,
        content         = content if mtype == 'text' else '',
        message_type    = mtype,
        price_amount    = float(price_am) if mtype == 'price_offer' else None,
        price_status    = 'pending' if mtype == 'price_offer' else None,
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ── Messages ──────────────────────────────────────────────────────────────────

@conv_bp.route('/messages/<int:mid>/respond', methods=['PUT'])
@jwt_required()
def respond_price(mid):
    uid = int(get_jwt_identity())
    msg = db.session.get(Message, mid)
    if not msg:
        return jsonify({'error': 'Not found.'}), 404
    if msg.message_type != 'price_offer':
        return jsonify({'error': 'Not a price offer.'}), 400
    if msg.sender_id == uid:
        return jsonify({'error': 'Cannot respond to your own offer.'}), 400

    conv = msg.conversation
    if conv.buyer_id != uid and conv.offer.owner_id != uid:
        return jsonify({'error': 'Forbidden.'}), 403

    action = (request.get_json() or {}).get('action')
    if action not in ('accept', 'decline'):
        return jsonify({'error': 'action must be "accept" or "decline".'}), 400

    msg.price_status = 'accepted' if action == 'accept' else 'declined'
    db.session.commit()
    return jsonify(msg.to_dict()), 200
