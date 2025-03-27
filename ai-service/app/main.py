from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import ai_tasks

app = FastAPI(
    title="Memoria AI Service",
    description="AI service for Memoria flashcard generation",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to Memoria AI Service"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

# Include API routers
app.include_router(ai_tasks.router, prefix="/api/v1", tags=["AI Tasks"]) 