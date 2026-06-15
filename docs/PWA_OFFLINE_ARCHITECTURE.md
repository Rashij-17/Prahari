# Prahari — PWA & Offline Caching Architecture

This document outlines the Progressive Web App (PWA) requirements, service worker configurations, and offline fallback mechanisms for Prahari (MedLens).

---

## 1. PWA Manifest Specifications

To allow installation on mobile devices (Android/iOS) and desktop browsers, Prahari should include a `manifest.json` under `frontend/public/` (not currently present in this repo):

```json
{
  "short_name": "Prahari",
  "name": "Prahari MedLens Sentinel",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#2A7F8C",
  "background_color": "#fbfbf9"
}
```

---

## 2. Service Worker Lifecycle (Cache-First)

The Prahari Service Worker executes a **Cache-First** strategy for local static assets (HTML, JS, CSS, fonts) and a **Network-First** strategy for API requests.

```
                  ┌─────────────────────────────────────────┐
                  │              Fetch Event                │
                  └────────────────────┬────────────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼ (Static Asset)            ▼ (API Data)
                 [ Cache-First ]             [ Network-First ]
                 - Match in Cache            - Fetch from network
                 - If missing: Network       - Cache response
                 - Add to Cache              - Fallback: Offline error
```

### 2.1 Pre-Cached Assets
On installation, the Service Worker pre-caches all static content needed to mount the application shell:
- `index.html`
- `/src/main.jsx`
- `/src/index.css`
- Google Fonts (`Inter`, `DM Serif Display`, `IBM Plex Mono`)

### 2.2 Offline Fallback page
When a user launches the app without an internet connection:
- The UI mounts using the pre-cached SPA assets.
- If a user tries to perform a drug search or triage symptoms, the Service Worker catches the network failure and returns a structured JSON mock state:
  ```json
  {
    "is_offline": true,
    "detail": "No network connection. Saved offline database items will display here."
  }
  ```
- The frontend detects `"is_offline": true` and shows a banner: *"Viewing cached offline data. Scanner and Triage features require an active connection."*
