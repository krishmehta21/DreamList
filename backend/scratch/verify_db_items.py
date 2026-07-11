import sys
import psycopg2

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    print("Connecting to database...")
    try:
        conn = psycopg2.connect(
            host="aws-1-ap-southeast-2.pooler.supabase.com",
            port=5432,
            user="postgres.updldhzjuuxctkhehjjl",
            password="Madhu@101976",
            database="postgres"
        )
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, email FROM auth.users;")
        print("\n--- AUTH.USERS ---")
        for row in cursor.fetchall():
            print(f"ID: {row[0]} | Email: {row[1]}")
            
        cursor.execute("SELECT id, email FROM public.users;")
        print("\n--- PUBLIC.USERS ---")
        for row in cursor.fetchall():
            print(f"ID: {row[0]} | Email: {row[1]}")
            
        cursor.execute("SELECT id, user_id, name, category, status FROM public.wishlist_items;")
        print("\n--- PUBLIC.WISHLIST_ITEMS ---")
        rows = cursor.fetchall()
        print(f"Total items in table: {len(rows)}")
        for row in rows[:15]:
            print(f"Item ID: {row[0]} | User ID: {row[1]} | Name: {row[2]} | Cat: {row[3]} | Status: {row[4]}")
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    main()
