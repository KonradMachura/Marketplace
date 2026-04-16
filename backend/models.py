from datetime import datetime
import json

from extensions import db


class User(db.Model):
    __tablename__ = 'user'

    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    city          = db.Column(db.String(100), default='')
    created_at    = db.Column(db.DateTime,    default=datetime.utcnow)

    offers = db.relationship(
        'Offer',
        backref=db.backref('owner', lazy=True),
        foreign_keys='Offer.owner_id',
        lazy=True,
    )

    def to_dict(self):
        return {
            'id':         self.id,
            'username':   self.username,
            'email':      self.email,
            'city':       self.city,
            'created_at': self.created_at.isoformat(),
        }


class Offer(db.Model):
    __tablename__ = 'offer'

    id          = db.Column(db.Integer,     primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    owner_id    = db.Column(db.Integer,     db.ForeignKey('user.id'), nullable=False)
    category    = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text,        default='')
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow)
    price       = db.Column(db.Float,       nullable=False)
    condition   = db.Column(db.String(50),  default='Good')
    status      = db.Column(db.String(50),  default='Active')
    city        = db.Column(db.String(100), default='')
    photos      = db.Column(db.Text,        default='[]')   # JSON list of URLs

    conversations = db.relationship(
        'Conversation',
        backref=db.backref('offer', lazy=True),
        lazy=True,
    )

    def to_dict(self):
        try:
            photo_list = json.loads(self.photos) if self.photos else []
        except (json.JSONDecodeError, TypeError):
            photo_list = []

        return {
            'id':          self.id,
            'title':       self.title,
            'owner_id':    self.owner_id,
            'owner':       self.owner.username if self.owner else 'Unknown',
            'category':    self.category,
            'description': self.description,
            'created_at':  self.created_at.isoformat(),
            'price':       self.price,
            'condition':   self.condition,
            'status':      self.status,
            'city':        self.city,
            'photos':      photo_list,
        }


class Conversation(db.Model):
    __tablename__ = 'conversation'

    id         = db.Column(db.Integer,  primary_key=True)
    offer_id   = db.Column(db.Integer,  db.ForeignKey('offer.id'),  nullable=False)
    buyer_id   = db.Column(db.Integer,  db.ForeignKey('user.id'),   nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    buyer    = db.relationship('User',    foreign_keys=[buyer_id])
    messages = db.relationship(
        'Message',
        backref=db.backref('conversation', lazy=True),
        lazy=True,
        order_by='Message.created_at',
    )

    def _other_user(self, current_user_id):
        if self.buyer_id == current_user_id:
            return self.offer.owner.username if self.offer and self.offer.owner else 'Unknown'
        return self.buyer.username if self.buyer else 'Unknown'

    def to_dict(self, current_user_id=None):
        last = (
            db.session.execute(
                db.select(Message)
                .where(Message.conversation_id == self.id)
                .order_by(Message.created_at.desc())
            ).scalars().first()
        )

        if last:
            preview = (
                f'Price offer: ${last.price_amount:.2f}'
                if last.message_type == 'price_offer'
                else ((last.content[:60] + '…') if len(last.content) > 60 else last.content)
            )
        else:
            preview = ''

        has_purchase = db.session.execute(
            db.select(Purchase).where(Purchase.conversation_id == self.id)
        ).scalar_one_or_none() is not None

        return {
            'id':           self.id,
            'offer_id':     self.offer_id,
            'offer_title':  self.offer.title if self.offer else 'Deleted offer',
            'buyer_id':     self.buyer_id,
            'other_user':   self._other_user(current_user_id) if current_user_id else None,
            'last_message': preview,
            'has_purchase': has_purchase,
            'created_at':   self.created_at.isoformat(),
        }


class Message(db.Model):
    __tablename__ = 'message'

    id              = db.Column(db.Integer,    primary_key=True)
    conversation_id = db.Column(db.Integer,    db.ForeignKey('conversation.id'), nullable=False)
    sender_id       = db.Column(db.Integer,    db.ForeignKey('user.id'),         nullable=False)
    content         = db.Column(db.Text,       default='')
    message_type    = db.Column(db.String(20), default='text')   # 'text' | 'price_offer'
    price_amount    = db.Column(db.Float,      nullable=True)
    price_status    = db.Column(db.String(20), nullable=True)    # pending | accepted | declined
    created_at      = db.Column(db.DateTime,   default=datetime.utcnow)

    sender = db.relationship('User', foreign_keys=[sender_id])

    def to_dict(self):
        return {
            'id':              self.id,
            'conversation_id': self.conversation_id,
            'sender_id':       self.sender_id,
            'sender_username': self.sender.username if self.sender else 'Unknown',
            'content':         self.content,
            'message_type':    self.message_type,
            'price_amount':    self.price_amount,
            'price_status':    self.price_status,
            'created_at':      self.created_at.isoformat(),
        }


class Purchase(db.Model):
    __tablename__ = 'purchase'

    id               = db.Column(db.Integer,     primary_key=True)
    conversation_id  = db.Column(db.Integer,     db.ForeignKey('conversation.id'), nullable=False)
    offer_id         = db.Column(db.Integer,     db.ForeignKey('offer.id'),        nullable=False)
    buyer_id         = db.Column(db.Integer,     db.ForeignKey('user.id'),         nullable=False)
    seller_id        = db.Column(db.Integer,     db.ForeignKey('user.id'),         nullable=False)
    price_paid       = db.Column(db.Float,       nullable=False)
    payment_method   = db.Column(db.String(50),  nullable=False)
    delivery_method  = db.Column(db.String(50),  nullable=False)
    delivery_address = db.Column(db.String(255), default='')
    notes            = db.Column(db.Text,        default='')
    status           = db.Column(db.String(50),  default='Completed')
    created_at       = db.Column(db.DateTime,    default=datetime.utcnow)

    buyer  = db.relationship('User', foreign_keys=[buyer_id])
    seller = db.relationship('User', foreign_keys=[seller_id])
    offer  = db.relationship('Offer')
    conv   = db.relationship('Conversation')

    def to_dict(self):
        return {
            'id':               self.id,
            'conversation_id':  self.conversation_id,
            'offer_id':         self.offer_id,
            'offer_title':      self.offer.title if self.offer else 'Deleted offer',
            'offer':            self.offer.to_dict() if self.offer else None,
            'buyer_id':         self.buyer_id,
            'seller_id':        self.seller_id,
            'seller_username':  self.seller.username if self.seller else 'Unknown',
            'price_paid':       self.price_paid,
            'payment_method':   self.payment_method,
            'delivery_method':  self.delivery_method,
            'delivery_address': self.delivery_address,
            'notes':            self.notes,
            'status':           self.status,
            'created_at':       self.created_at.isoformat(),
        }


class Complaint(db.Model):
    __tablename__ = 'complaint'

    id          = db.Column(db.Integer,    primary_key=True)
    purchase_id = db.Column(db.Integer,    db.ForeignKey('purchase.id'), nullable=False)
    user_id     = db.Column(db.Integer,    db.ForeignKey('user.id'),     nullable=False)
    type        = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text,       nullable=False)
    status      = db.Column(db.String(50), default='Open')
    created_at  = db.Column(db.DateTime,   default=datetime.utcnow)

    user     = db.relationship('User')
    purchase = db.relationship('Purchase')

    def to_dict(self):
        return {
            'id':          self.id,
            'purchase_id': self.purchase_id,
            'offer_title': self.purchase.offer.title if self.purchase and self.purchase.offer else 'Deleted offer',
            'user_id':     self.user_id,
            'type':        self.type,
            'description': self.description,
            'status':      self.status,
            'created_at':  self.created_at.isoformat(),
        }
