import time
from fastapi import Request, HTTPException

class InMemoryRateLimiter:
    """
    Lightweight, dependency-free in-memory IP-based rate limiter.
    """
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.history: dict[str, list[float]] = {}

    async def __call__(self, request: Request):
        client_host = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean up old timestamps and filter current window
        if client_host in self.history:
            self.history[client_host] = [
                t for t in self.history[client_host]
                if now - t < self.window_seconds
            ]
        else:
            self.history[client_host] = []
        
        if len(self.history[client_host]) >= self.requests_limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Rate limit exceeded."
            )
        
        self.history[client_host].append(now)

# Instantiate rate limiters for specific endpoints (10 requests per minute)
limit_scan = InMemoryRateLimiter(requests_limit=10, window_seconds=60)
limit_profile = InMemoryRateLimiter(requests_limit=10, window_seconds=60)
limit_assess = InMemoryRateLimiter(requests_limit=10, window_seconds=60)
