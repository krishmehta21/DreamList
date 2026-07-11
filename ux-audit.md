# DreamList - First-Time User UX Audit Report

This audit represents the observations, design inconsistencies, friction points, and functional bugs discovered during an end-to-end user experience audit of the DreamList mobile app.

---

## Confusing / Unclear

1. **Priority Tier Meanings (NOW, SOON, DREAM)**
   - **Context**: The add item form and filter bar feature three priority tiers: `NOW`, `SOON`, and `DREAM`.
   - **Friction**: There is no explanation or onboarding to define these tiers. A new user is left to wonder: Are these time-based deadlines (buy now, buy soon, buy in a dream)? Budget-based indicators? Or do they alter the AI scraping frequency?
   - **Impact**: Users hesitate to categorize their items, resulting in arbitrary classification.

2. **"PRODUCT LINK" AI Research Impact**
   - **Context**: The add item screen contains a field labeled `PRODUCT LINK (OPTIONAL)`.
   - **Friction**: The interface does not explain how providing a link changes the AI behavior. A user won't realize that providing a link directs the AI to extract specific details and prices from *that* page, while leaving it blank triggers a broad web-grounded search for the product name.
   - **Impact**: Users might omit links, expecting the AI to guess their desired model, leading to inaccurate research outcomes.

3. **"Item Not Found" on Offline/Network Failure**
   - **Context**: Opening an item detail screen while offline or when the backend server is unreachable.
   - **Friction**: The app catches the network fetch error silently and displays a generic screen saying `"Item not found."`
   - **Impact**: This misleading error message makes the user think their item was deleted or the database is corrupted, rather than indicating a temporary network disconnection.

4. **Redundant "Best Value" Highlight on Single Offers**
   - **Context**: Under "PRICE COMPARISON" on the item detail screen.
   - **Friction**: If only a single price is returned (e.g., from a manual link or a single search result), it is highlighted with a colored border and a `★ BEST VALUE` badge.
   - **Impact**: Highlighting a single option as the "best value" is logically redundant and visually cluttered.

5. **Generic vs. Specific Search Discrepancy**
   - **Context**: Adding a generic item like "OLED monitor" without a link.
   - **Friction**: The AI selects a specific model (e.g., "LG UltraGear 27GR95QE") to research and pulls prices for it. The item's card on the dashboard still says "OLED monitor", but clicking it reveals technical specs and prices for the LG UltraGear.
   - **Impact**: Without displaying the AI's reasoning (which is generated but hidden), the user is left confused about why their generic request was mapped to a specific expensive brand.

---

## Unnecessary / Clutter

1. **Faded Completed Items In-Place**
   - **Context**: Marking an item as acquired (done) on the dashboard.
   - **Friction**: The card fades and strikes through the name, but remains in its original position in the category list.
   - **Impact**: Over time, as a user acquires dozens of items, the dashboard will become extremely cluttered with old crossed-out items.

2. **Unused AI Research Fields in API Response**
   - **Context**: The backend generates a detailed `best_price.reasoning` string explaining why a price/source was chosen.
   - **Friction**: The API sends this field, but the frontend detail screen (`[id].tsx`) completely ignores and never displays it.
   - **Impact**: Consumes LLM tokens and network bandwidth for zero user-facing value.

3. **Empty Link Spacers in Price Comparison Table**
   - **Context**: Manual price entries that do not include a product URL.
   - **Friction**: The "SHOP →" button is replaced by a blank space (`styles.emptyLinkSpacer`).
   - **Impact**: Leaves awkward, empty gaps in the price rows, making the table look incomplete.

4. **"ADDED BY YOU" and "USER VERIFIED" Redundancy**
   - **Context**: Manual price entry row in the detail screen.
   - **Friction**: The source column is labeled `👤 ADDED BY YOU` and the stock status is labeled `USER VERIFIED`.
   - **Impact**: Both badges represent the same manual action, causing wordy and repetitive text in a cramped table row.

---

## Missing / Needed

1. **Onboarding / Feature Walkthrough**
   - **Context**: Fresh launch of the application.
   - **Friction**: A brand-new user is immediately confronted with a raw login/register form. Upon registering, they are dropped into a blank dashboard.
   - **Need**: A simple carousel explaining that adding items triggers an AI research pipeline, along with 1-2 pre-populated sample items (e.g., "Sony WH-1000XM5") to demonstrate how the dashboard looks when populated.

2. **Camera Access for Screenshot Attachments**
   - **Context**: Screenshot attachments section in the item details screen.
   - **Friction**: The user can only upload images by picking from the device photo library.
   - **Need**: An option to "Take Photo" directly using the device camera so users can capture physical price tags or items in real-world retail stores.

3. **Offline Indicator and Error Messaging**
   - **Context**: Using the app without an active internet connection.
   - **Friction**: The dashboard silently fails to load and displays the empty state card ("Curate Your Wants"), prompting the user to add items (which will then fail to submit).
   - **Need**: A persistent banner or toast saying "You are offline" to set expectations.

4. **AI Selected Model Explanation**
   - **Context**: Reading details of a generic item that was researched as a specific model.
   - **Need**: Since the AI selects a specific recommendation, it should display the `reasoning` field returned by the backend (e.g., *"Selected LG UltraGear 27GR95QE because it is currently the best-rated 240Hz OLED monitor in India."*) to justify the specs and prices shown.

5. **Upload Progress Indicator**
   - **Context**: Uploading a screenshot file to Supabase.
   - **Friction**: Large images on slow connections show a static spinner in the box with no progress feedback.
   - **Need**: A percentage-based text indicator (e.g., "Uploading 45%") to show the upload is active.

---

## Visual / Design Issues

1. **Color Palette Violation (Red/White/Gray vs. Amber/Cyan/Violet)**
   - **Issue**: The design system in `design.ts` uses Red (`#FF3333`) for `NOW`, White (`#E7E9EE`) for `SOON`, and Gray (`#5A606C`) for `DREAM`. This violates the requested branding palette of **Amber, Cyan, and Violet**.
   - **Impact**: Red is psychologically associated with warnings/danger, making the "Buy Now" tier feel like an error state.

2. **Dashed Upload Box Border**
   - **Issue**: The `+ Add Image` upload placeholder block has a thin, dashed border.
   - **Impact**: Looks cheap and outdated, breaking the premium glassmorphic/flat dark card aesthetic of the rest of the application.

3. **Brackets in Badges (`[NOW]`, `[RESEACHING...]`)**
   - **Issue**: The interface displays status and priority badges using plain text enclosed in brackets.
   - **Impact**: Looks like a temporary developer debugging output rather than a polished, premium UI.

4. **Low Contrast Progress Bar**
   - **Issue**: The top progress bar is a thin, 2px line with a dark gray background (`#16191D`) and a white progress fill.
   - **Impact**: Hard to notice on OLED black screens and lacks visual presence.

5. **Form Actions Color Inconsistency (Dream Tier)**
   - **Issue**: The "Add Offer" manual price submission button uses `TIER_COLOR[item.tier]` as its background color.
   - **Impact**: If the item belongs to the `DREAM` tier, the button background becomes muted dark gray (`#5A606C`), resulting in dark text on a dark background that is virtually unreadable and hard to locate.

---

## Broken / Edge Cases

1. **Wiping Manual Prices on AI Re-research**
   - **Repro Steps**:
     1. Add an item (e.g., *"Keychron V1 keyboard"*).
     2. Wait for research to complete.
     3. Click `+ Add Manual Price / Link`.
     4. Enter a price (e.g., `12000`) and a product URL (e.g., `https://amazon.in/dp/example-product`).
     5. Submit the offer.
     6. The backend detects a new URL, updates the item's `manual_link`, and triggers a background AI research run.
     7. **The Break**: To avoid duplicate keys, the background research task deletes all existing records in the `item_prices` table for this item before writing the scraped offers.
     8. **Result**: The user's manual price is permanently deleted and overwritten by the AI-scraped prices.

2. **Strict Allowed Domains Discards Official Brands**
   - **Repro Steps**:
     1. Add an item like *"Sony XM5 Headphones"*.
     2. The Gemini model researches the item and finds a price offer on the official Sony store (`sony.co.in`).
     3. If Gemini sets the source to `"Sony Store"` or `"Sony"`, the backend's `validate_price_entry` checks if `"sony"` is in `trusted_platforms` (no) or if the source is exactly `"official"` (no).
     4. **Result**: The official manufacturer price is rejected as an `"Unknown price source class"` and discarded, leaving the user with fewer price comparisons.

3. **Killing App Mid-Research Leaves Status Hanging**
   - **Repro Steps**:
     1. Add a new item.
     2. The status is set to `pending`.
     3. Kill the app before the backend research completes.
     4. If the backend fails or experiences a network timeout during the scraping task, the item's status remains stuck in `researching` or `pending` forever on the dashboard.
     5. **Result**: The user sees `[RESEACHING...]` indefinitely with no way to manually force a re-trigger from the dashboard.

---

## Bugs Found

1. **Typo in Item Card Status (`[RESEACHING...]`)**
   - **Repro Steps**: Add any item and observe the card on the dashboard while the background task is running.
   - **Defect**: The status displays `[RESEACHING...]` (missing the first 'R' in researching).

2. **Unescaped Single Quote Lints & Build Failures**
   - **Repro Steps**: Run a production bundle build or lint check on the frontend.
   - **Defect**: The compiler throws `react/no-unescaped-entities` error on line 397 in `[id].tsx` due to `We couldn't retrieve AI details...` which blocks production builds.

3. **Demo Login Error Recovery loop**
   - **Repro Steps**: Attempt to log in via "One-Tap Demo Access" under unstable network conditions or Supabase db load.
   - **Defect**: The nested try-catch block tries to sign up if sign-in fails. If signup fails, or if signup succeeds but sign-in fails again, it throws secondary exceptions that crash the flow or create mismatched local sessions.
