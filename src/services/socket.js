import { io } from 'socket.io-client';

let socket = null;


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
