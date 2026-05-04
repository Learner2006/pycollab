# websocket.py — Socket.IO namespace + event handlers
import time
import socketio
from room_manager import (
    add_user, remove_user, get_user_list,
    is_rate_limited, RATE_LIMIT_SECONDS,
    user_colors, sid_user
)
from executor import execute_python

sid_rooms = {}  # sid -> room_id

def get_room_id(environ) -> str:
    qs = environ.get("QUERY_STRING", "")
    return qs.split("room=")[-1] if "room=" in qs else "default"


class YjsNamespace(socketio.AsyncNamespace):

    async def on_connect(self, sid, environ):
        room_id = get_room_id(environ)
        sid_rooms[sid] = room_id
        await self.enter_room(sid, room_id)
        print(f"[connect] {sid} → room {room_id}")

    async def on_disconnect(self, sid):
        username = sid_user.get(sid, "Anonymous")
        result = remove_user(sid)
        room = result["room"] or sid_rooms.pop(sid, None)

        if room:
            sid_rooms.pop(sid, None)
            await self.emit("update_users", get_user_list(room), room=room)  
            await self.emit("chat_message", { "username": "System", "color": "#888", "message": f"← {username} left the room", "timestamp": time.time(), "system": True }, room=room)

        print(f"[disconnect] {sid}")

    async def on_join(self, sid, data):
        room = data.get("room_id")
        username = data.get("username", "Anonymous")
        if not room:
            return

        sid_rooms[sid] = room
        await self.enter_room(sid, room)

        result = add_user(room, sid, username)
        if "error" in result:
            await self.emit("room_full", {"message": result["error"]}, to=sid)
            return

        await self.emit("update_users", get_user_list(room), room=room)
        await self.emit("chat_message", { "username": "System", "color": "#888", "message": f"→ {username} joined the room", "timestamp": time.time(), "system": True }, room=room)

    async def on_run_code(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return

        if is_rate_limited(room):
            await sio.emit("execution_result", {
                "stdout": "",
                "stderr": f"⏳ Rate limit — Try again in {RATE_LIMIT_SECONDS} seconds.",
                "code": 1
            }, room=room)
            return

        code = data.get("code")
        if not code:
            return

        result = await execute_python(code)
        await sio.emit("execution_result", result, room=room)

    async def on_yjs_sync_step1(self, sid, data):
        room_id = sid_rooms.get(sid)
        await self.emit('yjs_sync_step1', data, room=room_id, skip_sid=sid)

    async def on_yjs_sync_step2(self, sid, data):
        room_id = sid_rooms.get(sid)
        await self.emit('yjs_sync_step2', data, room=room_id, skip_sid=sid)

    async def on_yjs_update(self, sid, data):
        room_id = sid_rooms.get(sid)
        await self.emit('yjs_update', data, room=room_id, skip_sid=sid)

    async def on_chat_message(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return
        username = sid_user.get(sid, "Anonymous")
        color = user_colors.get(sid, "#ccc")
    
        await self.emit("chat_message", {
            "username": username,
            "color": color,
            "message": data.get("message", ""),
            "timestamp": time.time()
        }, room=room)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio.register_namespace(YjsNamespace('/'))
