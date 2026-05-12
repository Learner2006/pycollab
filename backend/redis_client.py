# redis_client.py
import redis.asyncio as aioredis
import os

redis = None

async def init_redis():
    global redis
    redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

def get_redis():
    return redis