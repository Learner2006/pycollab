// pages/Home.jsx — Create / Join Room
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { showToast, generateRoomName, BACKEND } from './utils'

export default function Home() {
  const [username, setUsername] = useState('')
  const [inputVal, setInputVal] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const roomFromUrl = searchParams.get('room')
    if (roomFromUrl) setInputVal(roomFromUrl)
  }, [])

  async function handleCreate() {
    if (!username.trim()) return showToast('Apna naam daalo!', 'warn')
    const room = crypto.randomUUID().slice(0, 8)
    const roomName = generateRoomName()
    try {
      const res = await fetch(`${BACKEND}/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, room_name: roomName })
      })
      const data = await res.json()
      if (data.error) return showToast(data.error, 'error')
    } catch (e) {
      return showToast('Server se connect nahi ho pa raha!', 'error')
    }
    navigate(`/room/${room}`, { state: { roomName, username: username.trim() } })
  }

  async function handleJoin() {
    if (!username.trim()) return showToast('Apna naam daalo!', 'warn')
    if (!inputVal.trim()) return showToast('Room ID daalo!', 'warn')
    try {
      const res = await fetch(`${BACKEND}/room-exists/${inputVal.trim()}`)
      const data = await res.json()
      if (!data.exists) return showToast('Room not found!', 'error')
      navigate(`/room/${inputVal.trim()}`, {
        state: { roomName: data.room_name, username: username.trim() }
      })
    } catch (e) {
      showToast('Server se connect nahi ho pa raha!', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: 'white', gap: '12px' }}>
      <h2>PyCollab</h2>
      <input
        placeholder="Enter your name"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ padding: '8px 12px', fontSize: '16px', borderRadius: '6px', border: 'none', width: '280px' }}
      />
      <button
        onClick={handleCreate}
        style={{ padding: '10px 24px', background: '#f97316', border: 'none', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
      >⚡ Create Room</button>
      <input
        placeholder="Enter Room ID to join"
        value={inputVal}
        onChange={e => !searchParams.get('room') && setInputVal(e.target.value)}
        readOnly={!!searchParams.get('room')}
        style={{ padding: '8px 12px', fontSize: '16px', borderRadius: '6px', border: 'none', width: '280px' }}
      />
      <button
        onClick={handleJoin}
        style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer' }}
      >→ Join Room</button>
    </div>
  )
}