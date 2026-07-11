import os
import sys
import psycopg2
from dotenv import load_dotenv

def main():
    # Configure stdout for UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    # Load backend env
    dotenv_path = "c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env"
    load_dotenv(dotenv_path=dotenv_path)
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL is not configured in backend/.env", file=sys.stderr)
        sys.exit(1)
        
    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(
            host="aws-1-ap-southeast-2.pooler.supabase.com",
            port=5432,
            user="postgres.updldhzjuuxctkhehjjl",
            password="Madhu@101976",
            database="postgres"
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Read migration SQL file
        sql_path = "c:/Users/21meh/OneDrive/Desktop/DreamList/supabase/migrations/20260630000000_init_schema.sql"
        if not os.path.exists(sql_path):
            print(f"ERROR: Migration SQL file not found at {sql_path}", file=sys.stderr)
            sys.exit(1)
            
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
            
        print("Applying schema migrations...")
        cursor.execute(sql_script)
        print("Schema migrations applied successfully!")
        
        print("Enabling Supabase Realtime replication on wishlist_items...")
        try:
            cursor.execute("alter publication supabase_realtime add table public.wishlist_items;")
            print("Realtime replication activated successfully!")
        except Exception as re_err:
            # Table might already be in publication or publication doesn't exist
            print(f"Note on Realtime activation: {str(re_err)}")
            
        cursor.close()
        conn.close()
        print("\nDATABASE INITIALIZATION COMPLETE! Your schema is ready.")
        
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
