"""
EVOLVE AI — Backend Server
FastAPI application with document processing and RAG pipeline.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from app.database import init_database
from app.routers import documents, chat, memory_graph, auth, sources, memories, timeline, dashboard, settings

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield

app = FastAPI(
    title="EVOLVE AI API",
    description="AI-powered Digital Memory Operating System — Backend API",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(dashboard.router)
app.include_router(settings.router)

# Serve uploaded profile pictures as static files
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


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
