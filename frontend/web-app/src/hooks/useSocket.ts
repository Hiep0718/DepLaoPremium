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
        const state = useChatStore.getState();
        // Chỉ thêm vào danh sách tin nhắn hiện tại nếu đang mở đúng conversation đó
        if (state.activeConversation?.conversationId === data.conversationId) {
          // Normalize the incoming ID from socket
          const incomingId = (data as any).messageId || data._id || data.id;
          
          // Check duplicate first to be safe
          const exists = incomingId 
            ? state.messages.find(m => m.id === incomingId || m._id === incomingId)
            : false;
            
          if (!exists) {
            // Ensure the local message has proper ID mapping and content payload mapped over from socket
            const normalizedMsg = { ...data, _id: incomingId, id: incomingId, content: data.content || data.text };
            state.addMessage(normalizedMsg);
          }
        }
        
        // Optimize: Cập nhật tin nhắn mới nhất trong danh sách conversations
        const updatedConversations = state.conversations.map(c => {
          if (c.conversationId === data.conversationId) {
            return { ...c, lastMessage: data.content || data.text, unreadCount: (c.unreadCount || 0) + 1 };
          }
          return c;
        });
        state.setConversations(updatedConversations);
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
