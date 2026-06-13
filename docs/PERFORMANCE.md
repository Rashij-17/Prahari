# Prahari — Performance & Optimization Manual

This manual details Prahari's image compression thresholds, execution optimizations, and caching roadmaps to keep load speeds minimal on low-connectivity mobile networks.

---

## 1. Scanner Image Processing Optimization

Uploading raw camera frames from modern smartphones (often $\ge 12$ megapixels, $> 5\text{MB}$) over mobile data is a major latency bottleneck.

### 1.1 Client-Side Constraints & Sampling
*   **Resolution Cap:** Captured video canvas elements in [`CameraScanner.jsx`](file:///d:/Prahari/frontend/src/components/scanner/CameraScanner.jsx#L29-L30) are capped at a maximum width of `1920px` and height of `1080px`.
*   **Compression Export:** Canvas images are exported using `canvas.toDataURL('image/jpeg', 0.92)`. The JPEG quality of `0.92` balances data reduction (shrinking payloads to $< 200\text{KB}$) with text stroke definition required for OCR accuracy.
*   **Volatile Memory Processing:** Backend decodes base64 arrays in-memory (`cv2.imdecode`) directly into memory-resident BGR color arrays, bypassing disk writes.

---

## 2. API Caching Strategies (Planned)

Since chemical drug definitions and clinical interactions represent static, slow-changing records, executing network queries to external APIs (RxNorm, openFDA) for duplicate search terms degrades performance.

### 2.1 Proposed Backend LRU Cache (In-Memory)
For single-instance servers, we can implement async-safe LRU caching decorators on our service endpoints:

```python
from functools import lru_cache
from typing import Optional

# Cache drug name RxCUI lookups (static mapping)
@lru_cache(maxsize=1024)
async def resolve_name_to_rxcui(name: str) -> Optional[str]:
    # Outbound NLM RxNorm network calls
    pass
```

### 2.2 Redis Cache Layer (Scalable Deployments)
For multi-instance server deployments, a shared Redis instance will store JSON drug records:
*   **Active Ingredient & Classification TTL:** 7 days.
*   **Drug-Drug Interaction Results TTL:** 14 days.

---

## 3. Concurrency & Async Processing

When resolving searches, Prahari retrieves data from both NLM and openFDA concurrently:
*   **Implementation:** [`medication.py` (Router)](file:///d:/Prahari/backend/routers/medication.py#L183-L188) uses `asyncio.gather` to execute HTTP calls in parallel. This halves the total latency compared to sequential requests.
*   **Refinement Need:** Ensure exceptions are handled on a per-task basis so that if one service fails, the other can still return partial results.
