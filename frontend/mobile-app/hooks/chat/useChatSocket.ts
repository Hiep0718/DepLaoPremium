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

    const handleMessageSent = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages(prev => {
        const pendingIdx = prev.findIndex(
          m => m.status === 'pending' && (data.tempId ? m._id === data.tempId : (m.content === data.text && String(m.senderId) === String(currentUserId)))
        );
        if (pendingIdx !== -1) {
          const updated = [...prev];
          updated[pendingIdx] = {
            ...updated[pendingIdx],
            _id: data.messageId || updated[pendingIdx]._id,
            status: 'sent',
          };
          return updated;
        }

        if (data.messageId) {
          const alreadyExists = prev.some(m => String(m._id) === String(data.messageId));
          if (!alreadyExists) {
            const newMsg: Message = {
              _id: data.messageId,
              senderId: String(data.senderId || currentUserId),
              recipientId: String(data.recipientId || ''),
              content: data.text || '',
              messageType: data.messageType || 'text',
              fileUrl: data.fileUrl,
              createdAt: data.timestamp || new Date().toISOString(),
              status: 'sent',
            };
            return [newMsg, ...prev];
          }
        }
        return prev;
      });
    };

    const handleMessageReceived = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages(prev => {
        const exists = prev.some(m => String(m._id) === String(data.messageId));
        if (exists) return prev;
        const newMsg: Message = {
          _id: data.messageId || Math.random().toString(),
          senderId: String(data.senderId),
          recipientId: String(data.recipientId || ''),
          content: data.text,
          messageType: data.messageType || 'text',
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          createdAt: data.timestamp || new Date().toISOString(),
          status: 'received',
          replyTo: data.replyTo,
        };
        // Auto mark as seen
        socket.emit('mark_as_seen', {
          messageId: newMsg._id,
          conversationId: id,
          userId: currentUserId,
        });
        return [newMsg, ...prev];
      });
    };

    const handleMessageSeen = (data: any) => {
      if (data.conversationId !== id) return;
      if (String(data.seenBy) === String(currentUserId)) return;

      setLastSeenMessageId(data.messageId);
      setMessages(prev =>
        prev.map(m =>
          String(m._id) === String(data.messageId) ? { ...m, status: 'seen' } : m
        )
      );
    };

    const handleUserTyping = (data: any) => {
      if (data.conversationId === id && String(data.userId) !== String(currentUserId)) {
        setIsOtherTyping(data.isTyping);
      }
    };

    const handleMessageRevoked = (data: any) => {
      if (data.messageId) {
        setMessages(prev =>
          prev.map(m =>
            String(m._id) === String(data.messageId) ? { ...m, isRevoked: true } : m
          )
        );
      }
    };

    const handleMessageDeleted = (data: any) => {
      if (data.messageId) {
        setMessages(prev => prev.filter(m => String(m._id) !== String(data.messageId)));
      }
    };

    const handleMessagePinned = (data: any) => {
      if (data.conversationId === id && data.pinnedMessage) {
        setPinnedMessage(data.pinnedMessage);
      }
    };

    const handleMessageUnpinned = (data: any) => {
      if (data.conversationId === id) {
        setPinnedMessage(null);
      }
    };

    const handleMessageReacted = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages(prev =>
        prev.map(m =>
          String(m._id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
        )
      );
    };

    socket.on('message_sent', handleMessageSent);
    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_revoked', handleMessageRevoked);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_unpinned', handleMessageUnpinned);
    socket.on('message_reacted', handleMessageReacted);

    return () => {
      socket.off('message_sent', handleMessageSent);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_revoked', handleMessageRevoked);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_unpinned', handleMessageUnpinned);
      socket.off('message_reacted', handleMessageReacted);
    };
  }, [socket, id, currentUserId, setMessages, setPinnedMessage]);

  return {
    isOtherTyping,
    lastSeenMessageId,
  };
}
