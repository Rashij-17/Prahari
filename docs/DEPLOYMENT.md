# Prahari — Deployment Manual

This document details the production build, packaging, and deployment setups for Vercel (React client) and Render (FastAPI server).

---

## 1. Local Run & Building

### 1.1 Frontend Production Build
To test the Vite build locally before deploying:
```bash
cd frontend
npm run build
```
This produces a static output bundle in `frontend/dist/`.

### 1.2 Backend Server Boot
To run Uvicorn in production mode (non-reload):
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 2. Vercel Deployment (Frontend client)

Deploying the React SPA using the Vercel Git integration:

1.  **Vercel Project Setup:** Import `Rashij-17/Prahari` and select the `frontend` directory as the project root.
2.  **Build Settings Configuration:**
    *   **Build Command:** `npm run build` or `vite build`
    *   **Output Directory:** `dist`
3.  **Environment Variables:** Add `VITE_API_BASE_URL` and configure it to point to your live hosted Render backend URL.

---

## 3. Render Deployment (FastAPI backend)

Deploying the Python API server using Render:

1.  **Render Service Setup:** Create a new **Web Service**, link the repo, and select the `backend` folder as the root directory.
2.  **Runtime Settings:**
    *   **Environment:** `Python`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3.  **System Package Dependencies:**
    - Since pytesseract binds to the Tesseract binary, you must install Tesseract on the server host.
    - On Render, this is achieved by adding a custom `apt-get` buildpack or using a Docker deployment (`Dockerfile`).

### 3.2 Dockerfile Alternative (For reliable Tesseract setups)
If the host environment does not permit custom apt packages, use a Docker build. Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install Tesseract OCR and OpenCV system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```
On Render, select **Docker** as the runtime instead of Python, and it will build the image automatically.
