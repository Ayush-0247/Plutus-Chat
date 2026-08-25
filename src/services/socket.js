import { io } from 'socket.io-client';

let socket = null;

// In production, the Express server serves the frontend from the same origin,
// so we connect to window.location.origin. In development, we use localhost:3000.
// Set VITE_SERVER_URL to override (e.g. for separate frontend/backend deployments).
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
