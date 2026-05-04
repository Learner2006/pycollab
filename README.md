# 🧠 PyCollab — Real-Time Collaborative Coding Sandbox

<div align="center">

### ⚡ Multiplayer Python Coding — Real-time. No friction. Pure chaos.

</div>

---

## 🚀 What is PyCollab?

PyCollab is a real-time multiplayer coding sandbox where multiple users can:

- edit the same Python file together
- see live cursors + updates instantly
- run code in a secure Docker sandbox
- chat while coding in real-time

No login. No setup. Just pure collaborative chaos.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| ⚡ Instant Rooms | Create or join with a link |
| 🧑‍💻 Shared Editor | Monaco Editor + Yjs CRDT sync |
| 🎯 Live Cursors | Color-coded users with labels |
| ▶️ Code Execution | Python runs inside Docker sandbox |
| 📡 Live Output | stdout + stderr broadcast |
| 💬 Chat System | Real-time chat + system messages |
| 🔗 Shareable Rooms | Copy link to invite users |
| 🛡️ Secure Sandbox | No internet + resource limits |
| ♻️ Auto Cleanup | Empty rooms removed automatically |

---

## 🧱 Tech Stack

### Frontend
- React 18  
- Monaco Editor (VS Code engine)  
- Yjs + y-monaco (CRDT sync)  
- Socket.IO client  
- Tailwind CSS  

### Backend
- FastAPI  
- Socket.IO (async)  
- Python 3.11  

### Execution Layer
- Docker (python:3.11-slim)  
- 10s timeout kill switch  
- 128MB RAM limit  
- No network access  
- Non-root execution  

---

## 📁 Project Structure


```
pycollab/
│
├── backend/
│   ├── main.py              # FastAPI app, CORS, /create-room, /room-exists, Socket.IO mount
│   ├── websocket.py         # Socket.IO namespace, all event handlers (join, run, chat, Yjs)
│   ├── room_manager.py      # In-memory room state, user colors, rate limiting, cleanup
│   └── executor.py          # Docker sandbox — runs Python code, enforces limits
│
├── frontend/
│   └── src/
│       ├── App.jsx              # React Router — / and /room/:roomId
│       ├── main.jsx             # ReactDOM entry point
│       ├── utils.js             # BACKEND url, showToast(), generateRoomName()
│       ├── websocket.js         # initYjs() + initUserSocket() — Socket.IO setup
│       ├── pages/
│       │   ├── Home.jsx         # Create room / Join room UI
│       │   └── Room.jsx         # Main workspace — editor, output, chat, header
│       └── editor/
│           ├── Editor.jsx       # Monaco + MonacoBinding + Yjs + cursor init
│           ├── Chat.jsx         # Realtime chat sidebar with system messages
│           ├── OutputConsole.jsx# stdout (green) / stderr (red) display panel
│           └── cursorRenderer.js# Remote cursor decorations via Monaco + awareness
│
└── README.md
```
 


---

## ⚙️ How It Works

### 1. Room System
- create room → unique ID generated  
- share link → others join instantly  
- max 5 users per room  

---

### 2. Real-Time Sync
- Yjs CRDT handles conflict-free editing  
- every keystroke syncs instantly  
- no locks, no merge conflicts  

---

### 3. Code Execution Flow


User clicks RUN
↓
Backend receives code
↓
Docker container starts
↓
Code executed in isolation
↓
stdout / stderr captured
↓
Broadcast to all users


---

## 🛡️ Sandbox Security

- No internet access  
- 10s execution timeout  
- 128MB RAM limit  
- 50% CPU cap  
- Temporary filesystem only  
- Non-root container user  

---

## 🔌 Socket Events

### Client → Server
- join  
- run_code  
- chat_message  
- yjs_update  

### Server → Client
- execution_result  
- chat_message  
- update_users  
- room_full  

---

## 🧠 Design Philosophy

PyCollab is not an IDE.

It is a shared chaos space where:

- code is temporary  
- collaboration is real-time  
- mistakes are visible instantly  

---

## 🗺️ Roadmap

### v1 — DONE
- real-time editor sync  
- docker execution sandbox  
- chat system  
- live cursors  
- room system  

### v2 — NEXT
- Redis persistence  
- multi-language support  
- session replay  
- code history timeline  
- scaling multi-server rooms  

---

## 📜 License

MIT © 2026

---

<div align="center">

**Built fast. Built chaotic. Built to break.**

</div>