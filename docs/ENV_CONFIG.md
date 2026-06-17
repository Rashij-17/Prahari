# Prahari — Environment Configuration Registry

This document lists all environment variables required to run Prahari locally and in production.

---

## 1. Client Environment Configuration

The React frontend is built using Vite. Client variables must be prefixed with `VITE_` to be loaded into the client bundle at build time.

Create a `.env` file in the `frontend/` root directory:

```env
# frontend/.env (Never commit this file to Git)

# Base URL pointing to the FastAPI backend service
VITE_API_BASE_URL=http://localhost:8000

# Supabase Authentication & Sync Configuration (Optional for local mockup mode)
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 1.1 Client Variables Specification

| Variable Name | Purpose | Example Value (Dev) | Example Value (Prod) |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base endpoint path where the API client makes requests. | `http://localhost:8000` | `https://prahari-api.onrender.com` |
| `VITE_SUPABASE_URL` | Supabase project endpoint for auth and syncing. | `https://project.supabase.co` | `https://prod.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key. | `eyJhbGciOi...` | `eyJhbGciOi...` |

---

## 2. Backend Environment Configuration

The FastAPI backend manages environment parameters via OS lookups. Create a `.env` file in the `backend/` directory:

```env
# backend/.env (Never commit this file to Git)

# ─── APP SETTINGS ───────────────────────────────────────────────────────────
DEBUG=true
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

# ─── INFERMEDICA Symptom Triage ─────────────────────────────────────────────
INFERMEDICA_APP_ID=your_infermedica_id_here
INFERMEDICA_APP_KEY=your_infermedica_key_here

# ─── GOOGLE PLACES Specialist Directory ──────────────────────────────────────
GOOGLE_PLACES_API_KEY=your_google_places_key_here

# ─── LLM / SPEECH & VISION SERVICES ─────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# ─── DATABASE & AUTHENTICATION ──────────────────────────────────────────────
# Relational DB connection string (defaults to local sqlite if unset)
# DATABASE_URL=postgresql://user:password@host:port/dbname
SUPABASE_JWT_SECRET=your_supabase_jwt_secret_here
SUPABASE_URL=https://your-supabase-project.supabase.co
```

### 2.1 Backend Variables Grid

| Variable Name | Scope | Description | Default (Dev) | Validation Rules | Impact of Misconfiguration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DEBUG` | Server Boot | Activates verbose logs, stack traces, and CORS relaxations. | `true` | `true` / `false` | If `false` in dev, detailed exception details are hidden. |
| `PORT` | Uvicorn Bind | Sets the network port where the API server listens. | `8000` | Positive integer | Server fails to bind if the port is already in use. |
| `FRONTEND_ORIGIN` | Middleware | Whitelists the frontend client origin for CORS. | `http://localhost:5173` | Fully qualified URL | If misconfigured, frontend HTTP calls fail with CORS origin errors. |
| `INFERMEDICA_APP_ID` | Services | Application ID for the Infermedica NLP engine. | `""` | String value | If empty, triage routes fall back to mock preview payloads. |
| `INFERMEDICA_APP_KEY` | Services | Application Key for the Infermedica NLP engine. | `""` | String value | If empty, triage routes fall back to mock preview payloads. |
| `GOOGLE_PLACES_API_KEY` | Services | Google Cloud API key with Places API enabled. | `""` | String value | If empty, provider directory routes fall back to mock coordinates. |
| `GEMINI_API_KEY` | Services | API key for Gemini models (multimodal OCR + transcript parsing). | `""` | String value | If empty, OCR & transcription use fallbacks or local mock simulation. |
| `GROQ_API_KEY` | Services | API key for Groq models (Whisper-v3 speech-to-text). | `""` | String value | If empty, falls back to Gemini Audio or local simulator. |
| `DATABASE_URL` | Storage | SQL database URL for cabinet and appointment sync. | `sqlite:///./prahari.db` | RFC 3986 connection URL | If invalid, database connection fails at boot. |
| `SUPABASE_JWT_SECRET` | Security | JWT signing secret to verify bearer tokens. | `""` | String value | If empty or invalid, user session verification fails. |
| `SUPABASE_URL` | Security | Supabase URL matching the client configuration. | `""` | Fully qualified URL | If misconfigured, Supabase sync routes cannot authenticate correctly. |

---

## 3. Platform Configuration Guide

### 3.1 Vercel (Frontend Deployment)
1. Go to your Vercel Dashboard $\rightarrow$ Select the Prahari Frontend project.
2. Select **Settings** $\rightarrow$ **Environment Variables**.
3. Add `VITE_API_BASE_URL` with your production backend API URL (e.g., `https://prahari-api.onrender.com`).
4. Re-deploy the project.

### 3.2 Render (Backend Deployment)
1. Go to your Render Dashboard $\rightarrow$ Select the FastAPI Web Service.
2. Select **Environment** $\rightarrow$ **Add Environment Variable**.
3. Populate:
   - `DEBUG` = `false`
   - `FRONTEND_ORIGIN` = `https://prahari.vercel.app` (your Vercel URL)
   - `INFERMEDICA_APP_ID` = `[your-app-id]`
   - `INFERMEDICA_APP_KEY` = `[your-app-key]`
   - `GOOGLE_PLACES_API_KEY` = `[your-google-key]`
4. Click **Save Changes**. The service will automatically trigger a rolling rebuild and redeploy.
