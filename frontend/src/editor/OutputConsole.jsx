// editor/OutputConsole.jsx
// Handles real-time execution output streaming, auto-scrolling,
// and error rendering for the collaborative code runner.
import { useEffect, useRef, useState } from 'react'

export default function OutputConsole({ output, streamLines }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [streamLines])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  return (
    <div style={{ height: '200px', background: '#0d0d0d', borderTop: '1px solid #333', padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', overflowY: 'auto' }}>
      <div style={{ color: '#666', marginBottom: '4px', fontSize: '11px' }}>OUTPUT</div>
      {!output && streamLines.length === 0 && (
        <div style={{ color: '#444' }}>Run code to see output...</div>
      )}
      {streamLines.map((line, i) => (
        <pre key={i} style={{ margin: 0, color: '#4ade80' }}>{line}</pre>
      ))}
      {output?.stderr && (
        <pre style={{ margin: 0, color: '#f87171' }}>{output.stderr}</pre>
      )}
      <div ref={bottomRef} />
    </div>
  )
}