"""
EVOLVE AI — Backend Server
FastAPI application with document processing and RAG pipeline.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import documents, chat, memory_graph, auth, sources

app = FastAPI(
    title="EVOLVE AI API",
    description="AI-powered Digital Memory Operating System — Backend API",
    version="0.1.0",
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
