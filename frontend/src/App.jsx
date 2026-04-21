import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { io } from 'socket.io-client'
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'
import { SocketIOProvider } from 'y-socket.io'

//Yjs shared document-- create a shared state for every user
const ydoc = new Y.Doc()

// Socket.IO connection with auto-reconnect
const socket = io('http://localhost:8000', {reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000,})

// Sync the server to Yjs every 5 sec for safety
const provider = new SocketIOProvider('http://localhost:8000', 'test-room', ydoc, socket,{autoConnect: true, resyncInterval: 5000,})

//Shared text -- Read/Write ytext using monaco editor 
const ytext = ydoc.getText('monaco')

function App() {
  const editorRef = useRef(null)
  //Mounting Monaco with Yjs
  function handleEditorMount(editor, monaco) {
    editorRef.current = editor
    // MonacoBinding -- Yjs reflects changes made in editor 
    new MonacoBinding(ytext, editor.getModel(), new Set([editor]), provider.awareness)
  }

  return (
    <div style={{ height: '100vh' }}>
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue="# Start coding here..."
        onMount={handleEditorMount}
        theme="vs-dark"
      />
    </div>
  )
}

export default App