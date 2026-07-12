import os
import sys
from dotenv import load_dotenv
from google import genai

def main():
    # Configure stdout to handle UTF-8 symbols (like the Rupee symbol ₹)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    load_dotenv()
    
    # Add parent to path
    sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")
    from app.core.config import get_settings
    settings = get_settings()
    
    api_key = settings.GEMINI_API_KEY
    
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not set or is still a placeholder in backend/.env", file=sys.stderr)
        print("Please configure the actual key in backend/.env to run this test.", file=sys.stderr)
        sys.exit(1)
        
    print("Initializing Google GenAI Client...")
    try:
        client = genai.Client(api_key=api_key)
        
        print("Creating grounding interaction using gemini-2.5-flash...")
        interaction = client.interactions.create(
            model="gemini-2.5-flash",
            input="Latest price of Keychron V1 keyboard in India on Amazon or Flipkart",
            tools=[{"type": "google_search"}]
        )
        
        print("\n======================================")
        print("ISOLATION TEST RESULT:")
        print("======================================")
        print(interaction.output_text)
        print("======================================")
        print("SUCCESS! Grounded response received.")
    except Exception as e:
        print(f"\nAPI Error during execution: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
