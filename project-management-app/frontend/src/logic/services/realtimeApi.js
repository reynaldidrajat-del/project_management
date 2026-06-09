import { io } from 'socket.io-client';

let socket = null;

const getDefaultRealtimeUrl = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.origin;
};

const getRealtimeUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '');
  }

  return getDefaultRealtimeUrl();
};

// Membuat satu koneksi Socket.IO bersama berdasarkan token session login.
export const connectRealtimeSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socket?.auth?.token === token) {
    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(getRealtimeUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socket;
};

export const getRealtimeSocket = () => socket;

export const disconnectRealtimeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const emitRealtimeEvent = (eventName, payload, ack) => {
  if (!socket || !eventName) {
    return;
  }

  socket.emit(eventName, payload, ack);
};
