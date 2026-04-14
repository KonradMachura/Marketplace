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

Routes are split into four blueprints:
- `routes/auth.py` — `/api/auth/{register,login,me}`
- `routes/offers.py` — `/api/offers`, `/api/categories`
- `routes/conversations.py` — `/api/conversations`, `/api/conversations/<id>/messages`, `/api/messages/<id>/respond`
- `routes/pages.py` — HTML page routes (`/`, `/register`, `/marketplace`)

**Instance path** is explicitly set to `backend/instance/` in the Flask constructor so `sqlite:///marketplace.db` always resolves to the correct file regardless of launch directory.

**Config** is loaded from `backend/.env` via an explicit `load_dotenv(os.path.join(__file_dir__, '.env'))` call — not CWD-relative — so the server can be started from any directory.

### Data model (`backend/models.py`)

```
User  ──(owns many)──>  Offer  ──(has many)──>  Conversation  ──(has many)──>  Message
                                                  (buyer_id FK)
```

- `Offer.photos` is a JSON-encoded `TEXT` column (list of URL strings), not a separate table.
- `Message.message_type` is either `'text'` or `'price_offer'`. Price negotiation is embedded in messages via `price_amount` + `price_status` (`pending` / `accepted` / `declined`).
- The `/api/conversations` endpoint merges conversations where the user is the buyer with conversations on offers the user owns (seller view), returning one unified sorted list.

### Frontend

No build step — plain vanilla JS loaded via `<script>` tags in `marketplace.html`. Modules share a single mutable global object defined in `state.js`:

```
state.js → api.js → utils.js → ui.js → offers.js → offerForm.js
        → filters.js → conversations.js → chat.js → main.js
```

**Load order matters.** Each file depends on symbols from files loaded before it. `main.js` runs last and bootstraps the app after verifying the JWT.

`api.js` exposes a single `api(path, options)` wrapper that attaches the JWT `Authorization` header to every request from `state.token`.

Chat is updated by polling `/api/conversations/<id>/messages` every 5 seconds (`state.chatPoll` holds the interval ID). There are no WebSockets.

### Static assets

- CSS: 10 files under `frontend/static/css/` — `base.css` sets CSS variables; the rest are feature-scoped.
- Uploaded offer photos go to `frontend/static/uploads/` (gitignored).
