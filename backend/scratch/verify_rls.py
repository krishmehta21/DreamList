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
        
        # Start transaction
        cursor.execute("BEGIN;")
        
        # Inject the mock auth claim simulating user login
        user_uuid = "5c9edc27-cb77-480b-8e31-89102fbd92a9"
        cursor.execute(f"SET LOCAL request.jwt.claim.sub = '{user_uuid}';")
        
        # Run query under RLS restriction
        cursor.execute("SELECT id, name, category, status FROM public.wishlist_items;")
        rows = cursor.fetchall()
        print(f"\n--- RLS SIMULATION RESULTS (UID: {user_uuid}) ---")
        print(f"Items visible under RLS: {len(rows)}")
        for idx, row in enumerate(rows, 1):
            print(f"[{idx}] Name: {row[1]} | Cat: {row[2]} | Status: {row[3]}")
            
        cursor.execute("COMMIT;")
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    main()
