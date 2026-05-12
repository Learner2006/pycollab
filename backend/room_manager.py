# room_manager.py — Room lifecycle + state management
import time

# In-memory state
users_in_room = {}   # room_id -> [(sid, username)]
room_names = {}      # room_id -> room_name
user_colors = {}     # sid -> color
sid_user = {}        # sid -> username
last_run_time = {}   # room_id -> timestamp

COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80',
          '#34d399', '#22d3ee', '#818cf8', '#e879f9']
MAX_ROOMS = 50
MAX_USERS = 5
RATE_LIMIT_SECONDS = 3


def create_room(room_id: str, room_name: str) -> dict:
    if len(room_names) >= MAX_ROOMS:
        return {"error": "Server full — max 50 rooms allowed!"}
    room_names[room_id] = room_name
    return {"room_id": room_id, "room_name": room_name}


def room_exists(room_id: str) -> dict:
    return {
        "exists": room_id in room_names,
        "room_name": room_names.get(room_id, room_id)
    }


def add_user(room_id: str, sid: str, username: str) -> dict:
    if room_id not in users_in_room:
        users_in_room[room_id] = []

    if len(users_in_room[room_id]) >= MAX_USERS:
        return {"error": f"Room full — max {MAX_USERS} users allowed!"}

    users_in_room[room_id].append((sid, username))
    sid_user[sid] = username

    used_colors = set(user_colors.values())
    available = [c for c in COLORS if c not in used_colors]
    user_colors[sid] = available[0] if available else COLORS[len(user_colors) % len(COLORS)]

    return {"color": user_colors[sid]}


def remove_user(sid: str) -> dict:
    room = None
    for room_id, users in users_in_room.items():
        if any(s == sid for s, _ in users):
            room = room_id
            break

    if not room:
        return {"room": None}

    users_in_room[room] = [(s, u) for s, u in users_in_room[room] if s != sid]
    user_colors.pop(sid, None)
    sid_user.pop(sid, None)

    return {"room": room}


def get_user_list(room_id: str) -> list:
    return [
        {"username": u, "color": user_colors.get(s, "#ccc")}
        for s, u in users_in_room.get(room_id, [])
    ]


def is_rate_limited(room_id: str) -> bool:
    now = time.time()
    if room_id in last_run_time and now - last_run_time[room_id] < RATE_LIMIT_SECONDS:
        return True
    last_run_time[room_id] = now
    return False


async def cleanup_empty_rooms():
    import asyncio
    while True:
        await asyncio.sleep(300)
        empty = [r for r, u in users_in_room.items() if len(u) == 0]
        for room_id in empty:
            room_names.pop(room_id, None)
            users_in_room.pop(room_id, None)