"""
Prahari — Cache Service
=======================
Handles asynchronous Redis-based caching for expensive external API queries.
Includes a thread-safe in-memory fallback cache if Redis is offline/unreachable.
"""

import json
import logging
import asyncio
from typing import Optional, Dict, Any
import redis.asyncio as aioredis

logger = logging.getLogger("uvicorn")

class CacheService:
    """
    Asynchronous caching service that acts as a client wrapper for Redis,
    falling back gracefully to a thread-safe local in-memory cache if the
    Redis daemon is not running or connection drops.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.redis_client: Optional[aioredis.Redis] = None
        self._memory_cache: Dict[str, str] = {}
        self._memory_cache_lock = asyncio.Lock()
        self.use_fallback = True

        # Will be initialized lazily on first cache lookup
        self._init_task: Optional[asyncio.Task] = None

    async def initialize(self) -> None:
        """
        Attempt to establish connection with the Redis server.
        """
        try:
            # Try to connect and ping
            client = aioredis.from_url(
                self.redis_url, 
                encoding="utf-8", 
                decode_responses=True,
                socket_connect_timeout=2.0
            )
            await client.ping()
            self.redis_client = client
            self.use_fallback = False
            logger.info("Redis cache service connected successfully at %s", self.redis_url)
        except Exception as exc:
            self.use_fallback = True
            self.redis_client = None
            logger.warning(
                "Redis connection failed: %s. Falling back to local in-memory caching.", 
                exc
            )

    async def _ensure_connection(self) -> bool:
        """
        Ensure initialized status is complete.
        Returns:
            bool: True if using Redis, False if using in-memory fallback.
        """
        if self._init_task is None:
            self._init_task = asyncio.create_task(self.initialize())
        if not self._init_task.done():
            await self._init_task
        return not self.use_fallback

    async def get_cached_interaction(self, rxcui_pair: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached interaction details for a pair of RxCUIs.

        Args:
            rxcui_pair: Hyphen-separated sorted RxCUIs, e.g., "1191-3498"

        Returns:
            Dict or None: Cached interaction details or None if cache miss.
        """
        is_redis = await self._ensure_connection()
        if is_redis and self.redis_client:
            try:
                cached_data = await self.redis_client.get(f"interaction:{rxcui_pair}")
                if cached_data:
                    logger.info("Cache hit (Redis) for RxCUI pair: %s", rxcui_pair)
                    return json.loads(cached_data)
            except Exception as exc:
                logger.warning("Error reading from Redis cache: %s. Switching to fallback.", exc)
                self.use_fallback = True

        # Fallback to local memory cache
        async with self._memory_cache_lock:
            cached_data = self._memory_cache.get(rxcui_pair)
            if cached_data:
                logger.info("Cache hit (In-Memory Fallback) for RxCUI pair: %s", rxcui_pair)
                return json.loads(cached_data)

        logger.info("Cache miss for RxCUI pair: %s", rxcui_pair)
        return None

    async def set_cached_interaction(self, rxcui_pair: str, data: Dict[str, Any], ttl: int = 86400) -> None:
        """
        Cache interaction details for a pair of RxCUIs with an optional expiration time.

        Args:
            rxcui_pair: Hyphen-separated sorted RxCUIs, e.g., "1191-3498"
            data: Dictionary containing interaction details
            ttl: Time-To-Live in seconds (default: 86400 / 24 hours)
        """
        is_redis = await self._ensure_connection()
        serialized_data = json.dumps(data)

        if is_redis and self.redis_client:
            try:
                await self.redis_client.set(f"interaction:{rxcui_pair}", serialized_data, ex=ttl)
                logger.info("Successfully cached pair %s in Redis (TTL: %ds)", rxcui_pair, ttl)
                return
            except Exception as exc:
                logger.warning("Failed to write to Redis cache: %s. Writing to fallback instead.", exc)
                self.use_fallback = True

        # Fallback to local memory cache
        async with self._memory_cache_lock:
            self._memory_cache[rxcui_pair] = serialized_data
            logger.info("Successfully cached pair %s in local memory fallback", rxcui_pair)

    async def close(self) -> None:
        """
        Gracefully close Redis connections on shutdown.
        """
        if self.redis_client:
            try:
                await self.redis_client.close()
                logger.info("Redis connection closed gracefully.")
            except Exception as exc:
                logger.warning("Error closing Redis connection: %s", exc)


# Singleton instance
cache_service = CacheService()
