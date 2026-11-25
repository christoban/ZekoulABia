import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Connexion Socket.io partagée (un seul socket par onglet, réutilisé par tous les composants
 * qui en ont besoin) — cible directement l'origine du backend (NEXT_PUBLIC_API_URL), pas le
 * proxy Next.js `rewrites()` qui ne couvre que /api/v2/* en HTTP, pas les upgrades WebSocket.
 * L'authentification se fait via le cookie access_token (withCredentials), voir socket/io.ts
 * côté backend.
 */
export function getNotificationSocket(): Socket {
  if (socket) {
    if (socket.connected) {
      socket.emit('auth:refresh')
    }
    return socket
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  socket = io(backendUrl, {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
  })

  socket.on('connect', () => {
    socket?.emit('auth:refresh')
  })

  return socket
}

export function resetNotificationSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

