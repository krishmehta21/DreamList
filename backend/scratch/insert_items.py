import sys
import os
import psycopg2
from dotenv import load_dotenv

sys.path.append("c:/Users/21meh/OneDrive/Desktop/DreamList/backend")
load_dotenv(dotenv_path="c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env")

from app.routers.items import run_background_research

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    # 1. Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(
        host="aws-1-ap-southeast-2.pooler.supabase.com",
        port=5432,
        user="postgres.updldhzjuuxctkhehjjl",
        password="Madhu@101976",
        database="postgres"
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    # 2. Find user ID for 21mehtak@gmail.com
    email = "21mehtak@gmail.com"
    print(f"Looking up user ID for {email}...")
    cursor.execute("SELECT id FROM auth.users WHERE email = %s;", (email,))
    row = cursor.fetchone()
    if not row:
        print(f"ERROR: No user found in auth.users with email '{email}'. Please sign up in the app first.", file=sys.stderr)
        sys.exit(1)
        
    user_id = row[0]
    print(f"Found User ID: {user_id}")
    
    # Make sure user profile exists in public.users
    cursor.execute("INSERT INTO public.users (id, email) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING;", (user_id, email))
    
    # 3. List of items to insert
    items = [
        # Tech
        {"name": "Samsung Odyssey OLED G6 Gaming Monitor (240Hz+)", "category": "Tech", "tier": "dream", "notes": "240Hz+ for Valorant. Dad said no OLED but still want one."},
        {"name": "1080p 144Hz Gaming Monitor", "category": "Tech", "tier": "soon", "notes": "Secondary display for setup."},
        {"name": "Gaming PC Build & ARGB Lights", "category": "Tech", "tier": "soon", "notes": "Start building a PC soon along with lights."},
        # Home Setup
        {"name": "No-Drill Cable Organizer Kit", "category": "Home", "tier": "now", "notes": "Non-drill under-table management tray."},
        {"name": "Aesthetic Large Desk Mat", "category": "Home", "tier": "now", "notes": "Good quality mouse pad/desk mat for table."},
        {"name": "Shower Filter Head for soft water", "category": "Home", "tier": "now", "notes": "Needed for soft water in Bangalore."},
        {"name": "Indoor Desk Plants", "category": "Home", "tier": "now", "notes": "Low-maintenance succulents or room plants."},
        {"name": "Guitar Wall Mount Holder", "category": "Home", "tier": "now", "notes": "To display guitar on the wall."},
        {"name": "Aesthetic Wall Frames", "category": "Home", "tier": "now", "notes": "Posters/prints for decor."},
        {"name": "Desk Shelf Tabletop Organizer", "category": "Home", "tier": "soon", "notes": "Shelves on top of table."},
        {"name": "Home Bar Cabinet setup", "category": "Home", "tier": "soon", "notes": "Cabinet already present, want to stock and style it."},
        {"name": "Cozy Bean Bag Chair", "category": "Home", "tier": "soon", "notes": "Lounge seating for bedroom."},
        {"name": "Aesthetic Room Floor Mirror", "category": "Home", "tier": "soon", "notes": "Full length aesthetic mirror."},
        # Other
        {"name": "Vape", "category": "Other", "tier": "now", "notes": "Personal item."}
    ]
    
    print("\nInserting items and triggering background AI research...")
    for idx, item in enumerate(items, 1):
        print(f"\n[{idx}/{len(items)}] Processing: '{item['name']}'...")
        cursor.execute("SELECT id FROM public.wishlist_items WHERE user_id = %s AND name = %s;", (user_id, item["name"]))
        row_item = cursor.fetchone()
        if row_item:
            item_id = row_item[0]
            print(f"  ✓ Item already exists in DB with ID: {item_id}")
        else:
            insert_sql = """
            INSERT INTO public.wishlist_items (user_id, name, category, tier, manual_notes, status, done)
            VALUES (%s, %s, %s, %s, %s, 'pending', false)
            RETURNING id;
            """
            cursor.execute(insert_sql, (user_id, item["name"], item["category"], item["tier"], item["notes"]))
            item_id = cursor.fetchone()[0]
            print(f"  ✓ Inserted new record with ID: {item_id}")
        
        # Trigger the AI research parser synchronously for this item
        print(f"  ⚡ Running Gemini grounding scraper...")
        try:
            run_background_research(item_id, item["name"], user_id)
            print("  ✓ Research completed.")
        except Exception as e:
            print(f"  ✗ Research failed: {str(e)}")
            
    cursor.close()
    conn.close()
    print("\nALL ITEMS INSERTED & RESEARCHED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
