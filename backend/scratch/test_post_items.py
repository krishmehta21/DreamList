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
        
        # Try inserting a row under RLS restriction
        print("Inserting test item...")
        insert_sql = """
        INSERT INTO public.wishlist_items (user_id, name, category, tier, manual_notes, status, done)
        VALUES (%s, 'RLS Insert Test', 'Tech', 'now', 'Testing insert RLS policy', 'pending', false)
        RETURNING id, name, user_id;
        """
        cursor.execute(insert_sql, (user_uuid,))
        row = cursor.fetchone()
        print(f"✓ Insert succeeded! Returned: ID={row[0]}, Name='{row[1]}', UserID='{row[2]}'")
        
        cursor.execute("ROLLBACK;")
        cursor.close()
        conn.close()
        print("Verification complete.")
        
    except Exception as e:
        print(f"Database error during insert: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    main()
