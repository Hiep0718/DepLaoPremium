import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../constants/chatApi';

interface SocketContextData {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  currentUserId: string | null;
  refreshUser: () => Promise<void>;
}

const SocketContext = createContext<SocketContextData>({
  socket: null,
  isConnected: false,
  onlineUsers: [],
  currentUserId: null,
  refreshUser: async () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const initSocket = async () => {
    // Tránh tạo nhiều socket instance
    if (socketRef.current?.connected) return;

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    const storedUserId = await AsyncStorage.getItem('userId');

    // === FIX: Cập nhật currentUserId vào state ngay khi lấy được
    if (storedUserId) {
      setCurrentUserId(storedUserId);
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket Server');
      setIsConnected(true);

      // === FIX: Emit user_join ngay khi kết nối thành công với userId đã có sẵn
      const userId = storedUserId;
      if (userId) {
        newSocket.emit('user_join', userId);
        console.log(`✅ user_join emitted for userId: ${userId}`);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket Server');
      setIsConnected(false);
    });

    // === FIX: Tự động reconnect và emit user_join lại khi socket reconnect
    newSocket.on('reconnect', () => {
      console.log('🔄 Reconnected to WebSocket Server');
      const userId = storedUserId;
      if (userId) {
        newSocket.emit('user_join', userId);
      }
    });

    newSocket.on('user_online', (data: { userId: string; status: string }) => {
      setOnlineUsers(prev => {
        if (!prev.includes(data.userId)) return [...prev, data.userId];
        return prev;
      });
    });

    newSocket.on('user_offline', (data: { userId: string; status: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  useEffect(() => {
    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // refreshUser: Gọi sau khi đăng nhập để sync lại userId và Socket
  const refreshUser = async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
      setCurrentUserId(userId);

      // Nếu socket đã kết nối, emit user_join với userId mới
      if (socketRef.current?.connected) {
        socketRef.current.emit('user_join', userId);
        console.log(`🔄 refreshUser: user_join emitted for userId: ${userId}`);
      } else {
        // Socket chưa kết nối → khởi động lại toàn bộ
        await initSocket();
      }
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers, currentUserId, refreshUser }}>
      {children}
    </SocketContext.Provider>
  );
};
