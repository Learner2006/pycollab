# Socket.IO server + FastAPI + Yjs sync handler

import socketio
from socketio import AsyncNamespace
import uvicorn
from fastapi import FastAPI

# Yjs sync events handler -- doc get synced between all users
class YjsNamespace(AsyncNamespace):
    async def on_connect(self, sid, environ):
        print(f"Connected: {sid}")

    async def on_disconnect(self, sid):
        print(f"Disconnected: {sid}")

    #Step 1: client state is sent to the server
    async def on_yjs_sync_step1(self, sid, data):
        await self.emit('yjs_sync_step1', data, skip_sid=sid)

    #Step 2: Server gets the state for every client
    async def on_yjs_sync_step2(self, sid, data):
        await self.emit('yjs_sync_step2', data, skip_sid=sid)

    # Every state is broadcasted 
    async def on_yjs_update(self, sid, data):
        await self.emit('yjs_update', data, skip_sid=sid)

# ASGI server setup -- CORS is open for everyone
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio.register_namespace(YjsNamespace('/'))
app = FastAPI()
socket_app = socketio.ASGIApp(sio, app)

if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)
