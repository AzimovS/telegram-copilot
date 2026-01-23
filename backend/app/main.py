from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import briefing, summary

settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    debug=settings.debug,
)

# CORS middleware for Tauri
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(briefing.router, prefix="/api/briefing", tags=["briefing"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.api_version}


@app.on_event("startup")
async def startup_event():
    print(f"Starting {settings.api_title} v{settings.api_version}")


@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down...")
