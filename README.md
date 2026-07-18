# EVOLVE AI - Digital Memory OS

> Your second brain that remembers conversations, files, emails, events, and relationships across your digital life.

## Project Status

EVOLVE AI is now a working full-stack Memory OS with a FastAPI backend, a Next.js frontend, Supabase-backed relational storage, local semantic retrieval, Google source syncing, and an interactive knowledge graph UI.

This README reflects the current implementation state of the repository: what is already done, how the system works, and what remains before production readiness.

## What Is Done

### Core product flows

- Ask page is implemented for chat-based retrieval and answer generation.
- Files flow supports uploads and document ingestion.
- Memory Graph page renders an interactive graph with search, filters, minimap, force layout, and related-memory exploration.
- Timeline page shows chronological activity and memory-related events.
- Sources page supports Google integrations plus uploaded content.
- Settings pages exist for profile, notifications, storage, language, email, password/security, and related account preferences.

### Backend architecture

- FastAPI application is wired through modular routers for chat, documents, memory graph, auth, sources, memories, timeline, dashboard, and settings.
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

- Repository user IDs were standardized to `default_user` to fix source-sync/session consistency issues.
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

### 3. Storage model

The system currently uses:

- Supabase PostgreSQL as the primary relational database,
- SQLite fallback for local-only development,
- local vector storage for retrieval,
- graph entities and relationships managed through the graph service layer.

### 4. Ingestion pipeline

When a file is uploaded or a source is synced:

1. content is parsed,
2. text is chunked,
3. chunks are embedded,
4. metadata is stored,
5. graph entities and relationships are created,
6. timeline events and related records are updated.

### 5. Retrieval flow

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

## What Remains

### High priority

- Multi-user authentication and proper per-user session isolation.
- Replace hardcoded `default_user` behavior with real account-scoped data ownership.
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

- Production auth and authorization model.
- Background workers/queues for long-running ingestion.
- Dockerized local and production deployment setup.
- CI/CD and deployment automation.
- Usage analytics, observability, and performance monitoring.
- Optional move to a dedicated graph database if graph scale exceeds the current service design.

## Suggested Next Build Order

1. Implement real auth and remove the single hardcoded user assumption.
2. Ship the daily summary backend flow.
3. Add background job/progress infrastructure for uploads and source sync.
4. Add targeted backend and integration tests.
5. Containerize and prepare deployment.

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
