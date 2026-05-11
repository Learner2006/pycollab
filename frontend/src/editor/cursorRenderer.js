// editor/cursorRenderer.js
// Handles remote cursor and text selection rendering using Monaco decorations and Yjs awareness states.
export function getAwarenessStates(provider) {
  return provider.awareness.getStates()
}

export function initCursorRenderer(editor, monaco, provider) {
  let decorationIds = []
  const decorationsMap = {} // Maps client IDs to injected cursor style elements

  editor.onDidChangeCursorPosition((e) => {
    provider.awareness.setLocalStateField('cursor', {
      lineNumber: e.position.lineNumber,
      column: e.position.column,
    })
  })
  
  editor.onDidChangeCursorSelection((e) => {
    const sel = e.selection
    const isEmpty =
      sel.startLineNumber === sel.endLineNumber &&
      sel.startColumn === sel.endColumn

    provider.awareness.setLocalStateField('selection', isEmpty ? null : {
      startLineNumber: sel.startLineNumber,
      startColumn: sel.startColumn,
      endLineNumber: sel.endLineNumber,
      endColumn: sel.endColumn,
    })
  })

  provider.awareness.on('change', ({ removed }) => {
    removed.forEach((clientId) => {
      if (decorationsMap[clientId]) {
        decorationsMap[clientId].remove()
        delete decorationsMap[clientId]
      }
    })

    const states = provider.awareness.getStates()
    const newDecorations = []

    states.forEach((state, clientId) => {
      if (clientId === provider.awareness.clientID) return
      if (!state.cursor || !state.user) return

      newDecorations.push({
        range: new monaco.Range(
          state.cursor.lineNumber,
          state.cursor.column,
          state.cursor.lineNumber,
          state.cursor.column + 1
        ),
        options: {
          className: `remote-cursor-${clientId}`,
          beforeContentClassName: `remote-cursor-caret-${clientId}`,
          hoverMessage: { value: state.user.name },
        }
      })
      if (state.selection) {
        newDecorations.push({
          range: new monaco.Range(
            state.selection.startLineNumber,
            state.selection.startColumn,
            state.selection.endLineNumber,
            state.selection.endColumn
          ),
          options: {
            className: `remote-selection-${clientId}`,
          }
        })
      }

      if (!decorationsMap[clientId]) {
        const style = document.createElement('style')
        style.innerHTML = `
          .remote-cursor-${clientId} {
            border-left: 2px solid ${state.user.color};
          }
          .remote-cursor-caret-${clientId}::before {
            content: '${state.user.name}';
            background: ${state.user.color};
            color: #000;
            font-size: 10px;
            padding: 1px 4px;
            border-radius: 3px;
            position: absolute;
            top: -18px;
            white-space: nowrap;
            pointer-events: none;
          }
          .remote-selection-${clientId} {
            background: ${state.user.color}33;
     }
        `
        document.head.appendChild(style)
        decorationsMap[clientId] = style
      }
    })
    setTimeout(() => {
      decorationIds = editor.deltaDecorations(decorationIds, newDecorations)
    }, 0)
  })
}