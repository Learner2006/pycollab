// components/cursorRenderer.js — Remote cursor rendering via Monaco decorations

export function initCursorRenderer(editor, monaco, provider) {
  let decorationIds = []
  const decorationsMap = {}  // clientId -> style element

  editor.onDidChangeCursorPosition((e) => {
    provider.awareness.setLocalStateField('cursor', {
      lineNumber: e.position.lineNumber,
      column: e.position.column,
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
        `
        document.head.appendChild(style)
        decorationsMap[clientId] = style
      }
    })

    decorationIds = editor.deltaDecorations(decorationIds, newDecorations)
  })
}