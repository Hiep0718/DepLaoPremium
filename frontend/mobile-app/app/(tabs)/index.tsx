import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';

interface Conversation {
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
  // Bổ sung dữ liệu người dùng sau khi map
  otherUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

export default function MessagesScreen() {
  const router = useRouter();
  const { currentUserId, socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load danh sách chat và map thêm tên User
  const loadConversations = async () => {
    if (!currentUserId) return;
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
                // Spring Boot Api trả về `{ data: UserResponse }`
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
      setConversations(activeConvs);
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
      // Khi có tin nhắn mới, đẩy conversation đó lên đầu và cập nhật lastMessage
      setConversations(prev => {
        const idx = prev.findIndex(c => c.conversationId === data.conversationId);
        if (idx > -1) {
          const updatedConv = { ...prev[idx] };
          updatedConv.lastMessage = {
            content: data.text,
            senderId: data.senderId,
            timestamp: data.timestamp || new Date().toISOString()
          };
          // Xoá và đẩy lên đầu
          const newList = prev.filter((_, i) => i !== idx);
          return [updatedConv, ...newList];
        } else {
          // Tin nhắn từ người lạ, tự động reload lại toàn bộ Box chat
          loadConversations();
          return prev;
        }
      });
    };
    
    // Ở file Event, Tên event là `message_received` (và `message_sent` cho chính mình)
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
    const isUnread = false; // Có thể mở rộng

    return (
      <TouchableOpacity 
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => router.push({ 
            pathname: '/chat/[id]', 
            params: { 
                id: item.conversationId, 
                name: name,
                recipientId: item.otherUser?.id
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
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.searchHeader}>
        <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
        <Text style={styles.searchPlaceholder}>Tìm kiếm</Text>
        <View style={{flex: 1}}/>
        <Ionicons name="qr-code-outline" size={22} color="#fff" style={styles.headerIcon} />
        <Ionicons name="add" size={28} color="#fff" style={styles.headerIcon} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchHeader: {
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: { marginRight: 12 },
  searchPlaceholder: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  headerIcon: { marginLeft: 20 },
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
});
