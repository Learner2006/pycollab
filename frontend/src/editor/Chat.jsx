// editor/Chat.jsx — Realtime chat sidebar
import { useState, useEffect, useRef } from 'react'

export default function Chat({ socket, username, users, messages}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!input.trim()) return
    socket.emit('chat_message', { message: input.trim() })
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSend()
  }

  const myColor = users.find(u => u.username === username)?.color || '#ccc'

  return (
    <div style={{ width: '260px', background: '#1a1a1a', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #333', fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Chat
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ color: '#444', fontSize: '12px' }}>Koi message nahi abhi...</div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.system ?(
                <div style={{ color: '#555', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>
                    {msg.message}
                </div>
            ) : (
                <>
                    <span style={{ color: msg.color, fontSize: '11px', fontWeight: '600' }}>{msg.username} </span>
                    <span style={{ color: '#ccc', fontSize: '13px' }}>{msg.message}</span>
                </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #333', display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '6px 10px', background: '#2d2d2d', border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '13px', outline: 'none' }}
        />
        <button
          onClick={handleSend}
          style={{ padding: '6px 12px', background: '#f97316', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
        >↑</button>
      </div>
    </div>
  )
}