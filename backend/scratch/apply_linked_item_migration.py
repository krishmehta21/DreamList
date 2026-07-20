import psycopg2

try:
    conn = psycopg2.connect(
        host="aws-1-ap-southeast-2.pooler.supabase.com",
        user="postgres.updldhzjuuxctkhehjjl",
        password="Madhu@101976",
        port=5432,
        database="postgres"
    )
    cursor = conn.cursor()
    
    # 1. Add linked_item_id to goals
    print("Adding linked_item_id to public.goals...")
    cursor.execute("""
        ALTER TABLE public.goals 
        ADD COLUMN IF NOT EXISTS linked_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL;
    """)
    
    # 2. Add display_name to users
    print("Adding display_name to public.users...")
    cursor.execute("""
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS display_name text;
    """)
    
    conn.commit()
    print("Migration completed successfully!")
    
    # Verify columns in goals
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='goals';")
    print("\nColumns of 'goals' now:")
    for c in cursor.fetchall():
        print(f" - {c[0]}: {c[1]}")
        
    # Verify columns in users
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users';")
    print("\nColumns of 'users' now:")
    for c in cursor.fetchall():
        print(f" - {c[0]}: {c[1]}")
        
    cursor.close()
    conn.close()
except Exception as e:
    print("Error during migration:", e)
