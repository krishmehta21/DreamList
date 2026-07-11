import sys
import os
from dotenv import load_dotenv

# Reconfigure stdout for UTF-8 compatibility
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Add backend directory to path
sys.path.append("c:/Users/21meh/OneDrive/Desktop/DreamList/backend")
load_dotenv(dotenv_path="c:/Users/21meh/OneDrive/Desktop/DreamList/backend/.env")

from app.services.research_service import run_research, validate_price_entry

def test_item(name):
    print(f"\n======================================")
    print(f"RESEARCHING & FILTERING: '{name}'")
    print(f"======================================")
    try:
        data = run_research(name)
        print(f"Product: {data.get('brand')} {data.get('model')}")
        print("Raw Prices List Received:")
        
        valid_count = 0
        for p in data.get("prices", []):
            src = p.get("source")
            url = p.get("url")
            price_val = p.get("price")
            
            # Apply allowlist check
            is_valid, reason = validate_price_entry(src, url)
            if is_valid:
                print(f"  ✓ [ACCEPTED] {src.upper()}: ₹{price_val} -> {url}")
                valid_count += 1
            else:
                print(f"  ✗ [REJECTED] {src.upper()}: ₹{price_val} -> {url}\n      Reason: {reason}")
                
        print(f"Total accepted prices stored in DB: {valid_count} / {len(data.get('prices', []))}")
    except Exception as e:
        print(f"Error researching '{name}': {str(e)}", file=sys.stderr)

def main():
    items = ["Keychron V1 Keyboard", "240Hz gaming monitor", "OLED monitor"]
    for item in items:
        test_item(item)

if __name__ == "__main__":
    main()
