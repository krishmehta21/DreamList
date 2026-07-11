import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("Supabase URL:", supabase_url)
print("Supabase Key configured:", bool(supabase_key))
print("Service Role Key configured:", bool(service_role_key))

try:
    # Test connection with anon key
    client = create_client(supabase_url, supabase_key)
    res = client.table("wishlist_items").select("id, name").limit(5).execute()
    print("\nSuccessfully queried wishlist_items table!")
    print("Found items:", res.data)
except Exception as e:
    print("\nError querying Supabase:", e)
