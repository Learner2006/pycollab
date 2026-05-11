# main.py — Entry point
import os
import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from room_manager import create_room, room_exists, cleanup_empty_rooms
from websocket import sio
import socketio
from redis_client import init_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    asyncio.create_task(cleanup_empty_rooms())
    yield

app = FastAPI(lifespan=lifespan)

DEV_ORIGIN = "http://localhost:5173"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", DEV_ORIGIN).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.post("/create-room")
async def handle_create_room(body: dict):
    room_id = body.get("room_id")
    if not room_id:
        return {"error": "room_id is required"}
    return create_room(room_id, body.get("room_name", room_id))


@app.get("/room-exists/{room_id}")
async def handle_room_exists(room_id: str):
    result = room_exists(room_id)
    if not result["exists"]:
        from redis_client import get_redis
        saved = await get_redis().get(f"room:{room_id}:code")
        if saved:
            # recreate room in memory
            create_room(room_id, room_id)
            return {"exists": True, "room_name": room_id}
    return result

sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    uvicorn.run(sio_app, host="0.0.0.0", port=8000, reload=False, ws='websockets')