# 🧠 EVOLVE AI - Digital Memory Vault 

> **"Your Second Brain That Never Forgets."** 

--- 

# 📋 Current Status (What We've Done)

We've built the core foundational features of EVOLVE AI! Here's everything we've accomplished step by step:

---

# 🏗️ Step 1: Project Setup & Initial Configuration

## ✅ Backend Setup
- Created [backend/](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/) directory with Python 3.12
- Configured virtual environment ([backend/.venv/](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/.venv/))
- Set up [requirements.txt](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/requirements.txt) with all necessary dependencies
- Configured [.env](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/.env) for Gemini API key and environment variables

## ✅ Frontend Setup
- Created [frontend/](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/) directory with Next.js 15+
- Set up React + TypeScript + Tailwind CSS
- Configured [package.json](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/package.json) with dependencies
- Added Framer Motion for animations

## ✅ Gitignore Configuration
- Updated [.gitignore](file:///c:/Users/Lenovo/Desktop/MemoryOS/.gitignore) to ignore temporary files (venv, chroma_db, uploads, .next, etc.)

---

# 🔧 Step 2: Backend Core Development

## ✅ FastAPI Application
- [backend/app/main.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/main.py): Main FastAPI app with CORS middleware
  - Allowed origins for localhost ports 3000, 3001, and 3002
  - Registered all routers (documents, chat, memory graph)

## ✅ Document Processing Pipeline
- [backend/app/services/pdf_parser.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/services/pdf_parser.py): PDF file parsing using PyMuPDF
- [backend/app/services/chunker.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/services/chunker.py): Text chunking (splits large docs into 1000-token chunks)
- [backend/app/services/embeddings.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/services/embeddings.py): Embedding generation using sentence-transformers/all-MiniLM-L6-v2
- [backend/app/services/vector_store.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/services/vector_store.py): ChromaDB integration for vector storage and search

## ✅ RAG (Retrieval-Augmented Generation) Engine
- [backend/app/services/rag_engine.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/services/rag_engine.py): RAG implementation
  - **Fixed timeout issue**: Increased Gemini API timeout to 2 minutes (120 seconds)
  - Uses Google Gemini API for LLM responses
  - Combines retrieved context from vector store
  - Provides source citations and confidence scores

## ✅ Backend Routers
1. **[backend/app/routers/documents.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/routers/documents.py)**:
   - Upload PDF files
   - List all uploaded documents
   - Delete documents
2. **[backend/app/routers/chat.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/routers/chat.py)**:
   - Chat with your documents using RAG
3. **[backend/app/routers/memory_graph.py](file:///c:/Users/Lenovo/Desktop/MemoryOS/backend/app/routers/memory_graph.py)**:
   - Generate dynamic memory graph data
   - Connects user node with all uploaded documents

---

# 🎨 Step 3: Frontend UI Development

## ✅ Layout & Navigation
- [frontend/src/components/layout/AppLayout.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/components/layout/AppLayout.tsx): Main app layout with sidebar
- [frontend/src/components/layout/Sidebar.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/components/layout/Sidebar.tsx): Sidebar navigation with links to all pages

## ✅ Frontend Pages
1. **[frontend/src/app/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/page.tsx)**: Home/Dashboard page
2. **[frontend/src/app/ask/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/ask/page.tsx)**: AI Chat page (chat with your docs!)
3. **[frontend/src/app/sources/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/sources/page.tsx)**: Sources/Uploads page
4. **[frontend/src/app/memory-graph/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/memory-graph/page.tsx)**: Interactive memory graph visualization
5. **[frontend/src/app/timeline/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/timeline/page.tsx)**: Timeline page (placeholder for now)
6. **[frontend/src/app/files/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/files/page.tsx)**: Files page
7. **[frontend/src/app/daily-summary/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/daily-summary/page.tsx)**: Daily summary page
8. **[frontend/src/app/settings/page.tsx](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/app/settings/page.tsx)**: Settings page

## ✅ Frontend API Client
- [frontend/src/lib/api.ts](file:///c:/Users/Lenovo/Desktop/MemoryOS/frontend/src/lib/api.ts): API client to communicate with backend
  - **Fixed API calls**: Uses direct base URL `http://localhost:8000/api` instead of relative path

---

# 🛠️ Tech Stack We're Using

| Category | Technology |
|----------|------------|
| **Backend Framework** | FastAPI |
| **Backend Language** | Python 3.12 |
| **Frontend Framework** | Next.js 15+ |
| **Frontend Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **LLM** | Google Gemini (via google-generativeai) |
| **Embeddings** | sentence-transformers/all-MiniLM-L6-v2 |
| **Vector Database** | ChromaDB |
| **PDF Parsing** | PyMuPDF |
| **Git Remote** | https://github.com/pv-tech28/MemoryOS.git |

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

# Configure .env file with your Gemini API key
# Make sure backend/.env has:
# GEMINI_API_KEY=your_gemini_api_key_here

# Run the FastAPI backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend will be running at: http://localhost:8000

## Step 2: Set Up Frontend
```bash
# Open a new terminal, navigate to frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Run Next.js dev server
npm run dev
```
Frontend will be running at one of:
- http://localhost:3000
- http://localhost:3001
- http://localhost:3002

## Step 3: Use the App!
1. Go to http://localhost:3002/ask
2. Upload a PDF document (Sources page)
3. Ask questions about your document in the chat!
4. View your memory graph at http://localhost:3002/memory-graph

## Google Cloud Setup (for Gmail, Drive, Calendar Integrations)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project
2. Enable the following APIs:
   - Gmail API
   - Google Drive API
   - Google Calendar API
3. Go to **APIs & Services > Credentials** and create OAuth 2.0 Client IDs
4. Add the following authorized redirect URIs:
   - http://localhost:8000/api/auth/google/callback
5. Save your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
6. Add these to your `backend/.env` file:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   ```

---

# 📌 Remaining Tasks (What's Next)

Here's everything still left to implement to complete EVOLVE AI:

## Phase 1: Core Enhancements (High Priority)
- [ ] **Authentication System**: User login/signup (Google OAuth initially)
- [ ] **Proper Database**: Replace file-based metadata storage with PostgreSQL
- [ ] **Persistence**: Make sure data (uploads, vector DB) persists across server restarts properly
- [ ] **Timeline Page**: Implement actual timeline view of document uploads and events
- [ ] **Daily Summary Page**: Generate daily AI summaries of your activity

## Phase 2: Source Integrations (Medium Priority)
- [ ] **Gmail Integration**: Connect Gmail to import emails
- [ ] **Google Drive Integration**: Connect Drive to import files
- [ ] **Google Calendar Integration**: Connect Calendar to import events
- [ ] **GitHub Integration**: Connect GitHub to import commits and repos
- [ ] **WhatsApp Backup Import**: Import WhatsApp chat backups
- [ ] **Image Uploads + OCR**: Upload images and extract text with OCR
- [ ] **Audio Uploads + Speech Recognition**: Upload audio files and transcribe with Whisper

## Phase 3: Advanced Features (High Priority)
- [ ] **Full Knowledge Graph**: Build true knowledge graph with relationships (using Neo4j instead of simple node-edge)
- [ ] **Multi-source Search**: Search across all connected sources at once
- [ ] **Better UI/UX**: Improve design, add loading states, error messages
- [ ] **Proper Error Handling**: Handle API errors, timeout errors, file errors gracefully
- [ ] **Progress Bars**: Show upload/processing progress

## Phase 4: Production & Deployment (Low Priority)
- [ ] **Dockerize Application**: Create Docker containers for easy deployment
- [ ] **Deploy to Cloud**: Deploy backend (e.g., Vercel, AWS, GCP) and frontend (Vercel)
- [ ] **Production Vector DB**: Replace ChromaDB with Pinecone or Qdrant in production
- [ ] **Analytics Dashboard**: Add usage analytics and insights
- [ ] **Mobile Responsive**: Make sure app works perfectly on mobile devices

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
