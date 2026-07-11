# API Testing Reference - DreamList CRUD API

This document provides `curl` command examples to test all auth and wishlist item CRUD operations.

Replace the placeholders before executing:
- `<SUPABASE_ANON_KEY>`: `sb_publishable_9fzwBtv6qmyPAXNQ4tOVCQ_uZ_CXlwi`
- `<SUPABASE_URL>`: `https://updldhzjuuxctkhehjjl.supabase.co`
- `<ACCESS_TOKEN>`: The `access_token` returned by the Sign In step.
- `<ITEM_ID>`: The UUID of the wishlist item created.

---

## 1. Authentication

### A. Sign Up (Create User Profile)
Generates a new user profile.
```bash
curl -X POST "https://updldhzjuuxctkhehjjl.supabase.co/auth/v1/signup" \
     -H "apikey: sb_publishable_9fzwBtv6qmyPAXNQ4tOVCQ_uZ_CXlwi" \
     -H "Content-Type: application/json" \
     -d '{"email": "testuser@example.com", "password": "password123"}'
```

### B. Sign In (Retrieve JWT Access Token)
Generates an access token needed for CRUD operations.
```bash
curl -X POST "https://updldhzjuuxctkhehjjl.supabase.co/auth/v1/token?grant_type=password" \
     -H "apikey: sb_publishable_9fzwBtv6qmyPAXNQ4tOVCQ_uZ_CXlwi" \
     -H "Content-Type: application/json" \
     -d '{"email": "testuser@example.com", "password": "password123"}'
```
*Note: Copy the `access_token` from the JSON response to use as your `<ACCESS_TOKEN>` bearer header below.*

---

## 2. Wishlist Items CRUD (FastAPI)

### A. POST /items (Create Item)
Creates a wishlist item with status defaulting to "pending".
```bash
curl -X POST "http://localhost:8000/items/" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "OLED Monitor 32\"",
       "category": "Tech",
       "tier": "soon",
       "manual_notes": "Preferably 240Hz, matte coating",
       "manual_link": "https://example.com/monitor"
     }'
```

### B. GET /items (List Items with Filters)
Retrieves all items for the authenticated user.
```bash
curl -X GET "http://localhost:8000/items/" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Retrieve items filtered by tier (e.g. `soon`):
```bash
curl -X GET "http://localhost:8000/items/?tier=soon" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Retrieve items filtered by category (e.g. `Tech`):
```bash
curl -X GET "http://localhost:8000/items/?category=Tech" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### C. GET /items/{id} (Get Item Details with Joins)
Retrieves a single item's details, automatically left-joined with its corresponding research specs and price list.
```bash
curl -X GET "http://localhost:8000/items/<ITEM_ID>" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### D. PATCH /items/{id} (Update Item)
Updates attributes such as tier, category, done, manual notes/links.
```bash
curl -X PATCH "http://localhost:8000/items/<ITEM_ID>" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "tier": "now",
       "done": true,
       "manual_notes": "Acquired this early!"
     }'
```

### E. DELETE /items/{id} (Delete Item)
Removes the item from the wishlist.
```bash
curl -X DELETE "http://localhost:8000/items/<ITEM_ID>" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### F. POST /items/{id}/research (Trigger AI Research)
Triggers synchronous AI research using Claude and web searches.
```bash
curl -X POST "http://localhost:8000/items/<ITEM_ID>/research" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

