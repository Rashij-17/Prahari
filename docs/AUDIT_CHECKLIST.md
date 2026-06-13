# Prahari — Production Audit Checklist

**Version:** 1.0.0  
**Scope:** Run checks before deploying to Vercel or Render. All items must pass.

---

## 1. Security & Keys Checklist
- [ ] **No Hardcoded Keys:** Run `grep -rn "GOOGLE_PLACES" src/` $\rightarrow$ must return 0 results.
- [ ] **No Hardcoded App Keys:** Run `grep -rn "INFERMEDICA" src/` $\rightarrow$ must return 0 results.
- [ ] **Backend Env Configuration:** Verify `.env` values are defined in Render's Env settings panel.
- [ ] **CORS Origins Locked:** Verify `FRONTEND_ORIGIN` in the backend matches the production client URL (e.g., `https://prahari.vercel.app`).
- [ ] **Secure Transport:** Verify HTTPS is enforced on all endpoints.

---

## 2. API & Service Checklist
- [ ] **Infermedica Fallbacks:** Confirm backend runs mock data if keys are not present in `.env` (`is_mock=True` returned).
- [ ] **Google Places Fallbacks:** Confirm geolocation returns mock doctor entries if Places key is missing.
- [ ] **RxNorm Approximation:** Ensure `search=1` approximate searches are active to resolve fuzzy OCR outputs.
- [ ] **Concurrences:** Verify `asyncio.gather` executes without blocking threads on simultaneous queries.

---

## 3. UI/UX & Responsive Checklist
- [ ] **Mobile Drawer:** Verify drawer closes automatically on route transition.
- [ ] **Viewport Breakpoints:** Test layout switches from Mobile Drawer to Desktop Sidebar at exactly `768px`.
- [ ] **Disclaimer Card:** Confirm the medical disclaimer warning is present on the HomePage.
- [ ] **Touch Targets:** Verify all buttons and chips have a touch target of at least $44 \times 44\text{px}$.
- [ ] **SVG Scaling:** Ensure anatomical triage body maps fit within viewport bounds on smaller devices.
- [ ] **Text Contrast:** Ensure text colors exceed a $4.5:1$ contrast ratio in both Light and Dark modes.
