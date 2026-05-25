import { useEffect } from 'react';

import { connectRealtimeSocket, disconnectRealtimeSocket } from '../../logic/services/realtimeApi';
import { useUiStore } from '../../store/uiStore';

const dispatchRealtimeEvent = (eventName, payload) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(`realtime:${eventName}`, { detail: payload }));
};

const realtimeEvents = [
  'notification.created',
  'task.updated',
  'task.moved',
  'comment.created',
  'comment.read',
  'chat.message.created',
  'chat.message.updated',
  'chat.message.deleted',
  'chat.message.read',
];

// Koneksi realtime global setelah user login. Komponen lain cukup mendengar window event realtime:*.
function RealtimeBridge() {
  const authToken = useUiStore((state) => state.authToken);
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    if (!authToken) {
      disconnectRealtimeSocket();
      return undefined;
    }

    const socket = connectRealtimeSocket(authToken);

    if (!socket) {
      return undefined;
    }

    const handleNotification = (payload) => {
      dispatchRealtimeEvent('notification.created', payload);

      if (payload?.notification?.title) {
        showToast({ type: 'success', message: payload.notification.title });
      }
    };

    socket.on('notification.created', handleNotification);

    realtimeEvents
      .filter((eventName) => eventName !== 'notification.created')
      .forEach((eventName) => {
        socket.on(eventName, (payload) => dispatchRealtimeEvent(eventName, payload));
      });

    socket.on('connect_error', (error) => {
      dispatchRealtimeEvent('realtime.error', { message: error.message });
    });

    return () => {
      realtimeEvents.forEach((eventName) => socket.off(eventName));
      socket.off('notification.created', handleNotification);
      socket.off('connect_error');
    };
  }, [authToken, showToast]);

  return null;
}

export default RealtimeBridge;
