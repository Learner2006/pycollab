import Editor from '@monaco-editor/react'
import { io } from 'socket.io-client'
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'
import { SocketIOProvider } from 'y-socket.io'
import { useEffect, useState, useRef } from 'react'
import { Routes, Route, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'

// Constants
const ADJECTIVES = ['Purple', 'Silent', 'Cosmic', 'Rusty', 'Lazy', 'Spicy', 'Frozen', 'Golden']
const ANIMALS = ['Fox', 'Panda', 'Shark', 'Llama', 'Penguin', 'Raccoon', 'Otter', 'Cobra']
const BACKEND = 'http://localhost:8000'  // single place to change URL

// Toast utility
function showToast(msg, type = 'success') {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    padding:10px 18px; border-radius:8px; font-size:14px;
    color:white; opacity:0; transition:opacity 0.3s;
    background:${type === 'error' ? '#ef4444' : type === 'warn' ? '#f97316' : '#22c55e'};
  `
  document.body.appendChild(t)
  requestAnimationFrame(() => t.style.opacity = 1)
  setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300) }, 2500)
}

function generateRoomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj} ${animal}`
}

// RoomJoin -- Home screen 
function RoomJoin() {
  const [inputVal, setInputVal] = useState('')
  const [username, setUsername] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const roomFromUrl = searchParams.get('room')
    if (roomFromUrl) setInputVal(roomFromUrl)
  }, [])

  async function handleCreate() {
    if (!username.trim()) return showToast('Apna naam daalo!','warn')
    const room = crypto.randomUUID().slice(0, 8)
    const roomName = generateRoomName()
    try{
      const res = await fetch(`${BACKEND}/create-room`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ room_id: room, room_name: roomName })})
      const data = await res.json()
      if (data.error) return showToast(data.error, 'error')
  } catch (e) {
    return showToast('Server se connect nahi ho pa raha!','error')
  }
    navigate(`/room/${room}`, { state: { roomName, username: username.trim() } })
  }

  async function handleJoin() {
    if (!username.trim()) return showToast('Apna naam daalo!','warn')
    if (!inputVal.trim()) return showToast('Room ID daalo!','warn')
    try {
      const res = await fetch(`${BACKEND}/room-exists/${inputVal.trim()}`)
      const data = await res.json()
      if (!data.exists) return showToast('Room not found!','error')
      navigate(`/room/${inputVal.trim()}`, {
        state: { roomName: data.room_name, username: username.trim() }
    })
  } catch (e) {
    showToast('Server se connect nahi ho pa raha!','error')
 }
}
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: 'white', gap: '12px' }}>
      <h2>PyCollab</h2>
      <input placeholder="Enter your name" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '8px 12px', fontSize: '16px', borderRadius: '6px', border: 'none', width: '280px' }} /> 
      <button onClick={handleCreate} style={{ padding: '10px 24px', background: '#f97316', border: 'none', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}>
      ⚡ Create Room
      </button>
      <input placeholder="Enter Room ID to join" value={inputVal} onChange={e => !searchParams.get('room') && setInputVal(e.target.value)} readOnly={!!searchParams.get('room')} style={{ padding: '8px 12px', fontSize: '16px', borderRadius: '6px', border: 'none', width: '280px' }} />
      <button onClick={handleJoin} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer' }}>
        → Join Room
      </button>
    </div>
  )
}
// CollabEditor -- Main editor screen
function CollabEditor() {
  const { roomId } = useParams()
  const location = useLocation()
  const editorRef = useRef(null)
  const yjsRef = useRef(null)
  const userSocketRef = useRef(null)
  const [users, setUsers] = useState([]);
  const [output, setOutput] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  
  const navigate = useNavigate()
  const roomName = location.state?.roomName || 'Unnamed Room'
  const username = location.state?.username || "Anonymous"

  // Init Yjs + Socket.IO and register all event listeners
  useEffect(() => {
    // ✅ YJS (unchanged)
    yjsRef.current = initYjs(roomId)
    const { socket: ySocket, provider } = yjsRef.current

    // awareness (cursor etc.)
    const color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
    provider.awareness.setLocalStateField('user', { name: username, color })

    // ✅ NEW SOCKET (for users)
    const userSocket = io(`${BACKEND}?room=${roomId}`)
    userSocketRef.current = userSocket

    userSocket.on("connect", () => {
      console.log("✅ user socket connected")
      userSocket.emit("join", { username, room_id: roomId })
    })

    userSocket.on("update_users", (data) => {
      console.log("👥 USERS:", data)
      setUsers(data)
    })

    userSocket.on("room_full", (data) => {
      showToast(data.message, 'error')
      navigate('/')
    })

    // YJS execution result (same as before)
    userSocketRef.current.on("execution_result", (data) => {
      setOutput(data)
      setIsRunning(false)
    })

    return () => {
      userSocket.disconnect()
      ySocket.disconnect()
    }
  }, [roomId])

function initYjs(roomId) {
  const ydoc = new Y.Doc()
  const provider = new SocketIOProvider(BACKEND, roomId, ydoc, { autoConnect: true, resyncInterval: 5000, gcEnabled: false })
  const socket = provider.socket  // ✅ correct socket
  const ytext = ydoc.getText('monaco')

  socket.on("connect", () => {
    socket.emit("sync_request", { room_id: roomId })
  })
  return { ydoc, socket, provider, ytext }
}

  function handleEditorMount(editor) {
    editorRef.current = editor
    const { ytext, provider } = yjsRef.current
    new MonacoBinding(ytext, editor.getModel(), new Set([editor]), provider.awareness)

    setTimeout(() => {
      if (ytext.toString().trim() === '') {
        ytext.insert(0, '# Start coding here...')
      }
    }, 500)
  }
  async function handleRun() {
    if (isRunning) return
    if (!editorRef.current) return
    const code = editorRef.current.getValue()
    if (!code.trim()) return showToast('Code likho pehle!','warn')
    setIsRunning(true)
    setOutput(null)
    const socket = userSocketRef.current
    if (!socket.connected) return showToast('Server se connected nahi ho!','error')
    socket.emit("run_code", { code, room_id: roomId })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e' }}>
     
      {/* Header */}
      <div style={{ background: '#2d2d2d', color: 'white', padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div>{roomName} • {roomId}</div>
          <div style={{ fontSize: '12px', display : 'flex', gap: '8px' }}>{users.map((u,i) => (
            <span key={i} style={{ color: u.color, fontWeight: 'bold' }}>
              ● {u.username}
            </span>
          ))} 
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`)
            .then(() => showToast('Link copied! 🔗','success'))
          }}
          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer' }}
        >🔗 Share
        </button>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{ padding: '8px 20px', background: isRunning ? '#555' : '#22c55e', border: 'none', borderRadius: '6px', color: 'white', fontSize: '14px', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {isRunning ? '⏳ Running...' : '▶ Run'}
        </button>        
      </div>
      </div>
      {/* Editor */}
      <div style={{ flex: 1,minHeight: 0}}>
        <Editor
          height="100%"
          defaultLanguage="python"
          defaultValue=""
          onMount={handleEditorMount}
          theme="vs-dark"
          loading={null}
        />
      </div>

      {/* Output Console */}
      <div style={{ height: '200px', background: '#0d0d0d', borderTop: '1px solid #333', padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', overflowY: 'auto' }}>
        <div style={{ color: '#666', marginBottom: '4px', fontSize: '11px' }}>OUTPUT</div>
        {output ? ( <>
          {output.stdout && (
            <pre style={{ margin: 0, color: '#4ade80' }}>{output.stdout} </pre>)}
          {output.stderr && (
            <pre style={{ margin: 0, color: '#f87171' }}>{output.stderr}</pre>)}
          </>
        ) : (
           <div style={{ color: '#444' }}>Run code to see output...</div>
        )}
      </div>
    </div>
  )
}

function App() {
  return(

   <Routes>
      <Route path="/" element={<RoomJoin />} />
      <Route path="/room/:roomId" element={<CollabEditor />} />
    </Routes>
  )
}

export default App