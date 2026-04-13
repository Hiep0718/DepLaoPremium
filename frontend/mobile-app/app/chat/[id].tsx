import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Dimensions, Alert, Modal,
  ScrollView, Animated as RNAnimated, Keyboard, Linking
} from 'react-native';
import { STICKERS } from '@/constants/stickers';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import ForwardModal from '@/components/ForwardModal';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Audio, Video, ResizeMode } from 'expo-av';

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
  fileName?: string;    // tên file gốc
  fileSize?: number;    // kích thước file (bytes)
  isRevoked?: boolean;  // tin nhắn đã bị thu hồi
  createdAt?: string;
  status: MessageStatus;
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    messageType: string;
  };
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
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const stickerPanelHeight = useRef(new RNAnimated.Value(0)).current;
  const moreActionsPanelHeight = useRef(new RNAnimated.Value(0)).current;
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  // _id của tin nhắn MỚI NHẤT mà đối phương đã xem
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);

  // ─── Group member count ───
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0);
  
  // ─── Pinned Message State ───
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);

  // ─── Reminder States ───
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date(Date.now() + 3600000)); // default +1h

  const insets = useSafeAreaInsets();

  // ─── Voice Recording States ───
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ─── Audio Playback States ───
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { position: number; duration: number }>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  // ─── Tải ảnh và lưu vào thư viện ────────────────────────────────────────
  const handleDownloadImage = useCallback(async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh để lưu ảnh.');
        return;
      }
      const filename = url.split('/').pop() || `image_${Date.now()}.jpg`;
      const fileUri = FileSystem.documentDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('✅ Thành công', 'Đã lưu ảnh vào Thư viện ảnh.');
    } catch (err) {
      console.log('Download error:', err);
      Alert.alert('Lỗi', 'Không thể tải ảnh về.');
    }
  }, []);

  // ─── Keyboard listener: đóng panels khi bàn phím mở ────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // Đóng sticker panel
        setShowStickers(false);
        RNAnimated.timing(stickerPanelHeight, { toValue: 0, duration: 150, useNativeDriver: false }).start();
        // Đóng more actions panel
        setShowMoreActions(false);
        RNAnimated.timing(moreActionsPanelHeight, { toValue: 0, duration: 150, useNativeDriver: false }).start();
      }
    );
    return () => {
      showSub.remove();
    };
  }, [stickerPanelHeight, moreActionsPanelHeight]);

  // ─── Voice Recording Functions ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần cấp quyền sử dụng Microphone.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.log('Start recording error:', err);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm.');
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {}
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const stopAndSendRecording = useCallback(async () => {
    if (!recordingRef.current || !socket || !currentUserId) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      // Upload to S3
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as any);

      const res = await apiClient.post('/upload/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      const uploadData = res.data?.data;
      if (uploadData?.url) {
        const tempId = `pending-voice-${Date.now()}`;
        const tempMsg: Message = {
          _id: tempId,
          senderId: currentUserId,
          recipientId: recipientId as string,
          content: '[Tin nhắn thoại]',
          messageType: 'audio',
          fileUrl: uploadData.url,
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        setMessages(prev => [tempMsg, ...prev]);
        socket.emit('send_message', {
          tempId,
          conversationId: id,
          senderId: currentUserId,
          recipientId,
          text: '[Tin nhắn thoại]',
          messageType: 'audio',
          fileUrl: uploadData.url,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
        });
      } else {
        Alert.alert('Lỗi', 'Không thể tải lên tin nhắn thoại.');
      }
    } catch (err) {
      console.log('Voice message send error:', err);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn thoại.');
    }
  }, [socket, currentUserId, id, recipientId]);

  const formatAudioTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatRecordTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Audio Playback ─────────────────────────────────────────────────────
  const playAudio = useCallback(async (msgId: string, url: string) => {
    try {
      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingAudioId === msgId) {
        setPlayingAudioId(null);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      setPlayingAudioId(msgId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setAudioProgress(prev => ({
            ...prev,
            [msgId]: {
              position: status.positionMillis || 0,
              duration: status.durationMillis || 1,
            },
          }));
          if (status.didJustFinish) {
            setPlayingAudioId(null);
            soundRef.current = null;
          }
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.log('Play audio error:', err);
      setPlayingAudioId(null);
    }
  }, [playingAudioId]);

  // ─── Preload audio durations ────────────────────────────────────────────────
  useEffect(() => {
    const loadDurations = async () => {
      const audioMsgs = messages.filter(
        m => m.messageType === 'audio' && m.fileUrl && !audioProgress[m._id]
      );
      for (const msg of audioMsgs) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: msg.fileUrl! },
            { shouldPlay: false }
          );
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setAudioProgress(prev => ({
              ...prev,
              [msg._id]: { position: 0, duration: status.durationMillis || 0 },
            }));
          }
          await sound.unloadAsync();
        } catch {}
      }
    };
    loadDurations();
  }, [messages]);

  // ─── Resolve userId ────────────────────────────────────────────────────────
  useEffect(() => {
    const resolveUserId = async () => {
      if (socketUserId) { setCurrentUserId(socketUserId); return; }
      const uid = await AsyncStorage.getItem('userId');
      if (uid) setCurrentUserId(uid);
    };
    resolveUserId();
  }, [socketUserId]);

  const isGroup = (id as string)?.startsWith('group_');
  const isOnline = !isGroup && recipientId ? onlineUsers.includes(recipientId as string) : false;

  // ─── Fetch group member count ───
  useEffect(() => {
    if (!isGroup || !id) return;
    const fetchGroupInfo = async () => {
      try {
        const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=1`);
        // The conversation info isn't returned directly from messages endpoint,
        // so we fetch from conversations list and find ours
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
    if (currentUserId) fetchGroupInfo();
  }, [isGroup, id, currentUserId]);

  // ─── Tải lịch sử ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUserId) return;
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
          // Gán trạng thái dựa trên trường status từ DB (nếu backend lưu), mặc định 'sent'
          status: (m.status as MessageStatus) || 'sent',
          replyTo: m.replyTo,
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
  }, [id, currentUserId]);

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
          fileName: data.fileName,
          fileSize: data.fileSize,
          createdAt: data.timestamp || new Date().toISOString(),
          status: 'received',
          replyTo: data.replyTo,
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

    // Tin nhắn bị XÓA Ở PHÍA TÔI
    const handleMessageDeleted = (data: any) => {
      if (data.messageId) {
        setMessages(prev => prev.filter(m => String(m._id) !== String(data.messageId)));
      }
    };

    // Tin nhắn được GHIM
    const handleMessagePinned = (data: any) => {
      if (data.conversationId === id && data.pinnedMessage) {
        setPinnedMessage(data.pinnedMessage);
      }
    };

    // BỎ GHIM tin nhắn
    const handleMessageUnpinned = (data: any) => {
      if (data.conversationId === id) {
        setPinnedMessage(null);
      }
    };

    socket.on('message_sent', handleMessageSent);
    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_revoked', handleMessageRevoked);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_unpinned', handleMessageUnpinned);

    return () => {
      socket.off('message_sent', handleMessageSent);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_revoked', handleMessageRevoked);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_unpinned', handleMessageUnpinned);
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
    const replyData = replyingMessage ? {
      messageId: replyingMessage._id,
      content: replyingMessage.content,
      senderId: replyingMessage.senderId,
      messageType: replyingMessage.messageType || 'text',
    } : undefined;

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: trimmed,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: replyData,
    };

    setMessages(prev => [tempMsg, ...prev]);
    setText('');
    setReplyingMessage(null);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: trimmed,
      messageType: 'text',
      replyTo: replyData,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
  }, [text, socket, currentUserId, id, recipientId, replyingMessage]);

  // ─── Gửi Sticker ────────────────────────────────────────────────────────────
  const sendSticker = useCallback((stickerUrl: string) => {
    if (!socket || !currentUserId) return;

    const tempId = `pending-sticker-${Date.now()}`;
    const replyData = replyingMessage ? {
      messageId: replyingMessage._id,
      content: replyingMessage.content,
      senderId: replyingMessage.senderId,
      messageType: replyingMessage.messageType || 'text',
    } : undefined;

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: replyData,
    };

    setMessages(prev => [tempMsg, ...prev]);
    toggleStickerPanel(false);
    setReplyingMessage(null);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      replyTo: replyData,
    });
  }, [socket, currentUserId, id, recipientId, replyingMessage]);

  // ─── Toggle Sticker Panel ───────────────────────────────────────────────────
  const toggleStickerPanel = useCallback((show?: boolean) => {
    const shouldShow = show !== undefined ? show : !showStickers;
    if (shouldShow) {
      Keyboard.dismiss();
      // Đóng panel more actions nếu đang mở
      setShowMoreActions(false);
      RNAnimated.spring(moreActionsPanelHeight, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
    }
    setShowStickers(shouldShow);
    RNAnimated.spring(stickerPanelHeight, {
      toValue: shouldShow ? 260 : 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [showStickers, stickerPanelHeight, moreActionsPanelHeight]);

  // ─── Toggle More Actions Panel ──────────────────────────────────────────────
  const toggleMoreActions = useCallback((show?: boolean) => {
    const shouldShow = show !== undefined ? show : !showMoreActions;
    if (shouldShow) {
      Keyboard.dismiss();
      // Đóng sticker panel nếu đang mở
      setShowStickers(false);
      RNAnimated.spring(stickerPanelHeight, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
    }
    setShowMoreActions(shouldShow);
    RNAnimated.spring(moreActionsPanelHeight, {
      toValue: shouldShow ? 280 : 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [showMoreActions, stickerPanelHeight, moreActionsPanelHeight]);

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

  // ─── Dịch tin nhắn ──────────────────────────────────────────────────────────
  const handleTranslate = useCallback(async (msg: Message) => {
    const textToTranslate = msg.content;
    const msgId = msg._id;
    if (!textToTranslate || !msgId) return;

    setTranslatingId(msgId);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=autodetect|vi`);
      const data = await res.json();
      if (data.responseData?.translatedText) {
        setTranslatedMessages(prev => ({
          ...prev,
          [msgId]: data.responseData.translatedText
        }));
      }
    } catch (err) {
      console.log('Translation error:', err);
    } finally {
      setTranslatingId(null);
    }
  }, []);

  // ─── Xóa & Ghim tin nhắn ──────────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback((msg: Message) => {
    Alert.alert(
      'Xóa tin nhắn',
      'Tin nhắn này sẽ bị xóa ở phía bạn. Những người khác vẫn có thể xem được.',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa phía tôi', 
          style: 'destructive',
          onPress: () => {
            if (socket && currentUserId) {
              socket.emit('delete_message_for_me', { messageId: msg._id, userId: currentUserId });
              setMessages(prev => prev.filter(m => String(m._id) !== String(msg._id)));
            }
          }
        }
      ]
    );
  }, [socket, currentUserId]);

  const handleTogglePinMessage = useCallback((msg: Message) => {
    if (!socket || !currentUserId) return;
    const isCurrentlyPinned = pinnedMessage?.messageId === msg._id;
    
    if (isCurrentlyPinned) {
      socket.emit('unpin_message', { conversationId: id, userId: currentUserId });
    } else {
      socket.emit('pin_message', { messageId: msg._id, conversationId: id, userId: currentUserId });
    }
  }, [socket, currentUserId, id, pinnedMessage]);

  // ─── Long press menu cho tin nhắn ──────────────────────────────────────────
  const handleMessageLongPress = useCallback((msg: Message) => {
    if (msg.isRevoked) return; // Không cho thao tác trên tin đã thu hồi
    setActionSheetMessage(msg);
  }, []);

  // ─── Chọn & gửi ảnh/video ─────────────────────────────────────────────────
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      videoMaxDuration: 300,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      setPendingMedia({ uri: asset.uri, type: mediaType });
    }
  };

  const handleSendMedia = async () => {
    if (!pendingMedia || !socket || !currentUserId) return;
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      const isVideo = pendingMedia.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
      formData.append('file', {
        uri: pendingMedia.uri,
        name: `chat-${Date.now()}.${ext}`,
        type: mimeType,
      } as any);

      // Lấy token và base URL giống apiClient nhưng KHÔNG giới hạn timeout
      const token = await AsyncStorage.getItem('accessToken');
      const res = await apiClient.post('/upload/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 0, // Không giới hạn timeout (giống web app)
      });

      const uploadData = res.data?.data;
      if (uploadData?.url) {
        const tempId = `pending-media-${Date.now()}`;
        const msgType = uploadData.messageType || pendingMedia.type;
        const contentLabel = isVideo ? '[Video]' : '[Hình ảnh]';
        const replyData = replyingMessage ? {
          messageId: replyingMessage._id,
          content: replyingMessage.content,
          senderId: replyingMessage.senderId,
          messageType: replyingMessage.messageType || 'text',
        } : undefined;

        const tempMsg: Message = {
          _id: tempId,
          senderId: currentUserId,
          recipientId: recipientId as string,
          content: contentLabel,
          messageType: msgType,
          fileUrl: uploadData.url,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
          imageUrl: !isVideo ? uploadData.url : undefined,
          createdAt: new Date().toISOString(),
          status: 'pending',
          replyTo: replyData,
        };
        setMessages(prev => [tempMsg, ...prev]);
        setReplyingMessage(null);
        socket.emit('send_message', {
          conversationId: id,
          senderId: currentUserId,
          recipientId,
          tempId,
          text: contentLabel,
          messageType: msgType,
          fileUrl: uploadData.url,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
          replyTo: replyData,
        });
      } else {
        Alert.alert('Lỗi', 'Không thể tải lên. Hệ thống chưa cấu hình kho lưu trữ (AWS S3).');
      }
    } catch (err: any) {
      console.log('Media upload error:', err?.message || err);
      Alert.alert('Lỗi', 'Không thể gửi. Vui lòng thử lại.');
    } finally {
      setUploadingMedia(false);
      setPendingMedia(null);
    }
  };

  // ─── Chọn & gửi tài liệu ──────────────────────────────────────────
  const [uploadingFile, setUploadingFile] = useState(false);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDir: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!socket || !currentUserId) return;

      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
        } as any);

        const res = await apiClient.post('/upload/chat', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });

        const uploadData = res.data?.data;
        if (uploadData?.url) {
          const tempId = `pending-file-${Date.now()}`;
          const fileName = uploadData.fileName || asset.name || 'File';
          const fileSize = uploadData.fileSize || asset.size || 0;
          const msgType = uploadData.messageType || 'file';

          const tempMsg: Message = {
            _id: tempId,
            senderId: currentUserId,
            recipientId: recipientId as string,
            content: `[Tệp] ${fileName}`,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName,
            fileSize,
            createdAt: new Date().toISOString(),
            status: 'pending',
          };
          setMessages(prev => [tempMsg, ...prev]);

          socket.emit('send_message', {
            tempId,
            conversationId: id,
            senderId: currentUserId,
            recipientId,
            text: `[Tệp] ${fileName}`,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName,
            fileSize,
          });
        } else {
          Alert.alert('Lỗi', 'Không thể tải lên tệp.');
        }
      } catch (err) {
        console.log('File upload error:', err);
        Alert.alert('Lỗi', 'Không thể gửi tệp. Vui lòng thử lại.');
      } finally {
        setUploadingFile(false);
      }
    } catch (err) {
      console.log('Document picker error:', err);
    }
  }, [socket, currentUserId, id, recipientId]);

  // ─── Tải file xuống ──────────────────────────────────────────────────
  const handleDownloadFile = useCallback(async (url: string, fileName?: string) => {
    try {
      const name = fileName || url.split('/').pop() || `file_${Date.now()}`;
      const fileUri = FileSystem.documentDirectory + name;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      Alert.alert('✅ Thành công', `Đã tải "${name}".`, [
        { text: 'OK' },
        { text: 'Mở', onPress: () => Linking.openURL(uri).catch(() => {}) },
      ]);
    } catch (err) {
      console.log('File download error:', err);
      Alert.alert('Lỗi', 'Không thể tải file về.');
    }
  }, []);

  // ─── Helper: format file size ──────────────────────────────────────
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ─── Helper: get file extension ──────────────────────────────────────
  const getFileExtension = (url?: string): string => {
    if (!url) return '';
    try {
      const parts = url.split('.');
      const ext = parts.pop()?.split('?')[0]?.toUpperCase() || '';
      return ext.length <= 5 ? ext : '';
    } catch { return ''; }
  };

  // ─── Gửi vị trí ──────────────────────────────────────────────────────────
  const handleSendLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập vị trí để sử dụng tính năng này.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      // Reverse geocode to get address
      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          const parts = [geo.name, geo.street, geo.district, geo.city, geo.region].filter(Boolean);
          if (parts.length > 0) address = parts.join(', ');
        }
      } catch { /* keep coordinate fallback */ }

      if (!socket || !currentUserId) return;

      const tempId = `pending-loc-${Date.now()}`;
      const content = JSON.stringify({ latitude, longitude, address });

      const tempMsg: Message = {
        _id: tempId,
        senderId: currentUserId,
        recipientId: recipientId as string,
        content,
        messageType: 'location',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      setMessages(prev => [tempMsg, ...prev]);

      socket.emit('send_message', {
        tempId,
        conversationId: id,
        senderId: currentUserId,
        recipientId,
        text: content,
        messageType: 'location',
      });
    } catch (err) {
      console.log('Location error:', err);
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại.');
    }
  }, [socket, currentUserId, id, recipientId]);

  // ─── Helper: parse location from content ──────────────────────────────
  const parseLocation = (content?: string): { latitude: number; longitude: number; address: string } | null => {
    if (!content) return null;
    try {
      const data = JSON.parse(content);
      if (data.latitude && data.longitude) return data;
    } catch { /* not JSON */ }
    // Fallback: try "lat, lng" format
    const match = content.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]), address: content };
    return null;
  };

  const openLocationInMaps = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
    }) || `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
    });
  };

  // ─── Gửi nhắc hẹn ──────────────────────────────────────────────────────
  const handleSendReminder = useCallback(() => {
    if (!socket || !currentUserId) return;
    if (!reminderText.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung nhắc hẹn.');
      return;
    }

    const tempId = `pending-reminder-${Date.now()}`;
    const content = JSON.stringify({
      text: reminderText.trim(),
      reminderTime: reminderDate.toISOString(),
    });

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content,
      messageType: 'reminder',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setMessages(prev => [tempMsg, ...prev]);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: content,
      messageType: 'reminder',
    });

    setShowReminderModal(false);
    setReminderText('');
    setReminderDate(new Date(Date.now() + 3600000));
  }, [socket, currentUserId, id, recipientId, reminderText, reminderDate]);

  // ─── Helper: parse reminder from content ──────────────────────────────
  const parseReminder = (content?: string): { text: string; reminderTime: string } | null => {
    if (!content) return null;
    try {
      const data = JSON.parse(content);
      if (data.text && data.reminderTime) return data;
    } catch { /* not JSON */ }
    return null;
  };

  // ─── Helper: format reminder date ──────────────────────────────────────
  const formatReminderTime = (isoString: string): string => {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  // ─── Render mỗi tin nhắn ──────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = String(item.senderId) === String(currentUserId);
    const showSeenAvatar = isMine && item.status === 'seen' && String(item._id) === String(lastSeenMessageId);
    const isSticker = !item.isRevoked && item.messageType === 'sticker' && item.fileUrl;
    const isAudio = !item.isRevoked && item.messageType === 'audio' && item.fileUrl;
    const isVideo = !item.isRevoked && item.messageType === 'video' && item.fileUrl;
    const isFile = !item.isRevoked && item.messageType === 'file' && item.fileUrl;
    const isLocation = !item.isRevoked && item.messageType === 'location';
    const isReminder = !item.isRevoked && item.messageType === 'reminder';
    const isImage = !item.isRevoked && !isSticker && !isAudio && !isVideo && !isFile && !isLocation && !isReminder && (
      item.messageType === 'image' ||
      item.imageUrl ||
      (item.content && item.content.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(item.content))
    );
    const imgSrc = item.imageUrl || item.fileUrl || item.content;

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
            ) : (
              <>
                {/* ────── Reply Block ────── */}
                {item.replyTo && (
                  <View style={styles.replyBubble}>
                    <View style={styles.replyBubbleLine} />
                    <View style={styles.replyBubbleTextWrap}>
                      <Text style={styles.replyBubbleHeader}>
                        {String(item.replyTo.senderId) === String(currentUserId) ? 'Bạn' : name}
                      </Text>
                      <Text style={styles.replyBubbleContent} numberOfLines={1}>
                        {item.replyTo.messageType === 'sticker' ? '[Nhãn dán]' :
                         item.replyTo.messageType === 'image' ? '[Hình ảnh]' :
                         item.replyTo.content}
                      </Text>
                    </View>
                  </View>
                )}

                {isSticker ? (
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
                ) : isAudio ? (
                  /* ────── Audio/Voice Message ────── */
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => playAudio(item._id, item.fileUrl!)}
                    onLongPress={() => handleMessageLongPress(item)}
                  >
                    <View style={[styles.audioBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                      <Ionicons
                        name={playingAudioId === item._id ? 'pause' : 'play'}
                        size={24}
                        color="#333"
                      />
                      <Text style={styles.audioTimeText}>
                        {formatAudioTime(audioProgress[item._id]?.position || 0)}
                        {' / '}
                        {formatAudioTime(audioProgress[item._id]?.duration || 0)}
                      </Text>
                      <View style={styles.audioProgressBarBg}>
                        <View
                          style={[
                            styles.audioProgressBarFill,
                            {
                              width: audioProgress[item._id]
                                ? `${Math.min(100, (audioProgress[item._id].position / Math.max(1, audioProgress[item._id].duration)) * 100)}%`
                                : '0%',
                            },
                          ]}
                        />
                      </View>
                      <Ionicons name="volume-medium" size={20} color="#333" />
                    </View>
                  </TouchableOpacity>
                ) : isImage ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setLightboxUrl(imgSrc)}
                    onLongPress={() => handleMessageLongPress(item)}
                  >
                    <Image source={{ uri: imgSrc }} style={styles.msgImage} resizeMode="cover" />
                  </TouchableOpacity>
                ) : isVideo ? (
                  /* ────── Video Message ────── */
                  <View style={styles.videoBubble}>
                    <Video
                      source={{ uri: item.fileUrl! }}
                      useNativeControls
                      shouldPlay={false}
                      isMuted={false}
                      resizeMode={ResizeMode.CONTAIN}
                      style={styles.msgVideo}
                      onError={(e) => console.log('Video error:', e)}
                    />
                  </View>
                ) : isFile ? (
                  /* ────── File/Document Message ────── */
                  (() => {
                    // Extract display name from multiple sources
                    const displayName = item.fileName
                      || (item.content?.startsWith('[Tệp]') ? item.content.replace('[Tệp] ', '').replace('[Tệp]', '') : null)
                      || (item.fileUrl ? decodeURIComponent(item.fileUrl.split('/').pop()?.split('?')[0] || '') : null)
                      || 'Tệp đính kèm';
                    const ext = getFileExtension(item.fileUrl);
                    const sizeText = item.fileSize ? formatFileSize(item.fileSize) : '';
                    const metaText = [ext, sizeText].filter(Boolean).join(' • ');
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleDownloadFile(item.fileUrl!, item.fileName)}
                        onLongPress={() => handleMessageLongPress(item)}
                      >
                        <View style={[styles.fileBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                          <View style={styles.fileIconWrap}>
                            <Ionicons name="document-text" size={24} color={ZaloColors.blue} />
                          </View>
                          <View style={styles.fileInfoWrap}>
                            <Text style={styles.fileName} numberOfLines={2}>
                              {displayName}
                            </Text>
                            {metaText ? (
                              <Text style={styles.fileMeta}>{metaText}</Text>
                            ) : null}
                          </View>
                          <Ionicons name="download-outline" size={22} color={ZaloColors.blue} />
                        </View>
                      </TouchableOpacity>
                    );
                  })()
                ) : isLocation ? (
                  /* ────── Location Message ────── */
                  (() => {
                    const locData = parseLocation(item.content);
                    if (!locData) return null;
                    const mapImg = `https://maps.googleapis.com/maps/api/staticmap?center=${locData.latitude},${locData.longitude}&zoom=15&size=300x200&markers=color:red|${locData.latitude},${locData.longitude}&key=`;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openLocationInMaps(locData.latitude, locData.longitude)}
                        onLongPress={() => handleMessageLongPress(item)}
                      >
                        <View style={[styles.locationBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                          <View style={styles.locationMapPreview}>
                            <Ionicons name="map" size={40} color={ZaloColors.blue} />
                          </View>
                          <View style={styles.locationInfoWrap}>
                            <View style={styles.locationHeader}>
                              <Ionicons name="location-sharp" size={16} color="#FF4757" />
                              <Text style={styles.locationTitle}>Vị trí của tôi</Text>
                            </View>
                            <Text style={styles.locationAddress} numberOfLines={2}>
                              {locData.address}
                            </Text>
                            <Text style={styles.locationCoords}>
                              {locData.latitude.toFixed(6)}, {locData.longitude.toFixed(6)}
                            </Text>
                            <View style={styles.locationOpenBtn}>
                              <Ionicons name="navigate" size={14} color={ZaloColors.blue} />
                              <Text style={styles.locationOpenText}>Mở bản đồ</Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })()
                ) : isReminder ? (
                  /* ────── Reminder Message ────── */
                  (() => {
                    const remData = parseReminder(item.content);
                    if (!remData) return null;
                    const isPast = new Date(remData.reminderTime) < new Date();
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onLongPress={() => handleMessageLongPress(item)}
                      >
                        <View style={[styles.reminderBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                          <View style={[styles.reminderIconWrap, isPast && { backgroundColor: 'rgba(153,153,153,0.15)' }]}>
                            <Ionicons name={isPast ? 'checkmark-circle' : 'alarm'} size={24} color={isPast ? '#999' : '#FF6348'} />
                          </View>
                          <View style={styles.reminderInfoWrap}>
                            <View style={styles.reminderHeader}>
                              <Text style={styles.reminderLabel}>{isPast ? 'Đã nhắc hẹn' : '⏰ Nhắc hẹn'}</Text>
                            </View>
                            <Text style={styles.reminderText} numberOfLines={3}>
                              {remData.text}
                            </Text>
                            <View style={styles.reminderTimeRow}>
                              <Ionicons name="time-outline" size={13} color="#888" />
                              <Text style={styles.reminderTimeText}>
                                {formatReminderTime(remData.reminderTime)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })()
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => handleMessageLongPress(item)}
                  >
                    <View style={[styles.msgBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                      <Text style={[styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                        {item.content}
                      </Text>
                      {translatedMessages[item._id] && (
                        <View style={styles.translatedWrap}>
                          <Text style={[styles.translatedText, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                            {translatedMessages[item._id]}
                          </Text>
                        </View>
                      )}
                      {translatingId === item._id && (
                        <View style={styles.translatingWrap}>
                          <ActivityIndicator size="small" color="#999" />
                          <Text style={styles.translatingText}>Đang dịch...</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </>
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
    <SafeAreaView edges={['top']} style={styles.container}>
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
          ) : isGroup && groupMemberCount > 0 ? (
            <Text style={styles.headerStatus}>{groupMemberCount} thành viên</Text>
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

      {/* Pinned Message Banner */}
      {pinnedMessage && pinnedMessage.messageId && (pinnedMessage.content || pinnedMessage.messageType) && (
        <View style={styles.pinnedBanner}>
          <Ionicons name="pricetag" size={16} color={ZaloColors.blue} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedBannerTitle}>Tin nhắn đã ghim</Text>
            <Text style={styles.pinnedBannerContent} numberOfLines={1}>
              {pinnedMessage.messageType === 'sticker' ? '[Nhãn dán]' :
               pinnedMessage.messageType === 'image' ? '[Hình ảnh]' :
               pinnedMessage.content}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.unpinBtn}
            onPress={() => {
              if (socket && currentUserId) {
                socket.emit('unpin_message', { conversationId: id, userId: currentUserId });
              }
            }}
          >
            <Text style={styles.unpinBtnText}>Bỏ ghim</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chat area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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

        {/* Reply Preview */}
        {replyingMessage && (
          <View style={styles.replyPreviewWrap}>
            <View style={styles.replyPreviewBorder} />
            <View style={styles.replyPreviewContentWrap}>
              <Text style={styles.replyPreviewHeader}>
                Đang trả lời {String(replyingMessage.senderId) === String(currentUserId) ? 'chính mình' : name}
              </Text>
              <Text style={styles.replyPreviewContent} numberOfLines={1}>
                {replyingMessage.messageType === 'sticker' ? '[Nhãn dán]' :
                 replyingMessage.messageType === 'image' ? '[Hình ảnh]' :
                 (replyingMessage.content || '[Tệp đính kèm]')}
              </Text>
            </View>
            <TouchableOpacity style={styles.replyPreviewClose} onPress={() => setReplyingMessage(null)}>
              <Ionicons name="close-circle" size={24} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        {isRecording ? (
          /* ────── Voice Recording UI ────── */
          <View style={styles.recordingBar}>
            <TouchableOpacity style={styles.recordCancelBtn} onPress={cancelRecording}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.recordingCenter}>
              <View style={styles.recordingDotOuter}>
                <View style={styles.recordingDot} />
              </View>
              <Text style={styles.recordingTimer}>{formatRecordTime(recordingTime)}</Text>
              <View style={styles.recordingWaveBars}>
                {[8, 14, 20, 12, 18, 10, 16, 22, 14, 8, 18, 12, 20, 10, 16].map((h, i) => (
                  <View key={i} style={[styles.recordingWaveBar, { height: h }]} />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.recordSendBtn} onPress={stopAndSendRecording}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
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
            ref={inputRef}
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
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => toggleMoreActions()}
              >
                <Ionicons
                  name={showMoreActions ? 'ellipsis-horizontal' : 'ellipsis-horizontal'}
                  size={24}
                  color={showMoreActions ? ZaloColors.blue : '#666'}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={startRecording}>
                <Ionicons name="mic-outline" size={26} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
                <Ionicons name="image-outline" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        )}

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

        {/* ────── More Actions Panel ────── */}
        <RNAnimated.View style={[styles.moreActionsPanel, { height: moreActionsPanelHeight }]}>
          {showMoreActions && (
            <View style={styles.moreActionsPanelInner}>
              <ScrollView
                contentContainerStyle={styles.moreActionsGrid}
                showsVerticalScrollIndicator={false}
              >
                {/* Row 1 */}
                <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handleSendLocation(); }}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#FF4757' }]}>
                    <Ionicons name="location" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Vị trí</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handlePickDocument(); }}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#3742fa' }]}>
                    <Ionicons name="document-text" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Tài liệu</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); setShowReminderModal(true); }}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#FF6348' }]}>
                    <Ionicons name="alarm" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Nhắc hẹn</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#1E90FF' }]}>
                    <Ionicons name="flash" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Tin nhắn nhanh</Text>
                </TouchableOpacity>

                {/* Row 2 */}
                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#2ED573' }]}>
                    <Ionicons name="cash" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Chuyển khoản</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#3742fa' }]}>
                    <Ionicons name="person-circle" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Danh thiếp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handlePickImage(); }}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#1E90FF' }]}>
                    <Ionicons name="folder-open" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>My Documents</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#A55EEA' }]}>
                    <Ionicons name="card" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Gửi số tài khoản</Text>
                </TouchableOpacity>

                {/* Row 3 */}
                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#FECA57' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>GIF</Text>
                  </View>
                  <Text style={styles.moreActionLabel}>GIF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#FF6B81' }]}>
                    <Ionicons name="musical-notes" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Thu âm</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreActionItem}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#FECA57' }]}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Aa</Text>
                  </View>
                  <Text style={styles.moreActionLabel}>Kiểu chữ</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          )}
        </RNAnimated.View>
      </KeyboardAvoidingView>

      <View style={{ height: insets.bottom, backgroundColor: isRecording ? '#FFF0F0' : '#fff' }} />

      {/* Modal preview ảnh/video trước khi gửi */}
      <Modal visible={!!pendingMedia} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <View style={styles.previewBox}>
            {pendingMedia && pendingMedia.type === 'video' ? (
              <Video
                source={{ uri: pendingMedia.uri }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                style={styles.previewVideo}
              />
            ) : pendingMedia ? (
              <Image source={{ uri: pendingMedia.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewBtn} onPress={() => setPendingMedia(null)}>
                <Ionicons name="close" size={22} color="#fff" />
                <Text style={styles.previewBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewSendBtn, uploadingMedia && { opacity: 0.6 }]}
                onPress={handleSendMedia}
                disabled={uploadingMedia}
              >
                {uploadingMedia ? (
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

      {/* ────── Image Lightbox ────── */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxUrl(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Download Button */}
          <TouchableOpacity
            style={styles.lightboxDownloadBtn}
            onPress={() => { if (lightboxUrl) handleDownloadImage(lightboxUrl); }}
          >
            <Ionicons name="download-outline" size={26} color="#fff" />
          </TouchableOpacity>

          {/* Image */}
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ────── Reminder Modal ────── */}
      <Modal visible={showReminderModal} transparent animationType="slide">
        <View style={styles.reminderModalOverlay}>
          <View style={styles.reminderModalBox}>
            <View style={styles.reminderModalHeader}>
              <Text style={styles.reminderModalTitle}>⏰ Tạo nhắc hẹn</Text>
              <TouchableOpacity onPress={() => setShowReminderModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reminderModalLabel}>Nội dung nhắc hẹn</Text>
            <TextInput
              style={styles.reminderModalInput}
              placeholder="Nhập nội dung nhắc hẹn..."
              placeholderTextColor="#999"
              value={reminderText}
              onChangeText={setReminderText}
              multiline
              maxLength={200}
            />

            <Text style={styles.reminderModalLabel}>Thời gian</Text>
            <View style={styles.reminderTimePickerRow}>
              {[
                { label: '30 phút', mins: 30 },
                { label: '1 giờ', mins: 60 },
                { label: '3 giờ', mins: 180 },
                { label: 'Ngày mai', mins: 1440 },
              ].map((opt) => {
                const optDate = new Date(Date.now() + opt.mins * 60000);
                const isSelected = Math.abs(reminderDate.getTime() - optDate.getTime()) < 60000;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.reminderTimeChip, isSelected && styles.reminderTimeChipActive]}
                    onPress={() => setReminderDate(new Date(Date.now() + opt.mins * 60000))}
                  >
                    <Text style={[styles.reminderTimeChipText, isSelected && styles.reminderTimeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.reminderPreviewTimeRow}>
              <Ionicons name="calendar-outline" size={16} color="#FF6348" />
              <Text style={styles.reminderPreviewTimeText}>
                {formatReminderTime(reminderDate.toISOString())}
              </Text>
            </View>

            <TouchableOpacity style={styles.reminderSendBtn} onPress={handleSendReminder}>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.reminderSendBtnText}>Gửi nhắc hẹn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ────── Custom Action Sheet Modal ────── */}
      <Modal
        visible={!!actionSheetMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetMessage(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetMessage(null)}
        >
          <View style={styles.actionSheetContainer}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Tùy chọn tin nhắn</Text>

            {/* Trả lời */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                if (actionSheetMessage) setReplyingMessage(actionSheetMessage);
                setActionSheetMessage(null);
              }}
            >
              <Ionicons name="arrow-undo-outline" size={22} color="#333" />
              <Text style={styles.actionSheetItemText}>Trả lời</Text>
            </TouchableOpacity>

            {/* Chuyển tiếp */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                if (actionSheetMessage) setForwardingMessage(actionSheetMessage);
                setActionSheetMessage(null);
              }}
            >
              <Ionicons name="share-outline" size={22} color="#333" />
              <Text style={styles.actionSheetItemText}>Chuyển tiếp</Text>
            </TouchableOpacity>

            {/* Ghim / Bỏ ghim */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                if (actionSheetMessage) handleTogglePinMessage(actionSheetMessage);
                setActionSheetMessage(null);
              }}
            >
              <Ionicons name={pinnedMessage?.messageId === actionSheetMessage?._id ? 'pin-outline' : 'pin'} size={22} color="#333" />
              <Text style={styles.actionSheetItemText}>
                {pinnedMessage?.messageId === actionSheetMessage?._id ? 'Bỏ ghim' : 'Ghim tin nhắn'}
              </Text>
            </TouchableOpacity>

            {/* Dịch (chỉ với tin nhắn text) */}
            {actionSheetMessage && (!actionSheetMessage.messageType || actionSheetMessage.messageType === 'text') && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  if (actionSheetMessage) handleTranslate(actionSheetMessage);
                  setActionSheetMessage(null);
                }}
              >
                <Ionicons name="language-outline" size={22} color="#333" />
                <Text style={styles.actionSheetItemText}>
                  {translatingId === actionSheetMessage?._id ? 'Đang dịch...' : 'Dịch sang Tiếng Việt'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Separator */}
            <View style={styles.actionSheetSeparator} />

            {/* Thu hồi (chỉ với tin nhắn của mình) */}
            {actionSheetMessage && String(actionSheetMessage.senderId) === String(currentUserId) && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  const msg = actionSheetMessage;
                  setActionSheetMessage(null);
                  if (msg) handleRevoke(msg);
                }}
              >
                <Ionicons name="refresh-outline" size={22} color="#FF4757" />
                <Text style={[styles.actionSheetItemText, { color: '#FF4757' }]}>Thu hồi</Text>
              </TouchableOpacity>
            )}

            {/* Xóa phía tôi */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const msg = actionSheetMessage;
                setActionSheetMessage(null);
                if (msg) handleDeleteMessage(msg);
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#FF4757" />
              <Text style={[styles.actionSheetItemText, { color: '#FF4757' }]}>Xóa phía tôi</Text>
            </TouchableOpacity>

            {/* Hủy */}
            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setActionSheetMessage(null)}
            >
              <Text style={styles.actionSheetCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

  // ─── Audio/Voice Message Bubble ───
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.75,
    minWidth: SCREEN_WIDTH * 0.55,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
  },
  audioTimeText: {
    fontSize: 13,
    color: '#333',
    fontVariant: ['tabular-nums'],
    minWidth: 70,
  },
  audioProgressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressBarFill: {
    height: '100%',
    backgroundColor: '#333',
    borderRadius: 2,
  },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFD6D6',
  },
  recordingCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recordingDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,71,87,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
  },
  recordingTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF4757',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  recordingWaveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recordingWaveBar: {
    width: 3,
    backgroundColor: '#FF6B81',
    borderRadius: 2,
  },
  recordCancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF4757',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ZaloColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Reply Text Bubble ───
  replyBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  replyBubbleLine: {
    width: 3,
    backgroundColor: ZaloColors.blue,
    borderRadius: 2,
    marginRight: 6,
  },
  replyBubbleTextWrap: {
    flex: 1,
  },
  replyBubbleHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  replyBubbleContent: {
    fontSize: 13,
    color: '#555',
  },

  // ─── Quoting Input Preview ───
  replyPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyPreviewBorder: {
    width: 3,
    backgroundColor: ZaloColors.blue,
    borderRadius: 2,
    height: '100%',
    marginRight: 8,
  },
  replyPreviewContentWrap: {
    flex: 1,
  },
  replyPreviewHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  replyPreviewContent: {
    fontSize: 13,
    color: '#555',
  },
  replyPreviewClose: {
    padding: 4,
  },

  // ─── Phần dịch tin nhắn ───
  translatedWrap: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  translatedText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    opacity: 0.9,
  },
  translatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  translatingText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
    fontStyle: 'italic',
  },

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

  // ─── Video Message Bubble ───
  videoBubble: {
    width: SCREEN_WIDTH * 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  msgVideo: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75 * 9 / 16,
  },

  // ─── File/Document Bubble ───
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.75,
    minWidth: SCREEN_WIDTH * 0.55,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
  },
  fileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(0,104,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfoWrap: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    lineHeight: 19,
  },
  fileMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },

  // ─── Location Bubble ───
  locationBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    minWidth: SCREEN_WIDTH * 0.6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  locationMapPreview: {
    width: '100%',
    height: 100,
    backgroundColor: '#e8f4fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfoWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  locationAddress: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  locationOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationOpenText: {
    fontSize: 13,
    fontWeight: '500',
    color: ZaloColors.blue,
  },

  // ─── Reminder Bubble ───
  reminderBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: SCREEN_WIDTH * 0.75,
    minWidth: SCREEN_WIDTH * 0.6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
  },
  reminderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,99,72,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfoWrap: {
    flex: 1,
    minWidth: 0,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6348',
  },
  reminderText: {
    fontSize: 14,
    color: '#222',
    lineHeight: 20,
    marginBottom: 6,
  },
  reminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderTimeText: {
    fontSize: 12,
    color: '#888',
  },

  // ─── Reminder Modal ───
  reminderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reminderModalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  reminderModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reminderModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  reminderModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
    marginTop: 4,
  },
  reminderModalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  reminderTimePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reminderTimeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reminderTimeChipActive: {
    backgroundColor: 'rgba(255,99,72,0.1)',
    borderColor: '#FF6348',
  },
  reminderTimeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  reminderTimeChipTextActive: {
    color: '#FF6348',
    fontWeight: '600',
  },
  reminderPreviewTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F2',
    borderRadius: 10,
  },
  reminderPreviewTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6348',
  },
  reminderSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6348',
    paddingVertical: 14,
    borderRadius: 14,
  },
  reminderSendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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

  // ─── More Actions Panel ───
  moreActionsPanel: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  moreActionsPanelInner: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  moreActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  moreActionItem: {
    width: (SCREEN_WIDTH - 16) / 4,
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  moreActionLabel: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    lineHeight: 15,
    maxWidth: 76,
  },

  // Modal preview ảnh
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewBox: { width: '90%', alignItems: 'center' },
  previewImage: { width: '100%', height: 320, borderRadius: 12, marginBottom: 24 },
  previewVideo: { width: '100%', height: 320, borderRadius: 12, marginBottom: 24 },
  previewActions: { flexDirection: 'row', gap: 16 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewSendBtn: { backgroundColor: ZaloColors.blue },
  previewBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // ─── Image Lightbox ───
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxDownloadBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },

  // ─── Pinned Message Banner ───
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  pinnedBannerTitle: {
    fontSize: 12,
    color: ZaloColors.blue,
    fontWeight: '600',
    marginBottom: 2,
  },
  pinnedBannerContent: {
    fontSize: 14,
    color: '#333',
  },
  unpinBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    marginLeft: 8,
  },
  unpinBtnText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },

  // ─── Action Sheet Modal ───
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 8,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 12,
  },
  actionSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  actionSheetItemText: {
    fontSize: 16,
    color: '#333',
  },
  actionSheetSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  actionSheetCancelBtn: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
