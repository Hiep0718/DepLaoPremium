import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL, chatApiClient } from '../constants/chatApi';

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

  useEffect(() => {
    let newSocket: Socket;

    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;

        // Fetch User Info using chatApiClient or simply from api.ts
        // Wait, Node.js backend might not provide /users/profile. 
        // We can just decode JWT manually if we have polyfills, or we can assume the user logs in and we save their ID in AsyncStorage.
        // For right now, let's just create the socket.
        const storedUserId = await AsyncStorage.getItem('userId');
        
        let userId = storedUserId;
        if (!userId) {
            // Need to get user profile from Spring Boot to know our ID since Socket requires "user_join", userId
            // We'll leave it simple: The app should save 'userId' on Login. 
            // If missing, we'll try to reconnect later.
             console.log("No UserID found for Socket. Join might fail.");
        } else {
             setCurrentUserId(userId);
        }

        newSocket = io(SOCKET_URL, {
          transports: ['websocket'],
          reconnectionAttempts: 5,
        });

        newSocket.on('connect', () => {
          console.log('✅ Connected to WebSocket Server');
          setIsConnected(true);
          
          if (userId) {
              newSocket.emit('user_join', userId);
          }
        });

        newSocket.on('disconnect', () => {
          console.log('❌ Disconnected from WebSocket Server');
          setIsConnected(false);
        });

        newSocket.on('user_online', (data: { userId: string, status: string }) => {
            setOnlineUsers(prev => {
                if (!prev.includes(data.userId)) {
                    return [...prev, data.userId];
                }
                return prev;
            });
        });

        newSocket.on('user_offline', (data: { userId: string, status: string }) => {
            setOnlineUsers(prev => prev.filter(id => id !== data.userId));
        });

        setSocket(newSocket);
      } catch (error) {
        console.error('Socket init error:', error);
      }
    };

    initSocket();

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers, currentUserId, refreshUser: async () => {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                setCurrentUserId(userId);
                if (socket) socket.emit('user_join', userId);
            }
        }
    } }}>
      {children}
    </SocketContext.Provider>
  );
};
