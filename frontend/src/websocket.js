// services/websocket.js — Socket.IO connection + Yjs provider init
import { io } from 'socket.io-client'
import * as Y from 'yjs'
import { SocketIOProvider } from 'y-socket.io'
import { BACKEND } from './utils'

export function initYjs(roomId) {
  const ydoc = new Y.Doc()
  const provider = new SocketIOProvider(BACKEND, roomId, ydoc, {
    autoConnect: true,
    resyncInterval: 5000,
    gcEnabled: false
  })
  const socket = provider.socket
  const ytext = ydoc.getText('monaco')

  socket.on('connect', () => {
    socket.emit('sync_request', { room_id: roomId })
  })

  return { ydoc, socket, provider, ytext }
}

export function initUserSocket(roomId, username, handlers) {
  const socket = io(`${BACKEND}?room=${roomId}`)

  socket.on('connect', () => {
    socket.emit('join', { username, room_id: roomId })
  })

  socket.on('update_users', handlers.onUpdateUsers)
  socket.on('room_full', handlers.onRoomFull)
  socket.on('execution_result', handlers.onExecutionResult)

  socket.on('chat_message', handlers.onChatMessage)
  
  return socket
}