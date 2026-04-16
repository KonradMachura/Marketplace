# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

All commands are run from the project root (`web_app/`).

```bash
# Install dependencies
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# Start the development server (runs DB migrations automatically on first boot)
.venv/Scripts/python.exe backend/app.py
```

App is served at `http://localhost:5000` (or `PORT` from `.env`).

**Environment:** copy `backend/.env.example` to `backend/.env` and fill in `SECRET_KEY` and `JWT_SECRET_KEY` before first run.

## Database migrations (Flask-Migrate / Alembic)

```bash
# After editing a model — generate a migration
FLASK_APP=backend/app.py .venv/Scripts/flask.exe db migrate -m "describe change"

# Apply pending migrations
FLASK_APP=backend/app.py .venv/Scripts/flask.exe db upgrade

# Check current revision
FLASK_APP=backend/app.py .venv/Scripts/flask.exe db current
```

Migration files live in `backend/migrations/versions/`. The `__main__` block in `app.py` calls `flask_migrate.upgrade()` on every server start — it is a no-op when already at head.

**Important:** `flask db migrate` compares models against the live database. If the DB already has all tables, autogenerate will detect no changes. To generate the initial migration for a fresh repo, run against an empty database: `DATABASE_URL="sqlite:///tmp.db" FLASK_APP=backend/app.py flask db migrate`.

## Architecture

### Backend

Flask app factory pattern (`backend/app.py → create_app()`). Extensions are singletons in `backend/extensions.py` (SQLAlchemy `db`, JWTManager `jwt`, Migrate `migrate`), initialised inside `create_app()`.

Routes are split into six blueprints:
- `routes/auth.py` — `/api/auth/{register, login, me, profile, password}`
- `routes/offers.py` — `/api/offers`, `/api/categories`
- `routes/conversations.py` — `/api/conversations`, `/api/conversations/<id>/messages`, `/api/messages/<id>/respond`
- `routes/purchases.py` — `/api/purchases`, `/api/purchases/<id>`
- `routes/complaints.py` — `/api/complaints`
- `routes/pages.py` — HTML page routes (`/`, `/register`, `/marketplace`, `/profile`)

**Instance path** is explicitly set to `backend/instance/` in the Flask constructor so `sqlite:///marketplace.db` always resolves to the correct file regardless of launch directory.

**Config** is loaded from `backend/.env` via an explicit `load_dotenv(os.path.join(__file_dir__, '.env'))` call — not CWD-relative — so the server can be started from any directory.

### Data model (`backend/models.py`)

```
User  ──(owns many)──>  Offer  ──(has many)──>  Conversation  ──(has many)──>  Message
                                                  (buyer_id FK)
                                                       │
                                                       └──(has one)──> Purchase ──(has many)──> Complaint
```

- `Offer.photos` is a JSON-encoded `TEXT` column (list of URL strings), not a separate table.
- `Message.message_type` is either `'text'` or `'price_offer'`. Price negotiation is embedded in messages via `price_amount` + `price_status` (`pending` / `accepted` / `declined`).
- The `/api/conversations` endpoint merges conversations where the user is the buyer with conversations on offers the user owns (seller view), returning one unified sorted list.
- `Conversation.to_dict()` includes a `has_purchase` boolean (live DB check) used by the frontend to hide the "Finalize Purchase" bar once a purchase exists.
- `Purchase` records a finalized transaction: links to the originating `Conversation`, stores `price_paid`, `payment_method`, `delivery_method`, `delivery_address`, `notes`. Created by the buyer after a price offer is accepted. One purchase per conversation (enforced with a 409 check).
- `Complaint` is filed against a `Purchase` by the buyer. Has `type` (`'Complaint'` / `'Return'`), `description`, and `status` (`'Open'` / `'In Progress'` / `'Resolved'`).

### API endpoints reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register (email regex validated, password ≥ 6 chars) |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET  | `/api/auth/me` | JWT | Current user |
| PUT  | `/api/auth/profile` | JWT | Update username / email / city |
| PUT  | `/api/auth/password` | JWT | Change password (requires current password) |
| GET  | `/api/offers` | — | List offers (search + filter query params) |
| POST | `/api/offers` | JWT | Create offer (multipart/form-data, up to 5 photos) |
| GET  | `/api/offers/<id>` | — | Single offer |
| DELETE | `/api/offers/<id>` | JWT | Delete offer (owner only) |
| GET  | `/api/categories` | — | Category list |
| GET  | `/api/conversations` | JWT | List conversations (buyer + seller merged) |
| POST | `/api/conversations` | JWT | Create or get existing conversation |
| GET  | `/api/conversations/<id>/messages` | JWT | Messages + conversation (includes `has_purchase`) |
| POST | `/api/conversations/<id>/messages` | JWT | Send message (`type`: `text` or `price_offer`) |
| PUT  | `/api/messages/<id>/respond` | JWT | Accept / decline a price offer |
| GET  | `/api/purchases` | JWT | List buyer's purchases |
| POST | `/api/purchases` | JWT | Finalize purchase from an accepted price offer |
| GET  | `/api/purchases/<id>` | JWT | Single purchase (buyer only) |
| GET  | `/api/complaints` | JWT | List user's complaints |
| POST | `/api/complaints` | JWT | File a complaint / return against a purchase |

### Frontend

No build step — plain vanilla JS loaded via `<script>` tags. Two distinct pages:

**`marketplace.html`** — main trading page. Script load order:
```
state.js → api.js → utils.js → ui.js → offers.js → offerForm.js
        → filters.js → conversations.js → chat.js → main.js
```

**`profile.html`** — standalone user profile page. Script load order:
```
state.js → api.js → utils.js → ui.js → profile.js
```

Both pages share `state.js` (global mutable `state` object), `api.js` (JWT-aware fetch wrapper), `utils.js` (formatting helpers), and `ui.js` (modal system, toast, profile dropdown toggle).

`api.js` exposes `api(method, path, body, isForm)` — attaches `Authorization: Bearer <token>` to every request from `state.token`.

Chat is updated by polling `/api/conversations/<id>/messages` every 5 seconds (`state.chatPoll` holds the interval ID). There are no WebSockets.

**Profile page tabs:**
- **Account** — edit username / email / city; change password. Both forms are independent with inline success/error banners.
- **Purchase History** — list view of purchases; click a row to open detail view showing full offer info, payment method, delivery info, notes.
- **Complaints & Returns** — list of filed complaints with status badges; "File a Complaint" button opens a modal linked to a past purchase.

**Finalize Purchase flow (in chat):**
When a conversation has an accepted price offer and no existing purchase, a green bar (`#finalize-bar`) appears above the message input for the buyer. Clicking opens the "Finalize Purchase" modal (payment method, delivery method, address, notes). On success the bar hides and the purchase appears in the Profile page.

### Static assets

- CSS: 11 files under `frontend/static/css/` — `base.css` sets CSS variables; the rest are feature-scoped. `profile.css` covers the profile page layout, tabs, purchase/complaint lists, and the finalize bar in chat.
- Uploaded offer photos go to `frontend/static/uploads/` (gitignored).
