import { useState, useEffect } from 'react';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import { Message } from '@/types/chat';
import { Socket } from 'socket.io-client';

export function useChatMessages(id: string, currentUserId: string | null, socket: Socket | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0);
  const isGroup = id?.startsWith('group_');

  // Fetch group info
  useEffect(() => {
    if (!isGroup || !id || !currentUserId) return;
    const fetchGroupInfo = async () => {
      try {
        const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
        const allConvs = convRes.data?.data || [];
        const thisConv = allConvs.find((c: any) => c.conversationId === id);
        if (thisConv?.participants) {
          setGroupMemberCount(thisConv.participants.length);
        }
      } catch (err) {
        console.log('Error fetching group info:', err);
      }
    };
    fetchGroupInfo();
  }, [isGroup, id, currentUserId]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUserId || !id) return;
      try {
        const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=50&userId=${currentUserId}`);
        const history: any[] = res.data?.data || [];
        
        if (res.data?.pinnedMessage) {
          setPinnedMessage(res.data.pinnedMessage);
        }

        const mapped: Message[] = history.reverse().map((m: any) => ({
          _id: m._id,
          senderId: String(m.senderId),
          recipientId: String(m.recipientId || ''),
          content: m.content,
          messageType: m.messageType || 'text',
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          isRevoked: m.isRevoked || false,
          createdAt: m.createdAt || m.timestamp,
          status: m.status || 'sent',
          replyTo: m.replyTo,
        }));

        setMessages(mapped);

        // Đánh dấu đã đọc tin nhắn mới nhất của đối phương
        if (socket) {
          const lastReceived = [...mapped].find(m => String(m.senderId) !== String(currentUserId));
          if (lastReceived) {
            socket.emit('mark_as_seen', {
              messageId: lastReceived._id,
              conversationId: id,
              userId: currentUserId,
            });
          }
        }
      } catch (err) {
        console.log('Fetch history error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [id, currentUserId, socket]);

  // Fetch participant info for system messages
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

  useEffect(() => {
    const fetchMissingMembers = async () => {
      if (!messages || messages.length === 0) return;
      
      const allIds = new Set<string>();
      
      for (const msg of messages) {
        if (msg.messageType !== 'system') continue;
        const text = msg.content || '';
        
        if (text.startsWith('member_left:')) {
          allIds.add(text.split(':')[1]);
        } else if (text.startsWith('member_removed:')) {
          const parts = text.split(':');
          if (parts[1]) allIds.add(parts[1]);
          if (parts[2]) allIds.add(parts[2]);
        } else if (text.startsWith('added_members:')) {
          const ids = text.split(':')[1].split(',');
          ids.forEach(idx => {
            if (idx.trim()) allIds.add(idx.trim());
          });
        } else if (text.startsWith('role_')) {
          const parts = text.split(':');
          if (parts[1]) allIds.add(parts[1]);
          if (parts[2]) allIds.add(parts[2]);
        }
        if (msg.senderId) {
          allIds.add(String(msg.senderId));
        }
      }
      
      const newIds = Array.from(allIds).filter(uid => !memberMap[uid]);
      if (newIds.length === 0) return;
      
      const newMap = { ...memberMap };
      let updated = false;
      
      for (const uid of newIds) {
        try {
          const res = await apiClient.get(`/users/${uid}`);
          if (res.data?.data) {
            newMap[uid] = { 
              fullName: res.data.data.fullName || res.data.data.nickname || 'Thành viên',
              avatarUrl: res.data.data.avatarUrl
            };
            updated = true;
          }
        } catch (err) {
          // ignore
        }
      }
      
      if (updated) {
        setMemberMap(newMap);
      }
    };
    
    fetchMissingMembers();
  }, [messages]);

  return {
    messages,
    setMessages,
    isLoading,
    pinnedMessage,
    setPinnedMessage,
    groupMemberCount,
    isGroup,
    memberMap,
  };
}
