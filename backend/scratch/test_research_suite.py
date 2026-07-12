import sys
import os
import time
import threading
import pprint

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")

from app.services.research_service import run_research, validate_price_entry

# -------------------------------------------------------------
# Part 1: Single-Item Quality & URL Shape Verification
# -------------------------------------------------------------
test_items = [
    {"name": "Keychron V1 Keyboard", "link": None},
    {"name": "240Hz gaming monitor", "link": None},
    {"name": "OLED monitor", "link": None},
    {"name": "Sony XM5 Headphones", "link": None},
    {"name": "Researching details...", "link": "https://www.amazon.in/Logitech-G502-High-Performance-Gaming-Mouse/dp/B07GBZ4Q68/"}
]

print("=== Running Single-Item Quality & URL Shape Tests ===")

for idx, item in enumerate(test_items):
    name = item["name"]
    link = item["link"]
    print(f"\n--- Item {idx+1}: '{name}' (Link: {link}) ---")
    start_time = time.time()
    try:
        res = run_research(name, manual_link=link)
        duration = time.time() - start_time
        print(f"Research finished in {duration:.2f} seconds.")
        print(f"Resolved Brand: {res.get('brand')}")
        print(f"Resolved Model: {res.get('model')}")
        print(f"Summary: {res.get('summary')}")
        
        prices = res.get("prices", [])
        print(f"Prices returned: {len(prices)}")
        
        valid_count = 0
        for p in prices:
            url = p.get("url", "")
            src = p.get("source", "")
            is_valid, reason, norm = validate_price_entry(src, url)
            status_str = "VALID" if is_valid else f"INVALID ({reason})"
            if is_valid:
                valid_count += 1
            print(f"  * [{src}] -> {url} -> {status_str}")
            
        print(f"URL Shape Pass Rate: {valid_count}/{len(prices)} ({100 * valid_count / max(1, len(prices)):.1f}%)")
    except Exception as e:
        print("FAILED to research item:", e)


# -------------------------------------------------------------
# Part 2: Burst/Queue Simulation
# -------------------------------------------------------------
print("\n=== Running Burst Queue Simulation (5 items simultaneously) ===")

burst_items = [
    "Apple AirTag",
    "Logitech MX Master 3S",
    "Samsung T7 SSD",
    "Anker Power Bank 20000mAh",
    "Raspberry Pi 5"
]

results = []
errors = []
threads = []

def worker(item_name):
    thread_name = threading.current_thread().name
    print(f"[{thread_name}] Triggered research for '{item_name}'")
    start = time.time()
    try:
        res = run_research(item_name)
        elapsed = time.time() - start
        print(f"[{thread_name}] Completed '{item_name}' in {elapsed:.2f} seconds.")
        results.append((item_name, res))
    except Exception as e:
        print(f"[{thread_name}] FAILED '{item_name}': {e}")
        errors.append((item_name, e))

overall_start = time.time()

for idx, item in enumerate(burst_items):
    t = threading.Thread(target=worker, args=(item,), name=f"Thread-{idx+1}")
    threads.append(t)
    t.start()

print("All threads started. Waiting for completion...")
for t in threads:
    t.join()

total_duration = time.time() - overall_start
print(f"\nBurst run completed in {total_duration:.2f} seconds.")
print(f"Successfully researched: {len(results)}/{len(burst_items)}")
print(f"Errors encountered: {len(errors)}/{len(burst_items)}")

for err in errors:
    print(f"  * Error for '{err[0]}': {err[1]}")

assert len(results) == len(burst_items), "Some items failed during the burst simulation!"
print("\nBURST QUEUE SIMULATION PASSED! All concurrent requests resolved successfully via the pacing lock.")
