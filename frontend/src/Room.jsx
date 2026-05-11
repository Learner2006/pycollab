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
  const seenRoomKeywords = useRef(new Set())

  const [users, setUsers] = useState([])
  const [output, setOutput] = useState(null)
  const [isRunning, setIsRunning] = useState(false)

  const roomName = location.state?.roomName || 'Unnamed Room'
  const username = location.state?.username || 'Anonymous'

  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [reactions, setReactions] = useState([])
  const [errorLine, setErrorLine] = useState(null)
  const [streamLines, setStreamLines] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [activityOpen, setActivityOpen] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [isExplaining, setIsExplaining] = useState(false)
  const [followingUser, setFollowingUser] = useState(null)

  useEffect(() => {
    yjsRef.current = initYjs(roomId)
    const { socket: ySocket, provider } = yjsRef.current

    provider.awareness.setLocalStateField('user', { name: username, color: '#ffffff' })
    
    const saveInterval = setInterval(() => {
      if (editorRef.current && userSocketRef.current?.connected) {
        userSocketRef.current.emit('save_code', { code: editorRef.current.getValue() })
      }
    }, 30000)
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
      onExecutionStart: () => {
        setIsRunning(true)
        setOutput(null)
        setErrorLine(null)
        setStreamLines([])
      },
      onExecutionResult: (data) => {
        setOutput(data)
        setIsRunning(false)
        setErrorLine(data.errorLine || null)
      },
      onExecutionStdout: (data) => {
        setStreamLines(prev => {
          const updated = [...prev, ...data.lines]
          return updated.slice(-300)
        })
      },
      onChatMessage: (data) => {
        setMessages(prev => [...prev, data])
        if (!chatOpenRef.current && data.username !== username) setUnreadCount(prev => prev + 1)
      },
      onKeywordActivity: (data) => {
        setActivityLog(prev => {
        // ADD keyword
        if (data.type === 'added') {
          const exists = prev.some(e => e.keyword === data.keyword)
          if (exists) return prev
          return [...prev, data]
        }
        if (data.type === 'removed') {
          return prev.filter(e => e.keyword !== data.keyword)
        }
        return prev
       })
      },
      onReaction: (data) => {
        const id = Math.random().toString(36).slice(2)
        setReactions(prev => [...prev, { id, emoji: data.emoji, x: 10 + Math.random() * 80 }])
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2000)
      },
      onRestoreCode: (data) => {
        if (yjsRef.current && data.code) {
          const ytext = yjsRef.current.ytext
          if (ytext.toString().trim() === '' || ytext.toString().trim() === '# Start coding here...') {
            ytext.delete(0, ytext.length)
            ytext.insert(0, data.code)
          }
        }
      }
    })

    userSocketRef.current = userSocket

    return () => {
      clearInterval(saveInterval)
      userSocket.disconnect()
      ySocket.disconnect()
    }
  }, [roomId])

  async function handleRun() {
    if (isRunning) return
    if (!editorRef.current) return
    const code = editorRef.current.getValue()
    if (!code.trim()) return showToast('Empty code! Write some code first.', 'warn')
    const socket = userSocketRef.current
    if (!socket.connected) return showToast('Unable to connect to server.', 'error')
    setOutput(null)       // ✅ add karo
    setStreamLines([])    // ✅ add karo
    setIsRunning(true)   
    socket.emit('run_code', { code, room_id: roomId })
  }
  async function handleExplain(code) {
    if (!code.trim()) return showToast('Stop messing!', 'warn')
    setExplainOpen(true)
    setExplanation('')
    setIsExplaining(true)

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          stream: true,
          messages: [{
            role: 'user',
            content: `You are a Python tutor for beginners. Explain this Python code in simple terms. Be concise and friendly:\n\n\`\`\`python\n${code}\n\`\`\``
          }]
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6))
            if (json.choices?.[0]?.delta?.content) {
              setExplanation(prev => prev + json.choices[0].delta.content)
            }
          } catch {}
        }
     }
    } catch (e) {
      setExplanation('Error fetching explanation.')
    } finally {
      setIsExplaining(false)
    }
  }

  function handleReaction(emoji) {
    userSocketRef.current?.emit('reaction', { emoji })
  }


  return (
   <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e' }}>

     {/* Header */}
     <div style={{ background: '#2d2d2d', color: 'white', padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <div>
         <div>{roomName} • {roomId}</div>
         <div style={{ fontSize: '12px', display: 'flex', gap: '8px' }}>
           {users.map((u, i) => (
              u.username === username? (
                <span key={i} style={{ color: u.color, fontWeight: 'bold' }}>● {u.username}</span>
              ) : (
                <span key={i} style={{ color: u.color, fontWeight: 'bold', cursor: 'pointer', textDecoration: followingUser === u.username ? 'underline' : 'none' }}
                  onClick={() => setFollowingUser(prev => prev === u.username ? null : u.username)}
                >● {u.username}</span>
              ) 
            ))}
         </div>
           {/* ✅ Following indicator here */}
           {followingUser && (
             <div style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
               Following {followingUser}
               <span onClick={() => setFollowingUser(null)} style={{ cursor: 'pointer', color: '#f87171' }}>✕</span>
             </div>
           )}
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
           onClick={() => {
             const selected = editorRef.current?.getModel()
               .getValueInRange(editorRef.current.getSelection())
             handleExplain(selected || editorRef.current?.getValue() || '')
           }}
           style={{ padding: '8px 12px', background: explainOpen ? '#444' : 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer' }}
         >🤖 Explain</button>
         <button
           onClick={() => {setChatOpen(prev => {chatOpenRef.current = !prev
             return !prev}) 
             setUnreadCount(0) }}
           style={{ position: 'relative', padding: '8px 12px', background: chatOpen ? '#444' : 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '16px', cursor: 'pointer' }}
         >💬
           {unreadCount > 0 && (
             <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'red', color: 'white', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
               {unreadCount}
             </span>
           )}
         </button>
         <button
           onClick={() => setActivityOpen(prev => !prev)}
            style={{ position: 'relative', padding: '8px 12px', background: activityOpen ? '#444' : 'transparent', border: '1px solid #555', borderRadius: '6px', color: 'white', fontSize: '16px', cursor: 'pointer' }}
         >📋</button>
       </div>
     </div>

     {/* Body */}
     <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
 
       {/* Left — Editor + Output */}
       <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
         <CodeEditor yjsRef={yjsRef} onReady={(editor) => editorRef.current = editor} reactions={reactions} errorLine={errorLine} onKeyword={(data) => userSocketRef.current?.emit('keyword_activity', data)} followingUser={followingUser} />
         <OutputConsole output={output} streamLines={streamLines} />
       </div>

       {/* Right — Chat */}

       {chatOpen && (
         <>
           <div style={{ width: '1px', background: '#333' }} />
           <Chat socket={userSocketRef.current} username={username} users={users} messages={messages} />
         </>
       )}
       {activityOpen && (
          <>
            <div style={{ width: '1px', background: '#333' }} />
            <div style={{ width: '220px', background: '#1a1a1a', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #333', fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Activity
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityLog.length === 0 && (
                <div style={{ color: '#444', fontSize: '12px' }}>No activity yet...</div>
              )}
              {activityLog.map((entry, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.5 }}>
                  <span style={{ color: '#f97316', fontFamily: 'monospace' }}>{entry.keyword}</span>
                </div>
              ))}
              </div>
            </div>
          </>
       )}
       {explainOpen && (
          <>
            <div style={{ width: '1px', background: '#333' }} />
            <div style={{ width: '260px', background: '#1a1a1a', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #333', fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🤖 Explain</span>
                <span onClick={() => setExplainOpen(false)} style={{ cursor: 'pointer', color: '#555', fontSize: '16px' }}>✕</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', fontSize: '13px', color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {isExplaining && !explanation && <span style={{ color: '#555' }}>Thinking...</span>}
                {explanation.split('\n').map((line, i) => {
                  const formatted = line
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.*?)`/g, '<code style="background:#2d2d2d;padding:1px 5px;border-radius:3px;color:#f97316">$1</code>')
                  return <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: formatted }} />
                })}
              </div>
            </div>
          </>
       )}
     </div>
   </div>
  )
}
