# EVOLVE AI - Digital Memory OS

> Your second brain that remembers conversations, files, emails, events, and relationships across your digital life.

## Project Status

EVOLVE AI is now a working full-stack Memory OS with a FastAPI backend, a Next.js frontend, Supabase-backed auth and relational storage, local semantic retrieval, Google source syncing, and an interactive knowledge graph UI.

This README reflects the current implementation state of the repository: what is already done, how the system works, and what remains before production readiness.

## What Is Done

### Core product flows

- Ask page is implemented for chat-based retrieval and answer generation.
- Supabase authentication flow is implemented with login, signup, forgot-password, reset-password, and Google OAuth entry points.
- Protected app routing redirects unauthenticated users to login and sends authenticated users into the dashboard.
- Dashboard/home experience has been split out from the public root route.
- Files flow supports uploads and document ingestion.
- Memory Graph page renders an interactive graph with search, filters, minimap, force layout, and related-memory exploration.
- Timeline page shows chronological activity and memory-related events.
- Sources page supports Google integrations plus uploaded content.
- Settings pages exist for profile, notifications, storage, language, email, password/security, and related account preferences.

### Backend architecture

- FastAPI application is wired through modular routers for chat, documents, memory graph, auth, sources, memories, timeline, dashboard, and settings.
- Authenticated backend routes verify Supabase bearer tokens and resolve the local `User` record with `get_current_user`.
- Main product routes now pass `current_user.id` into document, chat, graph, memory, timeline, dashboard, source, and settings operations.
- SQLAlchemy models and repositories are used for structured persistence instead of keeping everything in flat local files.
- Supabase PostgreSQL is the primary database target, with SQLite fallback for local development when `DATABASE_URL` is not provided.
- Database initialization runs automatically on backend startup.

### Memory and retrieval system

- Document chunks are embedded and used for retrieval-augmented generation.
- Chat history and extracted memories are persisted.
- Memory extraction can be toggled with environment configuration.
- Knowledge graph entities and edges are built from uploaded content and synced source data.
- Related memories and graph context are exposed back to the UI.

### Graph system

- **Semantic Edge Relationships:** The graph backend has been upgraded to expose real semantic relationships with custom edge models containing `relationship`, `confidence`, and `animated` properties directly from PostgreSQL's `graph_edges` table.
- **Auto-Layout Engine:** Replaced D3 force-directed physics with a stable hierarchical layout powered by [dagre](https://github.com/dagrejs/dagre). This ensures clean, deterministic placements and avoids overlapping edges or erratic movement.
- **Custom Animated Edge Render:** Custom animated purple dashed edges (`#A855F7`) render relationship labels centered as floating text (avoiding default white boxes) with opacity dynamically driven by edge `confidence` (solid for > 0.9, semi-transparent for 0.7-0.9, very transparent for < 0.5).
- **Selection & Search Highlighting:** Selecting any node highlights connected edges/neighbors and fades out unrelated elements. Searching a node centers the camera on it and highlights its paths.
- **Category Filters:** Sidebar filters strictly toggle matching categories (`Person`, `Project`, `Document`, `Email`, `Technology`, `Company`, `Skill`, `Meeting`, `Memory`), hiding unrelated nodes entirely from the canvas.
- **Metadata Integration:** Supporting document, email, meeting, and custom nodes are represented visually with full detail exploration in the sidebar.

### Source integrations

- Google OAuth flow is implemented for Gmail, Drive, and Calendar.
- Synced content is normalized and inserted into the same memory system as uploaded files.
- Uploaded documents are also represented in the graph and linked back to the central user node.

### Stability fixes already completed

- Supabase Auth has been wired into the frontend session provider, middleware, API client headers, and backend route dependencies.
- Local users are created or refreshed from Supabase JWTs, including profile metadata such as email, name, username, and avatar.
- Legacy repository defaults remain for compatibility, while primary request paths now pass authenticated user IDs explicitly.
- Heavy optional dependencies in the documents router were made lazy/optional so the backend can start even if OCR or Whisper-related packages are missing.
- Supabase environment handling was stabilized for the current setup.
- The project has been run locally and the major pages were verified to load.

## How It Works

### 1. Frontend

The frontend is a Next.js app that provides the user interface for:

- chat and memory retrieval,
- uploads and source sync control,
- graph visualization,
- timeline browsing,
- settings and profile management.

### 2. API layer

The backend is a FastAPI app that exposes REST endpoints for each product area:

- chat,
- documents,
- memory graph,
- auth,
- sources,
- timeline,
- dashboard,
- settings.

### 3. Auth flow

Supabase Auth owns identity and session issuance:

1. the frontend signs users in or up through Supabase,
2. the active Supabase session provides an access token,
3. the API client attaches that token as a bearer token,
4. FastAPI verifies the token with Supabase,
5. the backend creates or refreshes the local `User` row and scopes requests to that user.

### 4. Storage model

The system currently uses:

- Supabase PostgreSQL as the primary relational database,
- SQLite fallback for local-only development,
- local vector storage for retrieval,
- graph entities and relationships managed through the graph service layer.

### 5. Ingestion pipeline

When a file is uploaded or a source is synced:

1. content is parsed,
2. text is chunked,
3. chunks are embedded,
4. metadata is stored,
5. graph entities and relationships are created,
6. timeline events and related records are updated.

### 6. Retrieval flow

When the user asks a question:

1. relevant content is retrieved from stored memory/document context,
2. graph and memory context are assembled,
3. the LLM generates a grounded response,
4. the UI displays structured output and supporting source context.

## Current Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind CSS, Framer Motion, React Flow |
| Backend | FastAPI, SQLAlchemy |
| Database | Supabase PostgreSQL, SQLite fallback |
| Auth | Supabase Auth, bearer-token protected FastAPI routes |
| Retrieval | Local embeddings and vector retrieval |
| AI providers | OpenRouter, Gemini-compatible flows |
| Integrations | Gmail, Google Drive, Google Calendar |

## Run Locally

### Prerequisites

- Python 3.11+ or 3.12
- Node.js 18+
- npm
- A configured `backend/.env`

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:

- `http://localhost:8000`
- docs: `http://localhost:8000/docs`
- health: `http://localhost:8000/api/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- `http://localhost:3000`

If port 3000 is already occupied, Next.js may automatically move to `3001` or another free port.

### Required environment variables

At minimum, configure these in `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_service_or_secret_key
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324
SESSION_SECRET_KEY=your_session_secret
DATABASE_URL=your_supabase_transaction_pooler_url
DIRECT_URL=your_supabase_direct_session_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

The frontend Supabase publishable key is currently configured in `frontend/src/lib/supabase.ts` and `frontend/middleware.ts`. For deployment, move those values into environment variables before building.

## What Remains

### High priority

- Complete cleanup of legacy `default_user` compatibility paths in lower-level repositories and RAG helpers.
- Verify every ingestion, retrieval, deletion, and source-sync path with multiple real Supabase users.
- Persist and refresh Google credentials per authenticated user end to end.
- Implement a real backend-powered daily summary flow instead of static/mock behavior.
- Add stronger automated test coverage for core backend flows and source-sync regressions.
- Harden error handling and retries around third-party sync operations.

### Product expansion

- GitHub integration.
- WhatsApp/chat export ingestion.
- Better OCR and speech-to-text workflows for images and audio.
- Unified cross-source search across all connected platforms.
- Background job tracking and visible processing progress in the UI.

### Scale and production readiness

- Production authorization review, including route-level ownership checks and Supabase key handling.
- Background workers/queues for long-running ingestion.
- Dockerized local and production deployment setup.
- CI/CD and deployment automation.
- Usage analytics, observability, and performance monitoring.
- Optional move to a dedicated graph database if graph scale exceeds the current service design.

## Suggested Next Build Order

1. Remove remaining legacy `default_user` fallbacks and audit account isolation.
2. Persist Google OAuth credentials per Supabase user and verify Gmail, Drive, and Calendar sync after login.
3. Ship the daily summary backend flow.
4. Add background job/progress infrastructure for uploads and source sync.
5. Add targeted backend and integration tests.
6. Containerize and prepare deployment.

## Product Vision

EVOLVE AI is meant to unify scattered personal and project context into one searchable, explainable memory system.

Instead of searching across separate apps, users ask natural-language questions and get answers grounded in:

- chats,
- uploaded files,
- emails,
- calendar events,
- graph relationships,
- and stored memories.

The long-term goal is not just search. It is memory with context, structure, and recall.
