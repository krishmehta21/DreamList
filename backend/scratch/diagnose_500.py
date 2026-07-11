import sys
import os
import requests
from supabase import create_client
from dotenv import load_dotenv

sys.path.append("c:/Users/21meh/OneDrive/Desktop/DreamList/backend")
load_dotenv(dotenv_path="c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env")

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    supabase_client = create_client(url, key)
    
    test_email = "test_diagnose@dreamlist.com"
    test_password = "Password123!"
    
    service_client = create_client(url, os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    
    # 1. Register/Login test user
    print(f"Signing up/in as {test_email}...")
    try:
        # Try sign up first
        res_signup = supabase_client.auth.sign_up({
            "email": test_email,
            "password": test_password
        })
        user_uuid = res_signup.user.id
        print(f"Signup successful. User ID: {user_uuid}")
        # Confirm email using admin API
        service_client.auth.admin.update_user_by_id(
            user_uuid,
            attributes={"email_confirm": True}
        )
        print("Email confirmed via Admin API.")
    except Exception as e:
        print(f"Signup/confirm skipped or failed (user might exist): {str(e)}")
        
    try:
        res_login = supabase_client.auth.sign_in_with_password({
            "email": test_email,
            "password": test_password
        })
        token = res_login.session.access_token
        user_uuid = res_login.user.id
        print(f"Logged in successfully! User ID: {user_uuid}")
    except Exception as e:
        # If login fails because email confirmation was not applied, try to confirm it now
        print(f"Login failed, trying to confirm existing user email...")
        try:
            # Look up user in auth.users via SQL/Admin API to confirm
            # Let's find user by email
            users_list = service_client.auth.admin.list_users()
            for u in users_list:
                if u.email == test_email:
                    user_uuid = u.id
                    service_client.auth.admin.update_user_by_id(
                        user_uuid,
                        attributes={"email_confirm": True}
                    )
                    print("Confirmed email for existing user.")
                    break
            res_login = supabase_client.auth.sign_in_with_password({
                "email": test_email,
                "password": test_password
            })
            token = res_login.session.access_token
            user_uuid = res_login.user.id
            print(f"Logged in successfully on retry! User ID: {user_uuid}")
        except Exception as retry_err:
            print(f"ERROR logging in: {str(retry_err)}", file=sys.stderr)
            sys.exit(1)
        
    # Ensure profile exists in public.users to avoid foreign key errors
    print("Ensuring public.users record exists...")
    try:
        service_client.table("users").upsert({"id": user_uuid, "email": test_email}).execute()
        print("Public profile upserted.")
    except Exception as err:
        print(f"Warning: Public profile upsert failed: {str(err)}")

    # 2. Fire POST request to FastAPI
    api_url = "http://localhost:8000/items/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "name": "Live Diagnostic Item",
        "category": "Tech",
        "tier": "now",
        "manual_notes": "Diagnostic testing POST"
    }
    
    print(f"Sending POST request to {api_url}...")
    try:
        res = requests.post(api_url, json=payload, headers=headers)
        print(f"Status Code: {res.status_code}")
        print("Response headers:")
        for k, v in res.headers.items():
            print(f"  {k}: {v}")
        print("\nResponse Body:")
        print(res.text)
    except Exception as e:
        print(f"Connection to backend failed: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    main()
