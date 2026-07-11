import sys
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

sys.path.append("c:/Users/21meh/OneDrive/Desktop/DreamList/backend")
load_dotenv(dotenv_path="c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env")

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    # 1. Sign in via Supabase Auth
    print("Signing in to Supabase...")
    supabase_client = create_client(url, key)
    try:
        session_data = supabase_client.auth.sign_in_with_password({
            "email": "21mehtak@gmail.com",
            "password": "Password123" # Standard test password
        })
        token = session_data.session.access_token
        user_id = session_data.user.id
        print(f"Successfully logged in! User ID: {user_id}")
    except Exception as auth_err:
        print(f"Auth failed: {str(auth_err)}. Attempting to sign in with a different password...")
        try:
            session_data = supabase_client.auth.sign_in_with_password({
                "email": "21mehtak@gmail.com",
                "password": "Password123!"
            })
            token = session_data.session.access_token
            user_id = session_data.user.id
            print(f"Successfully logged in! User ID: {user_id}")
        except Exception as auth_err2:
            print(f"ERROR: Could not log in: {str(auth_err2)}", file=sys.stderr)
            sys.exit(1)
            
    # 2. Call FastAPI items endpoint
    api_url = "http://localhost:8000/items/"
    print(f"Hitting API endpoint {api_url}...")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    try:
        res = requests.get(api_url, headers=headers)
        print(f"Response status: {res.status_code}")
        print("API Response Body:")
        print(res.text)
    except Exception as api_err:
        print(f"FastAPI connection failed: {str(api_err)}")

if __name__ == "__main__":
    main()
