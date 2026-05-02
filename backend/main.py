# Socket.IO server + FastAPI + Yjs sync handler
import os
import socketio
from socketio import AsyncNamespace
import uvicorn
from fastapi import FastAPI
from urllib.parse import parse_qs
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from executor import execute_python
import asyncio
import time

# In-memory state(resets on server restart)
users_in_room = {}
room_names = {}
user_colors ={}
sid_user = {}
COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399', '#22d3ee', '#818cf8', '#e879f9']
RATE_LIMIT_SECONDS = 3
last_run_time = {}  

@asynccontextmanager
async def lifespan(app: FastAPI):
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

sid_rooms = {}  # sid -> room_id mapping

def get_room_id(environ) -> str:
    return environ.get("QUERY_STRING", "").split("room=")[-1] if "room=" in environ.get("QUERY_STRING", "") else "default"

# Yjs sync events handler -- doc get synced between all users
class YjsNamespace(AsyncNamespace):
    async def on_connect(self, sid, environ):
        room_id = get_room_id(environ)
        sid_rooms[sid] = room_id
        await self.enter_room(sid, room_id)   
        print(f"Connected: {sid}")

    async def on_disconnect(self, sid):
        room = sid_rooms.pop(sid, None)

        if not room:
            print(f"[disconnect] sid {sid} had no room — possibly disconnected before join")
            user_colors.pop(sid, None)
            sid_user.pop(sid, None)
            return

        if room in users_in_room:
            users_in_room[room] = [
                (s, u) for (s, u) in users_in_room[room] if s != sid
           ]

            user_colors.pop(sid, None)
            sid_user.pop(sid, None)
            sid_rooms.pop(sid,None)

            user_list = [
                {"username": u, "color": user_colors.get(s, "#ccc")}
                for (s, u) in users_in_room[room]
            ]

            await self.emit("update_users", user_list, room=room)

        print(f"Disconnected: {sid}")

    async def on_join(self, sid, data): 
        room = data.get("room_id")
        username = data.get("username", "Anonymous")

        if not room:
            return
        
        sid_rooms[sid] = room
        await self.enter_room(sid, room)
        sid_user[sid] = username

        if room not in users_in_room:
            users_in_room[room] = []

        if len(users_in_room[room]) >= 5:
            await self.emit("room_full", {"message": "Room full hai — max 5 users allowed!"}, to=sid)
            return

        users_in_room[room].append((sid, username))

        used_colors = set(user_colors.values())
        available = [c for c in COLORS if c not in used_colors]
        user_colors[sid] = available[0] if available else COLORS[len(user_colors) % len(COLORS)]

        user_list = [
            {"username": u, "color": user_colors[s]}
            for (s, u) in users_in_room[room]
        ]

        await self.emit("update_users", user_list, room=room)
 
    async def on_run_code(self, sid, data):
        room = sid_rooms.get(sid)
        print(f"[run_code] Received run_code from sid: {sid}, room: {room}")
        if not room:
            print(f"[run_code] No room found for sid: {sid}")
            return
        
        now = time.time()
        if room in last_run_time and now - last_run_time[room] < RATE_LIMIT_SECONDS:
            await sio.emit("execution_result", {
                "stdout": "",
                "stderr": f"⏳ Rate limit — {RATE_LIMIT_SECONDS} sec baad try karo!",
                "code": 1
        }, room=room)
            return

        last_run_time[room] = now

        code = data.get("code")
        if not code:
            print(f"[run_code] No code received from sid: {sid}")
            return
        print(f"[run_code] Executing for room: {room}")
        result = await execute_python(code)
        await sio.emit("execution_result", result, room=room)

    #Step 1: client state is sent to the server
    async def on_yjs_sync_step1(self, sid, data):
        room_id = sid_rooms.get(sid)
        await self.emit('yjs_sync_step1', data, room=room_id,skip_sid=sid)

    #Step 2: Server gets the state for every client
    async def on_yjs_sync_step2(self, sid, data):
        room_id = sid_rooms.get(sid)
        await self.emit('yjs_sync_step2', data,room=room_id, skip_sid=sid)

    # Every state is broadcasted 
    async def on_yjs_update(self, sid, data):
        room_id = sid_rooms.get(sid)
        print(f"[YJS UPDATE] Room: {room_id}, SID: {sid}")
        await self.emit('yjs_update', data, room=room_id, skip_sid=sid)
        

# ASGI server setup -- CORS is open for everyone
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio.register_namespace(YjsNamespace('/'))
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

MAX_ROOMS = 50
# REST endpoints
@app.post("/create-room")
async def create_room(body: dict):
    room_id = body.get("room_id")
    if not room_id:
        return {"error": "room_id is required"}
    
    if len(room_names) >= MAX_ROOMS:
        return {"error": "Server full hai — max 50 rooms allowed!"}
    
    room_name = body.get("room_name")
    room_names[room_id] = room_name
    return {"room_id": room_id, "room_name": room_name}


@app.get("/room-exists/{room_id}")
async def room_exists(room_id: str):
    exists = room_id in room_names
    return {
        "exists": exists,
        "room_name": room_names.get(room_id, room_id)
    }
async def cleanup_empty_rooms():
    while True:
        await asyncio.sleep(300)  # har 5 min mein
        empty = [
            room_id for room_id, users in users_in_room.items()
            if len(users) == 0
        ]
        for room_id in empty:
            room_names.pop(room_id, None)
            users_in_room.pop(room_id, None)
            print(f"[cleanup] Room removed: {room_id}")


if __name__ == "__main__":
    
    uvicorn.run(sio_app, host="0.0.0.0", port=8000, reload=False)