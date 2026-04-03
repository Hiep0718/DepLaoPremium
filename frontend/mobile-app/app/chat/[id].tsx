import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';

// ─── Trạng thái tin nhắn ──────────────────────────────────────────────────────
// pending  → đang gửi (chưa đến server)
// sent     → server đã nhận (message_sent event)
// received → đối phương đã nhận (message_received delivered to recipient)
// seen     → đối phương đã xem (message_seen event)
type MessageStatus = 'pending' | 'sent' | 'received' | 'seen';

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt?: string;
  status: MessageStatus;
}

// ─── Component hiện tick trạng thái giống Zalo ────────────────────────────────
function MessageTick({ status }: { status: MessageStatus }) {
  if (status === 'pending') {
    return <Ionicons name="time-outline" size={12} color="rgba(0,0,0,0.3)" style={styles.tick} />;
  }
  if (status === 'sent') {
    // 1 tick nhỏ – đã đến server
    return (
      <View style={styles.tickWrap}>
        <Ionicons name="checkmark" size={12} color="rgba(0,0,0,0.4)" />
      </View>
    );
  }
  if (status === 'received') {
    // 2 tick xám – đối phương đã nhận
    return (
      <View style={styles.tickWrap}>
        <Ionicons name="checkmark-done" size={13} color="rgba(0,0,0,0.4)" />
      </View>
    );
  }
  // seen → 2 tick xanh + avatar sẽ hiện bên dưới bubble (xử lý ở renderMessage)
  return (
    <View style={styles.tickWrap}>
      <Ionicons name="checkmark-done" size={13} color={ZaloColors.blue} />
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { id, name, recipientId, avatar } = useLocalSearchParams<{
    id: string;
    name: string;
    recipientId: string;
    avatar?: string;
  }>();

  const { socket, currentUserId: socketUserId, onlineUsers } = useSocket();
  const [currentUserId, setCurrentUserId] = useState<string | null>(socketUserId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  // _id của tin nhắn MỚI NHẤT mà đối phương đã xem
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Resolve userId ────────────────────────────────────────────────────────
  useEffect(() => {
    const resolveUserId = async () => {
      if (socketUserId) { setCurrentUserId(socketUserId); return; }
      const uid = await AsyncStorage.getItem('userId');
      if (uid) setCurrentUserId(uid);
    };
    resolveUserId();
  }, [socketUserId]);

  const isOnline = onlineUsers.includes(recipientId as string);

  // ─── Tải lịch sử ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=50`);
        const history: any[] = res.data?.data || [];

        const mapped: Message[] = history.reverse().map((m: any) => ({
          _id: m._id,
          senderId: String(m.senderId),
          recipientId: String(m.recipientId || ''),
          content: m.content,
          createdAt: m.createdAt || m.timestamp,
          // Gán trạng thái dựa trên trường status từ DB (nếu backend lưu), mặc định 'sent'
          status: (m.status as MessageStatus) || 'sent',
        }));

        setMessages(mapped);

        // Đánh dấu đã đọc tin nhắn mới nhất của đối phương
        if (socket && currentUserId) {
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
  }, [id]);

  // ─── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // Tin nhắn mình GỬI → server xác nhận → cập nhật pending → sent
    const handleMessageSent = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages(prev => {
        // Tìm tin pending của mình khớp nội dung
        const pendingIdx = prev.findIndex(
          m => m.status === 'pending' && m.content === data.text && String(m.senderId) === String(currentUserId)
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
        return prev;
      });
    };

    // Tin nhắn từ ĐỐI PHƯƠNG đến
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
          createdAt: data.timestamp || new Date().toISOString(),
          status: 'received',
        };
        // Đánh dấu đã xem ngay vì người dùng đang mở màn hình chat này
        socket.emit('mark_as_seen', {
          messageId: newMsg._id,
          conversationId: id,
          userId: currentUserId,
        });
        return [newMsg, ...prev];
      });
    };

    // Đối phương đã XEM tin nhắn → cập nhật status → seen, lưu lastSeenMessageId
    const handleMessageSeen = (data: any) => {
      if (data.conversationId !== id) return;
      // Chỉ xử lý khi người xem KHÔNG phải mình (tức đối phương xem)
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

    socket.on('message_sent', handleMessageSent);
    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('message_sent', handleMessageSent);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, id, currentUserId]);

  // ─── Typing indicator ──────────────────────────────────────────────────────
  const handleTextChange = (val: string) => {
    setText(val);
    if (!socket || !currentUserId) return;
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: true });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
    }, 1500) as any;
  };

  // ─── Gửi tin – Optimistic Update ──────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !socket || !currentUserId) return;

    const tempMsg: Message = {
      _id: `pending-${Date.now()}`,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: trimmed,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setMessages(prev => [tempMsg, ...prev]);
    setText('');

    socket.emit('send_message', {
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: trimmed,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
  }, [text, socket, currentUserId, id, recipientId]);

  // ─── Render mỗi tin nhắn ──────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = String(item.senderId) === String(currentUserId);
    // Chỉ hiện avatar "đã xem" dưới tin mới nhất mà đối phương đã xem
    const showSeenAvatar = isMine && item.status === 'seen' && String(item._id) === String(lastSeenMessageId);

    return (
      <View>
        <View style={[styles.msgWrapper, isMine ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
          {/* Avatar đối phương bên trái */}
          {!isMine && (
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar as string }} style={styles.miniAvatar} />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Ionicons name="person" size={14} color="#888" />
                </View>
              )}
            </View>
          )}

          <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            <View style={[styles.msgBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
              <Text style={[styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                {item.content}
              </Text>
            </View>

            {/* Tick trạng thái chỉ hiện dưới tin của mình */}
            {isMine && (
              <View style={styles.statusRow}>
                <MessageTick status={item.status} />
              </View>
            )}
          </View>
        </View>

        {/* Avatar nhỏ hiện bên phải dưới tin đã được đối phương XEM */}
        {showSeenAvatar && (
          <View style={styles.seenAvatarRow}>
            {avatar ? (
              <Image source={{ uri: avatar as string }} style={styles.seenAvatar} />
            ) : (
              <View style={styles.seenAvatarDefault}>
                <Ionicons name="person" size={9} color="#888" />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          {isOtherTyping ? (
            <Text style={styles.headerStatus}>Đang gõ...</Text>
          ) : isOnline ? (
            <Text style={styles.headerStatus}>Vừa mới truy cập</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="call-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="videocam-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={ZaloColors.blue} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item._id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="happy-outline" size={26} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Tin nhắn"
            placeholderTextColor="#888"
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          {text.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={22} color={ZaloColors.blue} />
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="mic-outline" size={26} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="image-outline" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e9f1' },
  header: {
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerBtn: { padding: 8 },
  headerTitleWrap: { flex: 1, paddingHorizontal: 4, justifyContent: 'center' },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  chatArea: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  msgWrapper: { marginBottom: 4, flexDirection: 'row', alignItems: 'flex-end' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },

  avatarWrap: { marginRight: 8 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15 },
  defaultAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },

  msgBubble: {
    maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
  },
  myMsgBubble: { backgroundColor: '#cce5ff', borderTopRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  msgContent: { fontSize: 15, lineHeight: 22 },
  myMsgContent: { color: '#000' },
  theirMsgContent: { color: '#000' },

  // Hàng tick trạng thái nằm dưới bubble
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, marginBottom: 4, paddingRight: 2 },
  tick: { marginLeft: 2 },
  tickWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: 2 },

  // Avatar nhỏ "đã xem" nằm bên phải dưới tin cuối
  seenAvatarRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 4, marginBottom: 8 },
  seenAvatar: { width: 14, height: 14, borderRadius: 7 },
  seenAvatarDefault: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: '#f5f5f5', borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 16, color: '#000', marginHorizontal: 8,
  },
  iconBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  sendBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
});
