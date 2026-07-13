import sys
sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")
from dotenv import load_dotenv

load_dotenv()
from app.core.config import get_settings
from supabase import create_client

s = get_settings()
client = create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)

print("Querying all items in wishlist_items...")
res = client.table('wishlist_items').select('id, name, status, manual_link, user_id, created_at').execute()

print(f"Total items found: {len(res.data)}")
print("\nAll items in DB:")
for item in res.data:
    print(item)

print("\nQuerying all entries in item_research...")
res_research = client.table('item_research').select('*').execute()
print(f"Total item_research rows: {len(res_research.data)}")
for r in res_research.data:
    print(r)

print("\nQuerying all entries in item_prices...")
res_prices = client.table('item_prices').select('*').execute()
print(f"Total item_prices rows: {len(res_prices.data)}")
for p in res_prices.data:
    print(p)
