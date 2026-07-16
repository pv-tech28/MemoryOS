# 🧠 EVOLVE AI - Digital Memory Vault 

> **"Your Second Brain That Never Forgets."** 

--- 

# 📋 Current Status (What We've Done & How)

We've built out the core of MemoryOS (EVOLVE AI)! Below is a comprehensive list of what has been implemented, how it works, and what is remaining.

---

# 🏗️ Architectural Overview & Core Implementations

## 1. 🧠 Memory Intelligence Layer & RAG Pipeline
- **Orchestration Layer (`backend/app/services/memory_intelligence.py`)**: Intercepts requests between the user and the LLM. It aggregates data from three distinct sources (ChromaDB Vector Store, SQLite Long-Term Memory, and the NetworkX Knowledge Graph) to compile a rich, personalized prompt context.
- **RAG Engine (`backend/app/services/rag_engine.py`)**: 
  - Retrieves contextual semantic text chunks from the vector database.
  - Automatically queries Google Gemini (or OpenRouter as a fallback) with the customized intelligence prompt.
  - Parses confidence scores (`[CONFIDENCE: X.X]`) out of the model's text response and binds citations to the UI.
- **Unified Chat Router (`backend/app/routers/chat.py`)**: Manages chat sessions, saves conversation history using SQLite-backed structures, and triggers background memory extraction.

## 2. 🗄️ SQLite Long-Term Memory Vault
- **Memory Store (`backend/app/services/memory_store.py`)**: Persists structured user facts into an SQLite database (`memory_db.sqlite`).
- **Category Classification**: Classifies memories into categories: `personal`, `goal`, `project`, `preference`, `skill`, `deadline`, `task`, `education`, `career`, or `custom`.
- **Decay & Importance Scoring**: Tracks memory metrics like `importance` (0.0 to 1.0), `access_count`, and `last_accessed` timestamp. Importance gets updated and boosted dynamically when repeated topics are discussed.
- **Memory Extraction (`backend/app/services/memory_extractor.py`)**: Uses LLM prompts to analyze chat histories, auto-extract important facts, filter casual small talk, and save them as memories in the SQLite DB and update the NetworkX graph.

## 3. 🌐 Semantic Knowledge Graph (NetworkX)
- **Graph Builder (`backend/app/services/memory_graph_builder.py`)**: Manages a directed graph of entity nodes (types like `Person`, `Project`, `Technology`, `Skill`, `Email`, `Document`, `Event`, `Concept`) and semantic relationships (`works_at`, `mentions`, `belongs_to`, `attends`, `related_to`, etc.) in `knowledge_graph.json`.
- **Dynamic Entity Extraction**: Automatically extracts entities and relationships from newly uploaded files and conversations using the Gemini API.
- **Advanced Graph UI (`frontend/src/app/memory-graph/page.tsx`)**:
  - Employs a stunning, interactive force-directed graph visualizer using dynamic drag-and-drop.
  - Renders node sizes based on their dynamic importance and edge line thickness based on their relationship strength.
  - Provides a visual filter system and an interactive side-drawer component showing details, connections, and related memories for any selected node.

## 4. 🔌 External Integrations Sync & Google OAuth2
- **OAuth2 Authenticator (`backend/app/routers/auth.py`)**: Handles full authentication callbacks for Google services, saving offline credentials locally at `google_credentials.json`.
- **Third-Party Syncing (`backend/app/routers/sources.py`)**:
  - **Gmail Sync**: Pulls recent emails, parses subject/body details, embeds content, and writes nodes and relationship paths into the knowledge graph.
  - **Google Drive Sync**: Ingests files, parses PDFs via PyMuPDF (`pdf_parser.py`), chunks content (`chunker.py`), and embeds/stores them in the vector store.
  - **Google Calendar Sync**: Imports scheduled meetings/events, indexes description/metadata, and connects event entities.
- **Sources Control Panel (`frontend/src/app/sources/page.tsx`)**: Fully interactive page supporting manual drag-and-drop PDF uploads and individual triggers to sync Gmail, Google Drive, and Google Calendar.

## 5. 📅 Interactive Timeline Track
- **Timeline Engine (`backend/app/services/timeline_service.py`)**: Writes system events (e.g. chats, file uploads, memory creation, Gmail/Drive syncs) to a JSON events store (`timeline_events.json`).
- **Timeline Page (`frontend/src/app/timeline/page.tsx`)**: Renders a beautiful visual timeline, grouping events chronologically by day, applying type-specific color codes, and supporting timeline item deletion.

---

# 🛠️ Tech Stack We're Using

| Category | Technology | Description |
|----------|------------|-------------|
| **Backend Framework** | FastAPI | High-performance Python API framework |
| **Backend Database** | SQLite | Serverless SQL DB for memories & chats |
| **Vector Database** | ChromaDB | Local vector store for document embeddings |
| **Graph Abstraction** | NetworkX | Local graph library, persisted as JSON |
| **LLM Provider** | Google Gemini / OpenRouter | API endpoints for memory and answer generation |
| **Embeddings** | sentence-transformers | `all-MiniLM-L6-v2` for generating dense embeddings locally |
| **PDF Extraction** | PyMuPDF (fitz) | High-speed PDF text ingestion |
| **Frontend Framework**| Next.js 15+ | App router layout, React, TypeScript |
| **Styling** | Tailwind CSS | Utility-first styling with custom dark-mode vars |
| **Animations** | Framer Motion | Smooth component transitions and visual effects |
| **Git Remote** | https://github.com/pv-tech28/MemoryOS.git | Primary repo |

---

# 🚀 How to Run the Application

## Prerequisites
1. Python 3.12 installed
2. Node.js 18+ installed
3. Gemini API key (get from https://aistudio.google.com/apikey)

## Step 1: Set Up Backend
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Configure .env file with your Gemini API key and settings
# Make sure backend/.env has at least:
# GEMINI_API_KEY=your_gemini_api_key_here
# MEMORY_EXTRACTION_ENABLED=true

# Run the FastAPI backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend will be running at: http://localhost:8000

## Step 2: Set Up Frontend
```bash
# Open a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run Next.js dev server
npm run dev
```
Frontend will be running at: http://localhost:3000

## Step 3: Set Up Google Integrations (Gmail, Drive, Calendar)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Enable the **Gmail API**, **Google Drive API**, and **Google Calendar API**.
3. Create OAuth 2.0 Client Credentials with redirect URI:
   - `http://localhost:8000/api/auth/google/callback`
4. Add the generated keys into your `backend/.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   ```
5. Navigate to `http://localhost:3000/sources` on the frontend, click **Sync** on any Google integration to perform authentication.

---

# 📌 Remaining Tasks (What's Next)

Here's everything still left to implement to complete EVOLVE AI:

## Phase 1: Core Enhancements (High Priority)
- [ ] **Multi-User Authentication**: Proper signup/login security flow (JWT session-based) for frontend users.
- [ ] **PostgreSQL Database Integration**: Migrate from SQLite and `_metadata.json` to PostgreSQL to handle relational user records, document lists, and chat logs robustly.
- [ ] **Live Daily Summary Page**: Replace frontend static summary mocks (`daily-summary/page.tsx`) with an LLM-driven backend API that constructs structured daily highlights, activity stats, and AI memory insights from user actions.

## Phase 2: Source Integrations (Medium Priority)
- [ ] **GitHub Integration**: Connect to GitHub OAuth to index repository structures, commits, and pull requests.
- [ ] **WhatsApp Ingestion**: Support parsing of exported WhatsApp chat backup files to extract structured personal memories.
- [ ] **Image Uploads + OCR**: Integrate Tesseract OCR or Gemini Vision API to parse uploaded images.
- [ ] **Audio Uploads + Speech-to-Text**: Implement audio file transcription using Whisper API to ingest voice notes.

## Phase 3: Enterprise & Graph Scale (High Priority)
- [ ] **Neo4j Graph Database**: Replace NetworkX JSON storage with Neo4j to scale relationship indices, recursive path queries, and complex node graph operations.
- [ ] **Unified Multi-Source Search**: Support scanning and cross-referencing information across multiple platforms (Gmail, Drive, Calendar, local uploads) at once.
- [ ] **Upload Progress Bars**: Introduce real-time socket-based processing progress bars for document parsing and indexing.

## Phase 4: Production & Deployment (Low Priority)
- [ ] **Dockerization**: Containerize backend and frontend services using Docker Compose for streamlined development/production parity.
- [ ] **Cloud-native Vector DB**: Swap local ChromaDB with Pinecone or Qdrant in production setups.
- [ ] **Analytics Dashboard**: Add custom usage tracking, response times, and RAG accuracy analytics.

---

# 🚀 Vision (Original)

EVOLVE AI is an AI-powered Digital Memory Operating System that connects scattered information across multiple platforms into one intelligent memory. 

Instead of manually searching through emails, chats, PDFs, notes, GitHub repositories, calendars, photos, and recordings, users simply ask questions in natural language. 

EVOLVE AI understands context, relationships, and timelines—not just keywords. 

Think of it as your personal AI memory. 

--- 

# ❌ The Problem (Original)

Today's information is fragmented. 

Your digital life lives across dozens of applications. 

- Gmail 
- Google Drive 
- Google Calendar 
- WhatsApp 
- GitHub 
- Notion 
- OneNote 
- PDFs 
- Photos 
- Voice Recordings 
- Local Files 

The information isn't lost. 

It's disconnected. 

---

# 🎯 Goals (Original)

- Build an AI-powered Memory Operating System 
- Connect multiple digital platforms 
- Enable semantic search 
- Build relationships between data 
- Generate trustworthy answers 
- Provide complete references with every response 

---

# 💡 Example Questions (Original)

> When did we first discuss SilentGuard? 

> Who suggested adding AI to our project? 

> Show every document related to Hackathon. 

> Find all emails from Google regarding internships. 

> What tasks are still pending for EVOLVE AI? 

> Show the timeline of this startup. 

> What changed after our last meeting? 

---

# 🎯 Target Users (Original)

- Students 
- Researchers 
- Startup Founders 
- Developers 
- Teams 
- Professionals 
- Content Creators 

---

# ❤️ Why EVOLVE AI?

Search engines find files. 

EVOLVE AI remembers your life. 

It connects memories, understands context, builds relationships, and helps you retrieve information exactly when you need it. 

**Your Second Brain That Never Forgets.**
