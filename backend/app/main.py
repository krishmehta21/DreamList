import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, items
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="DreamList API",
    description="Backend API for personal wishlist tracker app with AI research pipeline",
    version="0.1.0"
)

# CORS configuration to allow access from local Expo app development environment
origins = [
    "http://localhost:8081",  # Metro bundler web
    "http://localhost:19000", # Legacy Expo Metro
    "http://localhost:19006", # Legacy Expo Web
    "*",                      # Allow all origins for local emulator testing (like android/ios simulator)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(items.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to DreamList API. Use /health to check status."}

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
