# DreamList - Personal Wishlist Tracker

DreamList is a personal-first AI-powered wishlist tracker app. You add an item by name, and an AI background research process gathers details, specs, and price offers from Amazon, Flipkart, and official sites to display them in a clean dashboard.

This repository is structured as a monorepo containing:
- `/app` - Expo mobile client application (TypeScript + Expo Router)
- `/backend` - FastAPI Python web server
- `/supabase` - Database migrations for Postgres schema

---

## Getting Started

### 1. Supabase Project Setup
1. Create a project at [supabase.com](https://supabase.com) or run a local instance.
2. Link your local directory or run the SQL initial migration found in:
   `supabase/migrations/20260630000000_init_schema.sql`
   You can apply it directly via the Supabase Dashboard SQL Editor, or use the Supabase CLI:
   ```bash
   supabase db push
   ```

### 2. Backend Setup (FastAPI)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure your environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   copy .env.example .env
   ```
5. Run the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
6. Check that the backend is working by visiting:
   [http://localhost:8000/health](http://localhost:8000/health)

### 3. Frontend Setup (Expo)
1. Navigate to the `app` directory:
   ```bash
   cd app
   ```
2. Configure your environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
3. Run the development server (Metro bundler):
   ```bash
   npm run dev
   # or
   npx expo start
   ```
4. Press `w` to open in the browser (web mode), or open it via the Expo Go app on iOS/Android.

---

## Technology Stack Summary
- **Frontend**: React Native, Expo, TypeScript, Expo Router (file-based navigation).
- **Backend**: FastAPI (Python), Uvicorn.
- **Database**: PostgreSQL (Supabase) + Row-level security (RLS).
