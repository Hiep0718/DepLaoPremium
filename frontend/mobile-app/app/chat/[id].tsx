import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Dimensions, Alert, Modal,
  ScrollView, Animated as RNAnimated, Keyboard
} from 'react-native';
import { STICKERS } from '@/constants/stickers';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import ForwardModal from '@/components/ForwardModal';

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
  imageUrl?: string;   // ← thêm field ảnh
  messageType?: string; // text | sticker | image | file | ...
  fileUrl?: string;     // URL cho sticker hoặc file đính kèm
  isRevoked?: boolean;  // tin nhắn đã bị thu hồi
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
  const [showStickers, setShowStickers] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const stickerPanelHeight = useRef(new RNAnimated.Value(0)).current;
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
          messageType: m.messageType || 'text',
          fileUrl: m.fileUrl,
          isRevoked: m.isRevoked || false,
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
        // Tìm tin pending của mình khớp tempId hoặc fallback sang nội dung
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

        // Không tìm thấy pending (ví dụ: chuyển tiếp tin nhắn đến cùng cuộc trò chuyện)
        // → thêm tin nhắn mới nếu chưa tồn tại
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
          messageType: data.messageType || 'text',
          fileUrl: data.fileUrl,
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

    // Tin nhắn bị THU HỒI
    const handleMessageRevoked = (data: any) => {
      if (data.messageId) {
        setMessages(prev =>
          prev.map(m =>
            String(m._id) === String(data.messageId) ? { ...m, isRevoked: true } : m
          )
        );
      }
    };

    socket.on('message_sent', handleMessageSent);
    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_revoked', handleMessageRevoked);

    return () => {
      socket.off('message_sent', handleMessageSent);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_revoked', handleMessageRevoked);
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

    const tempId = `pending-${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: trimmed,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setMessages(prev => [tempMsg, ...prev]);
    setText('');

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: trimmed,
      messageType: 'text',
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
  }, [text, socket, currentUserId, id, recipientId]);

  // ─── Gửi Sticker ────────────────────────────────────────────────────────────
  const sendSticker = useCallback((stickerUrl: string) => {
    if (!socket || !currentUserId) return;

    const tempId = `pending-sticker-${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setMessages(prev => [tempMsg, ...prev]);
    toggleStickerPanel(false);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
    });
  }, [socket, currentUserId, id, recipientId]);

  // ─── Toggle Sticker Panel ───────────────────────────────────────────────────
  const toggleStickerPanel = useCallback((show?: boolean) => {
    const shouldShow = show !== undefined ? show : !showStickers;
    if (shouldShow) {
      Keyboard.dismiss();
    }
    setShowStickers(shouldShow);
    RNAnimated.spring(stickerPanelHeight, {
      toValue: shouldShow ? 260 : 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [showStickers, stickerPanelHeight]);

  // ─── Thu hồi tin nhắn ──────────────────────────────────────────────────────
  const handleRevoke = useCallback((msg: Message) => {
    if (!socket || !currentUserId) return;
    Alert.alert(
      'Thu hồi tin nhắn',
      'Tin nhắn sẽ bị thu hồi với tất cả mọi người trong cuộc trò chuyện.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: () => {
            socket.emit('revoke_message', {
              messageId: msg._id,
              conversationId: id,
              userId: currentUserId,
            });
            // Optimistic update
            setMessages(prev =>
              prev.map(m =>
                String(m._id) === String(msg._id) ? { ...m, isRevoked: true } : m
              )
            );
          },
        },
      ]
    );
  }, [socket, currentUserId, id]);

  // ─── Long press menu cho tin nhắn ──────────────────────────────────────────
  const handleMessageLongPress = useCallback((msg: Message) => {
    if (msg.isRevoked) return; // Không cho thao tác trên tin đã thu hồi
    const isMine = String(msg.senderId) === String(currentUserId);

    const buttons: any[] = [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Chuyển tiếp',
        onPress: () => setForwardingMessage(msg),
      },
    ];

    if (isMine) {
      buttons.push({
        text: 'Thu hồi',
        style: 'destructive',
        onPress: () => handleRevoke(msg),
      });
    }

    Alert.alert('Tùy chọn tin nhắn', undefined, buttons);
  }, [currentUserId, handleRevoke]);

  // ─── Chọn & gửi ảnh ─────────────────────────────────────────────────
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPendingImage(result.assets[0].uri);
    }
  };

  const handleSendImage = async () => {
    if (!pendingImage || !socket || !currentUserId) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: pendingImage, name: `chat-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      const res = await apiClient.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl: string = res.data?.data?.url;
      if (imageUrl) {
        const tempId = `pending-img-${Date.now()}`;
        const tempMsg: Message = {
          _id: tempId,
          senderId: currentUserId,
          recipientId: recipientId as string,
          content: '[Hình ảnh]',
          imageUrl,
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        setMessages(prev => [tempMsg, ...prev]);
        socket.emit('send_message', { conversationId: id, senderId: currentUserId, recipientId, tempId, text: imageUrl, type: 'image' });
      } else {
        Alert.alert('⚠️ Chưa có nơi lưu trữ ảnh', 'Hệ thống chưa được cấu hình kho lưu trữ ảnh (AWS S3).');
      }
    } catch {
      Alert.alert('⚠️ Chưa có nơi lưu trữ ảnh', 'Hệ thống chưa được cấu hình kho lưu trữ ảnh (AWS S3).');
    } finally {
      setUploadingImage(false);
      setPendingImage(null);
    }
  };

  // ─── Render mỗi tin nhắn ──────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = String(item.senderId) === String(currentUserId);
    const showSeenAvatar = isMine && item.status === 'seen' && String(item._id) === String(lastSeenMessageId);
    const isSticker = !item.isRevoked && item.messageType === 'sticker' && item.fileUrl;
    const isImage = !item.isRevoked && !isSticker && (item.imageUrl || (item.content.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(item.content)));
    const imgSrc = item.imageUrl || item.content;

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

          <View style={{ flex: 1, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            {item.isRevoked ? (
              /* ────── Tin nhắn đã bị thu hồi ────── */
              <View style={styles.revokedBubble}>
                <Ionicons name="ban-outline" size={14} color="#999" style={{ marginRight: 6 }} />
                <Text style={styles.revokedText}>Tin nhắn đã bị thu hồi</Text>
              </View>
            ) : isSticker ? (
              /* ────── Sticker message ────── */
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => handleMessageLongPress(item)}
              >
                <Image
                  source={{ uri: item.fileUrl }}
                  style={styles.stickerImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ) : isImage ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => handleMessageLongPress(item)}
              >
                <Image source={{ uri: imgSrc }} style={styles.msgImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => handleMessageLongPress(item)}
              >
                <View style={[styles.msgBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                  <Text style={[styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                    {item.content}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {isMine && !item.isRevoked && (
              <View style={styles.statusRow}>
                <MessageTick status={item.status} />
              </View>
            )}
          </View>
        </View>

        {/* Avatar nhỏ hiện bên phải dưới tin đã được đối phương XEM */}
        {showSeenAvatar && !item.isRevoked && (
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
      <StatusBar style="light" backgroundColor={ZaloColors.blue} />

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
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => toggleStickerPanel()}
          >
            <Ionicons
              name={showStickers ? 'happy' : 'happy-outline'}
              size={26}
              color={showStickers ? ZaloColors.blue : '#666'}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Tin nhắn"
            placeholderTextColor="#888"
            value={text}
            onChangeText={handleTextChange}
            onFocus={() => toggleStickerPanel(false)}
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
              <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
                <Ionicons name="image-outline" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ────── Sticker Picker Panel ────── */}
        <RNAnimated.View style={[styles.stickerPanel, { height: stickerPanelHeight }]}>
          {showStickers && (
            <View style={styles.stickerPanelInner}>
              <View style={styles.stickerPanelHeader}>
                <Text style={styles.stickerPanelTitle}>Nhãn dán</Text>
                <TouchableOpacity onPress={() => toggleStickerPanel(false)}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={styles.stickerGrid}
                showsVerticalScrollIndicator={false}
              >
                {STICKERS.map((sticker, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.stickerItem}
                    onPress={() => sendSticker(sticker)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: sticker }}
                      style={styles.stickerThumb}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </RNAnimated.View>
      </KeyboardAvoidingView>

      {/* Modal preview ảnh trước khi gửi */}
      <Modal visible={!!pendingImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <View style={styles.previewBox}>
            {pendingImage && (
              <Image source={{ uri: pendingImage }} style={styles.previewImage} resizeMode="contain" />
            )}
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewBtn} onPress={() => setPendingImage(null)}>
                <Ionicons name="close" size={22} color="#fff" />
                <Text style={styles.previewBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewSendBtn, uploadingImage && { opacity: 0.6 }]}
                onPress={handleSendImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
                <Text style={styles.previewBtnText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Forward Modal */}
      <ForwardModal
        visible={!!forwardingMessage}
        message={forwardingMessage}
        onClose={() => setForwardingMessage(null)}
      />
    </SafeAreaView>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    maxWidth: SCREEN_WIDTH * 0.75, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
  },
  myMsgBubble: { backgroundColor: '#cce5ff', borderTopRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  msgContent: { fontSize: 15, lineHeight: 22 },
  myMsgContent: { color: '#000' },
  theirMsgContent: { color: '#000' },

  // ─── Tin nhắn đã thu hồi ───
  revokedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  revokedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#999',
  },

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

  msgImage: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.5,
    borderRadius: 12,
    marginBottom: 2,
  },

  // ─── Sticker trong tin nhắn ───
  stickerImage: {
    width: 120,
    height: 120,
    marginBottom: 2,
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

  // ─── Sticker Picker Panel ───
  stickerPanel: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  stickerPanelInner: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stickerPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stickerPanelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stickerItem: {
    width: (SCREEN_WIDTH - 16) / 4,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  stickerThumb: {
    width: 60,
    height: 60,
  },

  // Modal preview ảnh
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewBox: { width: '90%', alignItems: 'center' },
  previewImage: { width: '100%', height: 320, borderRadius: 12, marginBottom: 24 },
  previewActions: { flexDirection: 'row', gap: 16 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewSendBtn: { backgroundColor: ZaloColors.blue },
  previewBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
