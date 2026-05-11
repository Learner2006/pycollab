// editor/Editor.jsx
// Monaco editor integration with Yjs collaboration,
// remote cursor rendering, keyword activity tracking,
// runtime error highlighting, and reaction overlays.
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { initCursorRenderer } from './cursorRenderer'
import { useEffect, useRef } from 'react'

export default function CodeEditor({ yjsRef, onReady, reactions = [], errorLine, onKeyword, followingUser }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const errorDecoIds = useRef([])
  const followingUserRef = useRef(followingUser)

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    if (!errorLine) {
      errorDecoIds.current = editor.deltaDecorations(errorDecoIds.current, [])
      return
    }

    editor.revealLineInCenter(errorLine)

    errorDecoIds.current = editor.deltaDecorations(errorDecoIds.current, [{
      range: new monaco.Range(errorLine, 1, errorLine, 1),
      options: {
        isWholeLine: true,
        className: 'error-line-highlight',
        glyphMarginClassName: 'error-glyph',
        overviewRuler: { color: '#f87171', position: 1 },
      }
    }])
  }, [errorLine])

  useEffect(() => {
    followingUserRef.current = followingUser
    }, [followingUser])

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor
    monacoRef.current = monaco

    const { ytext, provider } = yjsRef.current

    // Bind Monaco + Yjs
    new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    )

    const KEYWORDS = [
      'def',
      'class',
      'import',
      'for',
      'while',
      'if',
      'elif',
      'else',
      'try',
      'except',
      'with',
      'return',
      'lambda'
    ]

    // Tracks currently existing keywords
    let previousKeywords = new Set()

    // Observe collaborative document changes
    ytext.observe(() => {
      const code = ytext.toString()

      const currentKeywords = new Set()

      // Find all keywords currently present
      KEYWORDS.forEach(kw => {
        const pattern = new RegExp(`\\b${kw}\\b`)

        if (pattern.test(code)) {
          currentKeywords.add(kw)
        }
      })
 
      // Detect added keywords
      currentKeywords.forEach(kw => {
        if (!previousKeywords.has(kw)) {

          onKeyword?.({
            type: 'added',
            keyword: kw,
            timestamp: Date.now()
          })
        }
      })

      // Detect removed keywords
      previousKeywords.forEach(kw => {
        if (!currentKeywords.has(kw)) {

          onKeyword?.({
            type: 'removed',
            keyword: kw,
            timestamp: Date.now()
          })
        }
      })

      // Update previous snapshot
      previousKeywords = currentKeywords
    })

  // Initial placeholder
  setTimeout(() => {
    if (ytext.toString().trim() === '') {
      ytext.insert(0, '# Start coding here...')
    }
  }, 500)

  // Collaborative cursors
  initCursorRenderer(editor, monaco, provider)

  provider.awareness.on('change', () => {
    if (!followingUserRef.current) return
    const states = provider.awareness.getStates()
    states.forEach((state) => {
      if (state.user?.name === followingUserRef.current && state.cursor) {
        editor.revealLineInCenter(state.cursor.lineNumber)
      }
    })
  })
  onReady(editor)
}

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);      opacity: 1; }
          80%  { transform: translateY(-220px) scale(1.4); opacity: 0.8; }
          100% { transform: translateY(-280px) scale(0.9); opacity: 0; }
        }
        .error-line-highlight {
          background: rgba(248, 113, 113, 0.08) !important;
          border-left: 3px solid #f87171;

        }
        .error-glyph::before {
          content: '●';
          color: #f87171;
          font-size: 12px;
        }
      `}</style>
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue=""
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={null}
      />

      {/* Floating reactions overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {reactions.map(r => (
          <span key={r.id} style={{
            position: 'absolute',
            bottom: '20px',
            left: `${r.x}%`,
            fontSize: '28px',
            animation: 'floatUp 2s ease-out forwards',
            pointerEvents: 'none',
            userSelect: 'none'
          }}>{r.emoji}</span>
        ))}
      </div>
    </div>
  )
} 
