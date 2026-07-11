import os
import re
from dotenv import load_dotenv
import psycopg2

load_dotenv()

db_url = os.getenv("DATABASE_URL")
user_pass, host_db = db_url.split("://")[1].rsplit("@", 1)
user, password = user_pass.split(":", 1)
host_port, dbname = host_db.split("/", 1)
if ":" in host_port:
    host, port = host_port.split(":", 1)
else:
    host, port = host_port, 5432

try:
    conn = psycopg2.connect(
        database=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    cur = conn.cursor()
    
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'item_research';
    """)
    print("\nColumns in item_research:")
    for row in cur.fetchall():
        print(row)
        
    cur.close()
    conn.close()
except Exception as e:
    print("Error querying DB:", e)
