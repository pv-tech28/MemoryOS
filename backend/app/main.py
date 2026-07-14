"""
EVOLVE AI — Backend Server
FastAPI application with document processing and RAG pipeline.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from app.routers import documents, chat, memory_graph, auth, sources, memories, timeline

load_dotenv()

# Debug 9: Verify latest .env key is loaded
print("[DEBUG] --- Backend Startup Debug ---")
api_key = os.getenv("GEMINI_API_KEY", "")
print(f"[DEBUG] GEMINI_API_KEY loaded (first 8 chars): '{api_key[:8]}...'")

app = FastAPI(
    title="EVOLVE AI API",
    description="AI-powered Digital Memory Operating System — Backend API",
    version="0.1.0",
)

# Session Middleware for OAuth state/code_verifier persistence
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "your-secret-key-change-in-production"),
    https_only=False,  # Set to True in production with HTTPS
    same_site="lax",
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Fallback port
        "http://127.0.0.1:3001",
        "http://localhost:3002",  # Our new frontend port
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(memory_graph.router)
app.include_router(auth.router)
app.include_router(sources.router)
app.include_router(memories.router)
app.include_router(timeline.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "EVOLVE AI Backend",
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "EVOLVE AI API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/health",
    }
