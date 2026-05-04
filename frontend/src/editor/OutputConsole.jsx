// components/OutputConsole.jsx
export default function OutputConsole({ output }) {
  return (
    <div style={{ height: '200px', background: '#0d0d0d', borderTop: '1px solid #333', padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', overflowY: 'auto' }}>
      <div style={{ color: '#666', marginBottom: '4px', fontSize: '11px' }}>OUTPUT</div>
      {output ? (
        <>
          {output.stdout && <pre style={{ margin: 0, color: '#4ade80' }}>{output.stdout}</pre>}
          {output.stderr && <pre style={{ margin: 0, color: '#f87171' }}>{output.stderr}</pre>}
        </>
      ) : (
        <div style={{ color: '#444' }}>Run code to see output...</div>
      )}
    </div>
  )
}