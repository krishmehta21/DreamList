import sys
import os
import pprint

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")

from app.services.research_service import run_research

print("Running a single end-to-end research query for 'Keychron V1 Keyboard' using gemini-3.1-flash-lite...")
try:
    res = run_research("Keychron V1 Keyboard")
    print("\nSUCCESS! Research result:")
    pprint.pprint(res)
except Exception as e:
    print("\nFAILED end-to-end research:", e)
