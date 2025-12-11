"""
FastAPI application entry point
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.memory_service import initialize_memory_service, get_memory_service
from app.database import engine, Base

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup: Create DB tables
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    # Startup: Initialize memory service
    logger.info("Initializing services...")
    memory_service = initialize_memory_service()
    if memory_service:
        logger.info("Memory service initialized successfully")
    else:
        logger.info("Memory service not initialized (disabled or not configured)")
    
    yield
    
    # Shutdown: Close memory service
    memory_service = get_memory_service()
    if memory_service:
        memory_service.close()
        logger.info("Memory service closed")

# Create FastAPI application instance
app = FastAPI(
    title="异界声律·Epsilon API",
    description="LLM文本对话与GPT-SoVITS语音合成Web应用",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "异界声律·Epsilon API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Import API routers
from app.api import chat, config, upload, characters, memory, history
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(config.router, prefix="/api", tags=["config"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(characters.router, prefix="/api", tags=["characters"])
app.include_router(memory.router, prefix="/api", tags=["memory"])
app.include_router(history.router, prefix="/api", tags=["history"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )

