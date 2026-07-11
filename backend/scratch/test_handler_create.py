import sys
import os
import asyncio
from dotenv import load_dotenv

sys.path.append("c:/Users/21meh/OneDrive/Desktop/DreamList/backend")
load_dotenv(dotenv_path="c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env")

from app.routers.items import create_item
from app.schemas.schemas import WishlistItemCreate
from app.core.config import get_settings
from supabase import create_client

class MockUser:
    def __init__(self, uid):
        self.id = uid

class MockBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        print(f"MockBackgroundTasks: Registered task '{func.__name__}' with args={args} kwargs={kwargs}")

async def test():
    settings = get_settings()
    user_uuid = "5c9edc27-cb77-480b-8e31-89102fbd92a9"
    user = MockUser(user_uuid)
    
    # We will use the service role client or admin client to simulate since we are local
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    item_in = WishlistItemCreate(
        name="API Handler Test Item",
        category="Tech",
        tier="now",
        manual_notes="Testing API route handler"
    )
    
    bg_tasks = MockBackgroundTasks()
    
    print("Calling create_item route handler...")
    try:
        # Simulate route handler call
        res = create_item(
            item=item_in,
            background_tasks=bg_tasks,
            user=user,
            client=client
        )
        print("✓ Route handler succeeded!")
        print("Result:", res)
    except Exception as e:
        print("✗ Route handler failed with exception:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
