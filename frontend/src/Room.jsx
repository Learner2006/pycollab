// pages/Room.jsx — Main workspace
import { useEffect, useState, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import CodeEditor from './editor/Editor'
import OutputConsole from './editor/OutputConsole'
import { initYjs, initUserSocket } from './websocket'
import { showToast, BACKEND } from './utils'
import Chat from './editor/Chat'

export default function Room() {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const editorRef = useRef(null)
  const yjsRef = useRef(null)
  const userSocketRef = useRef(null)
  const chatOpenRef = useRef(true)

  const [users, setUsers] = useState([])
  const [output, setOutput] = useState(null)
  const [isRunning, setIsRunning] = useState(false)

  const roomName = location.state?.roomName || 'Unnamed Room'
  const username = location.state?.username || 'Anonymous'

  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    yjsRef.current = initYjs(roomId)
    const { socket: ySocket, provider } = yjsRef.current

    provider.awareness.setLocalStateField('user', { name: username, color: '#ffffff' })

    const userSocket = initUserSocket(roomId, username, {
      onUpdateUsers: (data) => {
        setUsers(data)
        const me = data.find(u => u.username === username)
        if (me && yjsRef.current) {
          yjsRef.current.provider.awareness.setLocalStateField('user', {
            name: username,
            color: me.color
          })
        }
      },
      onRoomFull: (data) => {
        showToast(data.message, 'error')
        navigate('/')
      },
      onExecutionResult: (data) => {
        setOutput(data)
        setIsRunning(false)
      },
      onChatMessage: (data) => {
        setMessages(prev => [...prev, data])
        if (!chatOpenRef.current && data.username !== username) setUnreadCount(prev => prev + 1)
      }

    })

    userSocketRef.current = userSocket

    return () => {
      userSocket.disconnect()
      ySocket.disconnect()
    }
  }, [roomId])

  async function handleRun() {
    if (isRunning) return
    if (!editorRef.current) return
    const code = editorRef.current.getValue()
    if (!code.trim()) return showToast('Code likho pehle!', 'warn')
    setIsRunning(true)
    setOutput(null)
    const socket = userSocketRef.current
    if (!socket.connected) return showToast('Server se connected nahi ho!', 'error')
    socket.emit('run_code', { code, room_id: roomId })
  }


  return (
   <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e' }}>

     {/* Header */}
     <div style={{ background: '#2d2d2d', color: 'white', padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <div>
         <div>{roomName} • {roomId}</div>
         <div style={{ fontSize: '12px', display: 'flex', gap: '8px' }}>
           {users.map((u, i) => (
             <span key={i} style={{ color: u.color, fontWeight: 'bold' }}>● {u.username}</span>
           ))}
         </div>
       </div>
       <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
         <button
           onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`).then(() => showToast('Link copied! 🔗'))}
           style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer' }}
         >🔗 Share</button>
         <button
           onClick={handleRun}
           disabled={isRunning}
           style={{ padding: '8px 20px', background: isRunning ? '#555' : '#22c55e', border: 'none', borderRadius: '6px', color: 'white', fontSize: '14px', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
         >{isRunning ? '⏳ Running...' : '▶ Run'}</button>
         <button
           onClick={() => {setChatOpen(prev => {chatOpenRef.current = !prev
             return !prev}) 
             setUnreadCount(0) }}
           style={{ padding: '8px 12px', background: chatOpen ? '#444' : 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '16px', cursor: 'pointer' }}
         >💬
           {unreadCount > 0 && (
             <span style={{ position: 'absolute', top: '8px', right: '13px', background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
               {unreadCount}
             </span>
           )}
         </button>
       </div>
     </div>

     {/* Body */}
     <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
 
       {/* Left — Editor + Output */}
       <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
         <CodeEditor yjsRef={yjsRef} onReady={(editor) => editorRef.current = editor} />
         <OutputConsole output={output} />
       </div>

       {/* Right — Chat */}
       {chatOpen && (
         <>
           <div style={{ width: '1px', background: '#333' }} />
           <Chat socket={userSocketRef.current} username={username} users={users} messages={messages} />
         </>
       )}

     </div>
   </div>
  )
}
