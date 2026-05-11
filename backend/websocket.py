# websocket.py — Socket.IO namespace + event handlers
import time
import socketio
import re
import asyncio
from redis_client import get_redis
from room_manager import (
    add_user, remove_user, get_user_list,
    is_rate_limited, RATE_LIMIT_SECONDS,
    user_colors, sid_user
)
from executor import stream_python

sid_rooms = {}  # sid -> room_id
running_tasks ={}
def get_room_id(environ) -> str:
    qs = environ.get("QUERY_STRING", "")
    return qs.split("room=")[-1] if "room=" in qs else "default"

def parse_error_line(stderr: str):
    match = re.search(r'line (\d+)', stderr)
    return int(match.group(1)) if match else None

class YjsNamespace(socketio.AsyncNamespace):

    async def on_connect(self, sid, environ):
        room_id = get_room_id(environ)
        sid_rooms[sid] = room_id
        await self.enter_room(sid, room_id)
        print(f"[connect] {sid} → room {room_id}")

    async def on_disconnect(self, sid):
        room= sid_rooms.get(sid)
        if room and room in running_tasks:
            running_tasks[room].cancel()
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

        saved =await get_redis().get(f"room:{room}:code")
        if saved:
            await self.emit("restore_code", {"code": saved.decode()}, to=sid)


    async def on_run_code(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return
        if room in running_tasks:
            running_tasks[room].cancel()
        
        async def _execute():
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
            await sio.emit("execution_start", {}, room=room)

            last_emit = 0
            buffer = []
            async for kind, result in stream_python(code):
                if kind == "stdout":
                    buffer.append(result)
                    now = asyncio.get_event_loop().time()
                    if now - last_emit > 0.05:
                        await sio.emit("execution_stdout", {"lines": buffer}, room=room)
                        buffer = []
                        last_emit = now
                elif kind == "done":
                    if buffer:  
                        await sio.emit("execution_stdout", {"lines": buffer}, room=room)
                    result["errorLine"] = parse_error_line(result.get("stderr", ""))
                    await sio.emit("execution_result", result, room=room)
        task = asyncio.create_task(_execute())
        running_tasks[room] = task
        try:
            await task
        except asyncio.CancelledError:
            pass
        finally:
            running_tasks.pop(room,None)


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

    async def on_reaction(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return
        await self.emit("reaction", {"emoji": data.get("emoji")}, room=room)
    
    async def on_save_code(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return
        await get_redis().set(f"room:{room}:code", data.get("code", ""), ex=86400)

    async def on_keyword_activity(self, sid, data):
        room = sid_rooms.get(sid)
        if not room:
            return
        await self.emit("keyword_activity", {
            "keyword": data.get("keyword"),
            "type": data.get("type"),
            "timestamp": time.time()
        }, room=room)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', transports=['websocket', 'polling'])
sio.register_namespace(YjsNamespace('/'))
