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
