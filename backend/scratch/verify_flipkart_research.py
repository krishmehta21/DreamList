import sys
import os
import pprint

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")

from app.services.research_service import run_research

print("Running research on 'Acoustic Foam Panel' with a real Flipkart product URL...")
url = "https://www.flipkart.com/urban-infotech-pyramid-acoustic-foam-panel-soundproofing-tiles-pack-18-density-polyurethane/p/itm5b0ef33abce15"
try:
    res = run_research("Acoustic Foam Panel", manual_link=url)
    print("\nSUCCESS! Research result:")
    pprint.pprint(res)
except Exception as e:
    print("\nFAILED Flipkart research:", e)
