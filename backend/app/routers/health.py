from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.config import get_supabase_client

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check():
    """
    Basic health check endpoint that returns HTTP 200 OK.
    """
    return {"status": "ok"}

@router.get("/health/db")
def db_health_check(client: Client = Depends(get_supabase_client)):
    """
    Checks connection to Supabase database by attempting a simple select.
    """
    try:
        # Just query the users table or similar basic check
        response = client.table("users").select("id", count="exact").limit(1).execute()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )
