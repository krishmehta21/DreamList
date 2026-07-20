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
    
    # Print columns of item_prices
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='item_prices';")
    cols_prices = cursor.fetchall()
    print("\n=== COLUMNS of 'item_prices' ===")
    for c in cols_prices:
        print(f"{c[0]}: {c[1]}")
        
    # Print columns of item_research
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='item_research';")
    cols_research = cursor.fetchall()
    print("\n=== COLUMNS of 'item_research' ===")
    for c in cols_research:
        print(f"{c[0]}: {c[1]}")
        
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
