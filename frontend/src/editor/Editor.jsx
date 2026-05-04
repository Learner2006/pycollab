// components/Editor.jsx — Monaco editor + Yjs binding + cursor rendering
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { initCursorRenderer } from './cursorRenderer'

export default function CodeEditor({ yjsRef, onReady }) {

  function handleEditorMount(editor, monaco) {
    const { ytext, provider } = yjsRef.current

    new MonacoBinding(ytext, editor.getModel(), new Set([editor]), provider.awareness)

    setTimeout(() => {
      if (ytext.toString().trim() === '') {
        ytext.insert(0, '# Start coding here...')
      }
    }, 500)

    initCursorRenderer(editor, monaco, provider)
    onReady(editor)
  }

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue=""
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={null}
      />
    </div>
  )
}