import { useState, useEffect, useCallback } from 'react';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import { Message } from '@/types/chat';
import { Socket } from 'socket.io-client';

export function useChatMessages(id: string, currentUserId: string | null, socket: Socket | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const isGroup = id?.startsWith('group_');

  // Dynamic group info state
  const [groupName, setGroupName] = useState<string>('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  const [groupSettings, setGroupSettings] = useState<any>(null);

  // Fetch group info
  const fetchGroupInfo = useCallback(async () => {
    if (!isGroup || !id || !currentUserId) return;
    try {
      const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
      const allConvs = convRes.data?.data || [];
      const thisConv = allConvs.find((c: any) => c.conversationId === id);
      if (thisConv) {
        setGroupName(thisConv.groupName || '');
        setGroupAvatar(thisConv.groupAvatar || '');
        setGroupSettings(thisConv.groupSettings || null);
      }
      if (thisConv?.participants) {
        setGroupMemberCount(thisConv.participants.length);
        const roles: Record<string, string> = {};
        thisConv.participants.forEach((p: any) => {
          const uid = String(p.userId || p.id);
          if (uid) roles[uid] = p.role || 'member';
        });
        setParticipantRoles(roles);
      }
    } catch (err) {
      console.log('Error fetching group info:', err);
    }
  }, [isGroup, id, currentUserId]);

  useEffect(() => {
    fetchGroupInfo();

    if (!socket) return;
    const handleGroupUpdated = (data: any) => {
      if (data.conversationId === id) {
        if (data.groupName) setGroupName(data.groupName);
        if (data.groupAvatar) setGroupAvatar(data.groupAvatar);
      }
    };
    const handleSettingsUpdated = (data: any) => {
      if (data.conversationId === id && data.settings) {
        setGroupSettings(data.settings);
      }
    };
    socket.on('group_updated', handleGroupUpdated);
    socket.on('group_settings_updated', handleSettingsUpdated);

    const handleMessageReceived = (data: any) => {
      if (data.conversationId !== id) return;
      const msgContent = data.content || '';
      if (data.messageType === 'system' && (
        msgContent.startsWith('group_updated:') || 
        msgContent.startsWith('role_') ||
        msgContent.startsWith('added_members:') ||
        msgContent.startsWith('member_left:') ||
        msgContent.startsWith('member_removed:')
      )) {
        fetchGroupInfo();
      }
    };
    socket.on('message_received', handleMessageReceived);

    return () => {
      socket.off('group_updated', handleGroupUpdated);
      socket.off('group_settings_updated', handleSettingsUpdated);
      socket.off('message_received', handleMessageReceived);
    };
  }, [isGroup, id, currentUserId, socket, fetchGroupInfo]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUserId || !id) return;
      try {
        if (id.startsWith('ai_')) {
          const { fetchAiMessages } = await import('@/services/aiChat.service');
          const aiHistory = await fetchAiMessages(currentUserId);
          const mapped: Message[] = aiHistory.reverse().map((m: any) => ({
            _id: m._id,
            senderId: m.role === 'user' ? currentUserId : 'ai_food_bot',
            recipientId: m.role === 'user' ? 'ai_food_bot' : currentUserId,
            content: m.content,
            messageType: 'text',
            createdAt: m.createdAt,
            status: 'seen',
          }));
          setMessages(mapped);
          setPinnedMessage(null);
        } else {
          const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=50&userId=${currentUserId}`);
          const history: any[] = res.data?.data || [];
          
          setNextCursor(res.data?.pagination?.nextCursor || null);
          setHasMore(!!res.data?.pagination?.nextCursor);

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
            reactions: m.reactions || [],
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
        }
      } catch (err) {
        console.log('Fetch history error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [id, currentUserId, socket]);

  const fetchMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor || !currentUserId || !id || id.startsWith('ai_')) return;
    setIsLoadingMore(true);
    try {
      const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=50&userId=${currentUserId}&cursor=${nextCursor}`);
      const history: any[] = res.data?.data || [];
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
        reactions: m.reactions || [],
      }));
      setMessages(prev => [...prev, ...mapped]);
      setNextCursor(res.data?.pagination?.nextCursor || null);
      setHasMore(!!res.data?.pagination?.nextCursor);
    } catch (err) {
      console.log('Fetch more error', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, currentUserId, id]);

  // Fetch participant info for system messages
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

  useEffect(() => {
    const fetchMissingMembers = async () => {
      if (!messages || messages.length === 0) return;

      const allIds = new Set<string>();

      for (const msg of messages) {
        // Thu thập senderId của TẤT CẢ tin nhắn (không chỉ system)
        if (msg.senderId) {
          allIds.add(String(msg.senderId));
        }

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
      }

      // Thêm tất cả thành viên nhóm để có đầy đủ thông tin cho tính năng tag (@mention)
      if (isGroup && participantRoles) {
        Object.keys(participantRoles).forEach(uid => {
          if (uid) allIds.add(uid);
        });
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
    isLoadingMore,
    fetchMore,
    pinnedMessage,
    setPinnedMessage,
    groupMemberCount,
    isGroup,
    memberMap,
    participantRoles,
    groupName,
    groupAvatar,
    groupSettings,
  };
}