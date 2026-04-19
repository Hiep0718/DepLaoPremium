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
  otherUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  isAiBot?: boolean;
}

export function MessagesScreen() {
  const router = useRouter();
  const { currentUserId, socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      // Vì NodeAPI chỉ lưu userId, cần gọi sang SpringBoot để lấy Tên và Avatar
      const enrichedConvs = await Promise.all(
        convs.map(async (conv: Conversation) => {
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
          return conv;
        })
      );

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
      setConversations(prev => {
        const idx = prev.findIndex(c => c.conversationId === data.conversationId);
        if (idx > -1) {
          const updatedConv = { ...prev[idx] };
          updatedConv.lastMessage = {
            content: data.text,
            senderId: data.senderId,
            timestamp: data.timestamp || new Date().toISOString()
          };
          const newList = prev.filter((_, i) => i !== idx);
          return [updatedConv, ...newList];
        } else {
          loadConversations();
          return prev;
        }
      });
    };
    
    socket.on('message_received', handleNewMessage);
    socket.on('message_sent', handleNewMessage);
    
    return () => {
        socket.off('message_received', handleNewMessage);
        socket.off('message_sent', handleNewMessage);
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

  const renderItem = ({ item }: { item: Conversation }) => {
    const name = item.isGroup ? item.groupName : item.otherUser?.fullName;
    const isUnread = false; 

    return (
      <TouchableOpacity 
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => router.push({ 
            pathname: '/chat/[id]', 
            params: { 
                id: item.conversationId, 
                name: name,
                recipientId: item.otherUser?.id,
                avatar: item.otherUser?.avatarUrl
            } 
        })}
      >
        {item.otherUser?.avatarUrl ? (
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
          <Text style={[styles.chatPreview, isUnread && styles.chatPreviewUnread]} numberOfLines={1}>
            {item.lastMessage?.senderId === currentUserId ? 'Bạn: ' : ''}
            {item.lastMessage?.content || 'Chưa có tin nhắn'}
          </Text>
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
  chatPreview: { fontSize: 14, color: '#666' },
  chatPreviewUnread: { color: '#000', fontWeight: '600' },
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
