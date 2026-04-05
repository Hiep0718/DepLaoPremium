import { io, Socket } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const socket: Socket = io(URL, {
  autoConnect: false, // Tự động kết nối khi User Login thành công
});

export const connectSocket = (userId: string) => {
  // Always set up the connect listener to handle reconnects
  socket.off('connect');
  socket.on('connect', () => {
    socket.emit('user_join', userId);
  });

  if (!socket.connected) {
    socket.connect();
  } else {
    // If already connected, emit immediately
    socket.emit('user_join', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// ═══════════ QR Login Socket (unauthenticated) ═══════════
// Separate socket instance for QR login — used on the login page
// before user is authenticated. Does not require user_join.

let qrSocket: Socket | null = null;

export const getQRSocket = (): Socket => {
  if (!qrSocket) {
    qrSocket = io(URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return qrSocket;
};

export const connectQRSocket = (): Socket => {
  const s = getQRSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectQRSocket = () => {
  if (qrSocket) {
    qrSocket.disconnect();
    qrSocket = null;
  }
};
