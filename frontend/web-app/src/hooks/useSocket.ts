import { useEffect } from 'react';
import { socket, connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import type { Message } from '../stores/chatStore';

export const useSocketSetup = () => {
  const { user } = useAuthStore();
  const addMessage = useChatStore((state) => state.addMessage);

  useEffect(() => {
    if (user?.id) {
      // Kết nối socket khi có user
      connectSocket(user.id);

      // Lắng nghe tin nhắn mới tới
      socket.on('message_received', (data: Message) => {
        addMessage(data);
      });

      // Lắng nghe trạng thái bạn bè online/offline (mock)
      socket.on('user_online', (data) => {
        console.log('User online:', data);
      });

      return () => {
        socket.off('message_received');
        socket.off('user_online');
        disconnectSocket();
      };
    }
  }, [user, addMessage]);
};
