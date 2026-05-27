import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '@/types/chat';

interface UseChatSocketProps {
  socket: Socket | null;
  id: string; // conversation ID
  currentUserId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setPinnedMessage: React.Dispatch<React.SetStateAction<any>>;
}

export function useChatSocket({
  socket,
  id,
  currentUserId,
  setMessages,
  setPinnedMessage,
}: UseChatSocketProps) {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    // CHỈ GIỮ LẠI CÁC SỰ KIỆN PHỤ. 
    // Các sự kiện chính (nhận tin nhắn, thu hồi, ghim...) ĐÃ ĐƯỢC XỬ LÝ TOÀN BỘ BÊN [id].tsx

    const handleMessageSeen = (data: any) => {
      if (data.conversationId !== id) return;
      if (String(data.seenBy) === String(currentUserId)) return;

      setLastSeenMessageId(data.messageId);
      // Cập nhật trạng thái 'seen' cho messages đã được xử lý bên [id].tsx
    };

    const handleUserTyping = (data: any) => {
      if (data.conversationId === id && String(data.userId) !== String(currentUserId)) {
        setIsOtherTyping(data.isTyping);
      }
    };

    const handleMessageReacted = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages(prev =>
        prev.map(m =>
          String(m._id) === String(data.messageId)
            ? { ...m, reactions: data.reactions, content: data.content || m.content }
            : m
        )
      );
    };

    // Chỉ đăng ký 3 sự kiện này
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_reacted', handleMessageReacted);

    return () => {
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_reacted', handleMessageReacted);
    };
  }, [socket, id, currentUserId, setMessages]);

  return {
    isOtherTyping,
    lastSeenMessageId,
  };
}