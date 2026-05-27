import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import { fetchAiLastMessage } from '@/services/aiChat.service';

export interface Conversation {
  _id: string;
  conversationId: string;
  participants: { userId: string }[];
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: string;
  };
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  otherUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };

  isAiBot?: boolean;

  unreadCount?: number;

}

export function MessagesScreen() {
  const router = useRouter();
  const { currentUserId, socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({});

  // Fetch a user's name and cache it
  const getUserName = async (uid: string): Promise<string> => {
    if (!uid) return 'Thành viên';
    if (String(uid) === String(currentUserId)) return 'Bạn';
    if (userNameCache[uid]) return userNameCache[uid];
    try {
      const res = await apiClient.get(`/users/${uid}`);
      const name = res.data?.data?.fullName || res.data?.data?.nickname || 'Thành viên';
      setUserNameCache(prev => ({ ...prev, [uid]: name }));
      return name;
    } catch {
      return 'Thành viên';
    }
  };

  // Extract user IDs from system message content
  const extractIdsFromContent = (content: string): string[] => {
    const ids: string[] = [];
    if (content.startsWith('added_members:')) {
      ids.push(...content.split(':')[1].split(',').map(s => s.trim()).filter(Boolean));
    } else if (content.startsWith('member_left:')) {
      ids.push(content.split(':')[1]);
    } else if (content.startsWith('member_removed:')) {
      const parts = content.split(':');
      if (parts[1]) ids.push(parts[1]);
      if (parts[2]) ids.push(parts[2]);
    } else if (content.startsWith('role_')) {
      const parts = content.split(':');
      if (parts[1]) ids.push(parts[1]);
      if (parts[2]) ids.push(parts[2]);
    } else if (content.startsWith('group_disbanded:')) {
      ids.push(content.split(':')[1]);
    }
    return ids.filter(Boolean);
  };

  // Load danh sách chat và map thêm tên User
  const loadConversations = async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    try {
      // Gọi Node API để lấy list Box Chat của mình
      const res = await chatApiClient.get(`/conversations/${currentUserId}`);
      let convs = res.data?.data || [];

      // Collect user IDs that need name resolution
      const idsToFetch = new Set<string>();

      // Vì NodeAPI chỉ lưu userId, cần gọi sang SpringBoot để lấy Tên và Avatar
      const enrichedConvs = await Promise.all(
        convs.map(async (conv: Conversation) => {
          // ═══ Cloud của tôi: không cần fetch user khác ═══
          if (conv.conversationId?.startsWith('cloud_')) {
            conv.otherUser = {
              id: currentUserId,
              fullName: 'Cloud của tôi',
              avatarUrl: undefined,
            };
            return conv;
          }
          if (!conv.isGroup) {
            const otherUserId = conv.participants.find(p => p.userId !== currentUserId)?.userId;
            if (otherUserId) {
              try {
                const userRes = await apiClient.get(`/users/${otherUserId}`);
                conv.otherUser = userRes.data?.data;
              } catch (e) {
                console.log('Failed to fetch user', otherUserId);
                conv.otherUser = { id: otherUserId, fullName: 'Người dùng Zalo' };
              }
            }
          }
          // For group system messages, collect user IDs
          if (conv.isGroup && conv.lastMessage?.content) {
            const ids = extractIdsFromContent(conv.lastMessage.content);
            ids.forEach(id => {
              if (id !== currentUserId) idsToFetch.add(id);
            });
            if (conv.lastMessage.senderId && conv.lastMessage.senderId !== currentUserId) {
              idsToFetch.add(conv.lastMessage.senderId);
            }
          }
          return conv;
        })
      );

      // Batch fetch names for system message user IDs
      const newCache: Record<string, string> = { ...userNameCache };
      for (const uid of idsToFetch) {
        if (newCache[uid]) continue;
        try {
          const r = await apiClient.get(`/users/${uid}`);
          newCache[uid] = r.data?.data?.fullName || r.data?.data?.nickname || 'Thành viên';
        } catch { /* skip */ }
      }
      setUserNameCache(newCache);

      // Lọc bỏ những cuộc trò chuyện chưa có tin nhắn nào
      const activeConvs = enrichedConvs.filter(c => c.lastMessage && c.lastMessage.content);

      // Tạo conversation AI mặc định (ghim lên đầu)
      const aiData = await fetchAiLastMessage(currentUserId);
      const aiConvId = `ai_food_bot_${currentUserId}`;
      const aiConv: Conversation = {
        _id: aiConvId,
        conversationId: aiConvId,
        participants: [{ userId: 'ai_food_bot' }],
        isGroup: false,
        isAiBot: true,
        otherUser: {
          id: 'ai_food_bot',
          fullName: 'Bếp AI 🍜',
          avatarUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png'
        },
        lastMessage: aiData && aiData.exists ? {
          content: aiData.content || 'Hỏi tôi về ẩm thực!',
          senderId: aiData.role === 'user' ? currentUserId : 'ai_food_bot',
          timestamp: aiData.timestamp || new Date().toISOString()
        } : {
          content: 'Hỏi tôi về ẩm thực!',
          senderId: 'ai_food_bot',
          timestamp: new Date().toISOString()
        }
      };

      setConversations([aiConv, ...activeConvs]);
    } catch (error) {
      console.log('Error loading conversations', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentUserId]);

  // Lắng nghe Message mới bắn về để cập nhật "Tin nhắn mới nhất"
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data: any) => {
      const msgContent = data.text || data.content || '';
      const msgType = data.messageType || '';

      // ═══ Giải tán nhóm: Xóa conversation khỏi danh sách ═══
      if (msgType === 'system' && typeof msgContent === 'string' && msgContent.startsWith('group_disbanded:')) {
        setConversations(prev => prev.filter(c => c.conversationId !== data.conversationId));
        return;
      }

      setConversations(prev => {
        const idx = prev.findIndex(c => c.conversationId === data.conversationId);
        if (idx > -1) {
          const updatedConv = { ...prev[idx] };
          updatedConv.lastMessage = {
            content: msgContent,
            senderId: data.senderId,
            timestamp: data.timestamp || new Date().toISOString(),
            ...(data.messageType ? { messageType: data.messageType } : {}),
          };

          // Tăng số đếm tin nhắn chưa đọc nếu không phải tin mình gửi
          if (String(data.senderId) !== String(currentUserId)) {
            updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
          }

          const newList = prev.filter((_, i) => i !== idx);
          return [updatedConv, ...newList];
        } else {
          loadConversations();
          return prev;
        }
      });

      // Also fetch name for new system message user IDs
      const content = data.text || data.content || '';
      if (isSystemContent(content)) {
        const ids = extractIdsFromContent(content);
        ids.forEach(uid => {
          if (uid !== currentUserId && !userNameCache[uid]) {
            getUserName(uid); // async, will update cache
          }
        });
      }
    };

    const handleGroupUpdated = (data: any) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.conversationId === data.conversationId);
        if (idx > -1) {
          const updatedConv = { ...prev[idx] };
          if (data.groupName) updatedConv.groupName = data.groupName;
          if (data.groupAvatar) updatedConv.groupAvatar = data.groupAvatar;
          const newList = [...prev];
          newList[idx] = updatedConv;
          return newList;
        }
        return prev;
      });
    };

    socket.on('message_received', handleNewMessage);
    socket.on('message_sent', handleNewMessage);
    socket.on('group_updated', handleGroupUpdated);

    return () => {
      socket.off('message_received', handleNewMessage);
      socket.off('message_sent', handleNewMessage);
      socket.off('group_updated', handleGroupUpdated);
    };
  }, [socket]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [currentUserId]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Format system messages for conversation list preview
  const getName = (uid: string): string => {
    if (!uid) return 'Thành viên';
    if (String(uid) === String(currentUserId)) return 'Bạn';
    return userNameCache[uid] || 'Thành viên';
  };

  const formatLastMessage = (content: string, senderId?: string): string => {
    if (!content) return 'Chưa có tin nhắn';

    const actor = getName(String(senderId));

    if (content === 'Nhóm đã được tạo') {
      return '🎉 Nhóm đã được tạo';
    }
    if (content === 'Đã thêm thành viên mới vào nhóm') {
      return `${actor} đã thêm thành viên mới`;
    }
    if (content.startsWith('added_members:')) {
      const addedIds = content.split(':')[1].split(',').map(s => s.trim()).filter(Boolean);
      const names = addedIds.map(id => getName(id)).join(', ');
      return `${actor} đã thêm ${names}`;
    }
    if (content.startsWith('member_left:')) {
      const leftId = content.split(':')[1];
      return `${getName(leftId)} đã rời nhóm`;
    }
    if (content.startsWith('member_removed:')) {
      const parts = content.split(':');
      return `${getName(parts[1])} đã xóa ${getName(parts[2])}`;
    }
    if (content.startsWith('group_disbanded:')) {
      return `${actor} đã giải tán nhóm`;
    }
    if (content.startsWith('role_leader:')) {
      const parts = content.split(':');
      return `${getName(parts[1])} đã chuyển quyền trưởng nhóm cho ${getName(parts[2])}`;
    }
    if (content.startsWith('role_deputy:')) {
      const parts = content.split(':');
      return `${getName(parts[1])} đã bổ nhiệm ${getName(parts[2])} làm phó nhóm`;
    }
    if (content.startsWith('role_undeputy:')) {
      const parts = content.split(':');
      return `${getName(parts[1])} đã gỡ quyền phó nhóm của ${getName(parts[2])}`;
    }
    if (content.startsWith('group_updated:')) {
      return `${actor} đã cập nhật thông tin nhóm`;
    }

    return content;
  };

  const isSystemContent = (content?: string): boolean => {
    if (!content) return false;
    return content.startsWith('added_members:') ||
      content.startsWith('member_left:') ||
      content.startsWith('member_removed:') ||
      content.startsWith('group_disbanded:') ||
      content.startsWith('role_') ||
      content.startsWith('group_updated:') ||
      content === 'Nhóm đã được tạo' ||
      content === 'Đã thêm thành viên mới vào nhóm';
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const isCloud = item.conversationId?.startsWith('cloud_');
    const name = isCloud ? 'Cloud của tôi' : (item.isGroup ? item.groupName : item.otherUser?.fullName);
    const unreadCount = item.unreadCount || 0;
    const isUnread = unreadCount > 0;
    const lastContent = item.lastMessage?.content || '';
    const isSystem = isSystemContent(lastContent);
    const displayContent = isSystem
      ? formatLastMessage(lastContent, item.lastMessage?.senderId)
      : lastContent;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={async () => {
          // Đặt lại số đếm unread về 0 trên UI khi click vào
          setConversations(prev => prev.map(c =>
            c.conversationId === item.conversationId ? { ...c, unreadCount: 0 } : c
          ));

          // Gọi API đánh dấu đã đọc trên backend (bỏ qua AI conversation)
          if (!item.isAiBot && !item.conversationId.startsWith('ai_')) {
            try {
              await chatApiClient.put(`/conversations/${item.conversationId}/read`, {
                userId: currentUserId,
              });
            } catch (e) {
              console.log('Failed to mark as read', e);
            }
          }

          router.push({
            pathname: '/chat/[id]',
            params: {
              id: item.conversationId,
              name: isCloud ? 'Cloud của tôi' : name,
              recipientId: isCloud ? currentUserId : (item.isGroup ? "" : (item.otherUser?.id || "")),
              avatar: isCloud ? 'cloud' : (item.isGroup ? (item.groupAvatar || "") : (item.otherUser?.avatarUrl || ""))
            }
          });
        }}
      >
        {isCloud ? (
          <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0068FF' }]}>
            <Ionicons name="cloud" size={24} color="#fff" />
          </View>
        ) : item.isGroup ? (
          item.groupAvatar ? (
            <Image source={{ uri: item.groupAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e1bee7' }]}>
              <Ionicons name="people" size={24} color="#8e24aa" />
            </View>
          )
        ) : item.otherUser?.avatarUrl ? (
          <Image source={{ uri: item.otherUser.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={24} color="#888" />
          </View>
        )}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, isUnread && styles.chatNameUnread]} numberOfLines={1}>{name}</Text>
            <Text style={styles.chatTime}>{formatTime(item.lastMessage?.timestamp)}</Text>
          </View>
          <View style={styles.chatPreviewRow}>
            <Text style={[styles.chatPreview, isUnread && styles.chatPreviewUnread, isSystem && styles.chatPreviewSystem]} numberOfLines={1}>
              {!isSystem && !isCloud && item.lastMessage?.senderId === currentUserId ? 'Bạn: ' : ''}
              {displayContent || 'Chưa có tin nhắn'}
            </Text>
            {isUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 5 ? '5+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <Text style={styles.listTitle}>Tin nhắn</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="list" size={20} color={ZaloColors.subText} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={ZaloColors.blue} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào.</Text>
            </View>
          }
        />
      )}

      {/* Nút Floating Bếp AI */}
      <TouchableOpacity
        style={styles.fabAi}
        activeOpacity={0.8}
        onPress={() => router.push({
          pathname: '/chat/[id]',
          params: {
            id: `ai_food_bot_${currentUserId}`,
            name: 'Bếp AI 🍜',
            recipientId: 'ai_food_bot',
            avatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png',
          }
        })}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ZaloColors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: { fontSize: 20, fontWeight: "800", color: '#000' },
  iconBtn: { padding: 6 },
  chatRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#e1e4ea',
  },
  chatInfo: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e4ea',
    paddingBottom: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: { fontSize: 16, color: '#000' },
  chatNameUnread: { fontWeight: '700' },
  chatTime: { fontSize: 12, color: '#888' },
  chatPreview: { flex: 1, fontSize: 14, color: '#666' },
  chatPreviewUnread: { color: '#000', fontWeight: '600' },
  chatPreviewSystem: { fontStyle: 'italic', color: '#888' },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14 },
  fabAi: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
