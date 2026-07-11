from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()
security = HTTPBearer()

def get_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return credentials.credentials

def get_current_user(token: str = Depends(get_token)):
    """
    Decodes and validates the Supabase JWT via the GoTrue client.
    """
    # Create client with anon key
    temp_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    try:
        user_response = temp_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token"
            )
        return user_response.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )

def get_user_db_client(token: str = Depends(get_token)) -> Client:
    """
    Returns a Supabase client initialized with the user's JWT.
    This ensures all queries enforce Row Level Security (RLS) using the user's session claims.
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    client.postgrest.auth(token)
    return client
