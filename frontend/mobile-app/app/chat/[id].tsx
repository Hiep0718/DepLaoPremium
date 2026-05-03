import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, Dimensions,
  FlatList, ActivityIndicator, Text, TouchableOpacity, Modal, Image, ScrollView,
  TextInput, Linking, Animated as RNAnimated, TouchableWithoutFeedback, Keyboard, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useSocket } from '@/contexts/SocketContext';

import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import { fetchAiMessages, clearAiHistory, streamAiChatMobile } from '@/services/aiChat.service';

import { ZaloColors } from '@/constants/zalo';
import { Message } from '@/types/chat';

// Components
import ChatHeader from '@/components/chat/ChatHeader';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInputBar from '@/components/chat/ChatInputBar';
import ActionPanels from '@/components/chat/ActionPanels';

import ForwardModal from '@/components/ForwardModal';
import ContactSelectionModal from '@/components/ContactSelectionModal';
import CreatePollModal from '@/components/chat/CreatePollModal';

// Hooks
import { useChatMessages } from '@/hooks/chat/useChatMessages';
import { useChatSocket } from '@/hooks/chat/useChatSocket';
import { useVoiceRecording } from '@/hooks/chat/useVoiceRecording';
import { useMediaHandling } from '@/hooks/chat/useMediaHandling';
import { useAudioPlayback } from '@/hooks/chat/useAudioPlayback';
import { useChatActions } from '@/hooks/chat/useChatActions';


export default function ChatScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;
  const name = params.name as string;
  const avatar = params.avatar as string;
  const isOnline = params.isOnline === 'true';
  const recipientId = params.recipientId as string;

  const { socket, currentUserId } = useSocket();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // States
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const { messages, setMessages, isLoading, pinnedMessage, setPinnedMessage, groupMemberCount, isGroup, memberMap, participantRoles, groupName, groupAvatar, groupSettings } = useChatMessages(id, currentUserId, socket);
  const { isOtherTyping, lastSeenMessageId } = useChatSocket({ socket, id, currentUserId, setMessages, setPinnedMessage });

  const myRole = React.useMemo(() => participantRoles[String(currentUserId)] || 'member', [participantRoles, currentUserId]);

  const canSendMessage = React.useMemo(() => {
    if (!isGroup) return true;
    if (groupSettings?.sendMessages === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [groupSettings?.sendMessages, myRole, isGroup]);

  const canCreatePoll = React.useMemo(() => {
    if (!isGroup) return true;
    if (groupSettings?.pinAndPolls === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [groupSettings?.pinAndPolls, myRole, isGroup]);
  // BỔ SUNG: State kiểm tra quyền thành viên
  const [isMember, setIsMember] = useState(true);

  // BỔ SUNG: Cập nhật state isMember khi load dữ liệu từ API về
  useEffect(() => {
    if (isGroup && participantRoles && Object.keys(participantRoles).length > 0) {
      // Nếu ID của mình không có trong participantRoles -> không còn là thành viên
      setIsMember(!!participantRoles[String(currentUserId)]);
    }
  }, [isGroup, participantRoles, currentUserId]);
  const dynamicName = isGroup ? (groupName || name) : name;
  const dynamicAvatar = isGroup ? (groupAvatar || avatar) : avatar;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);


  const isAi = (id as string)?.startsWith('ai_');
  const [isAiStreaming, setIsAiStreaming] = useState(false);

  // groupMemberCount is now provided by useChatMessages hook

  // Pinned Message state is now managed by useChatMessages hook

  // ─── Reminder States ───

  const [showPollModal, setShowPollModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Message | null>(null);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState<Date>(new Date(Date.now() + 3600000));

  // Animations
  const stickerPanelHeight = useRef(new RNAnimated.Value(0)).current;
  const moreActionsPanelHeight = useRef(new RNAnimated.Value(0)).current;

  // Custom Hooks already defined above
  const { isRecording, recordingTime, startRecording, cancelRecording, stopAndSendRecording } = useVoiceRecording({ socket, currentUserId, id, recipientId, setMessages });
  const { pendingMedia, setPendingMedia, uploadingMedia, uploadProgress, uploadingFile, handlePickImage, handleRemovePendingMedia, handleSendMedia, handlePickDocument } = useMediaHandling({ socket, currentUserId, id, recipientId, setMessages, replyingMessage, setReplyingMessage });
  const { playingAudioId, audioProgress, playAudio } = useAudioPlayback(messages);
  const { handleSend: _handleSend, sendSticker, handleRevoke, handleDeleteMessage, handleTogglePinMessage, handleTranslate, handleSendLocation, handleSendContact, handleSendReminder, handleReactMessage, handleCreatePoll, handleVotePoll, handleAddPollOption, lastReaction, translatingId, translatedMessages } = useChatActions({
    socket, currentUserId, id, recipientId, setMessages, replyingMessage, setReplyingMessage, pinnedMessage, toggleStickerPanel: (s) => toggleStickerPanel(s), setShowReminderModal, reminderText, setReminderText, reminderDate, setReminderDate
  });

  const [reactionTooltipId, setReactionTooltipId] = useState<string | null>(null);

  const REACTION_EMOJIS = [
    { type: 'love', icon: '❤️' },
    { type: 'like', icon: '👍' },
    { type: 'haha', icon: '😆' },
    { type: 'wow', icon: '😯' },
    { type: 'sad', icon: '😢' },
    { type: 'angry', icon: '😡' },
  ];


  // Voice and audio functions are now managed by custom hooks (useVoiceRecording, useAudioPlayback)

  // userId resolution, isGroup, isOnline, and group info fetching
  // are now handled by custom hooks (useChatMessages, useSocket params)



  // ─── Socket listeners ──────────────────────────────────────────────────────
  // ─── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // Hàm thông minh tự "dịch" dữ liệu Socket thô thành chuỗi chuẩn cho MessageBubble
    const parseSystemContent = (action: string, data: any) => {
      const actor = data.requesterId || data.adminId || data.userId || data.senderId || '';
      const target = data.targetUserId || data.targetId || data.memberId || data.userId || '';

      switch (action) {
        case 'member_left': return `member_left:${actor || target}`;
        case 'member_removed': return `member_removed:${actor}:${target}`;
        case 'added_members':
          const added = Array.isArray(data.targetUserIds) ? data.targetUserIds.join(',') : target;
          return `added_members:${added}`;
        case 'role_updated':
          const role = data.newRole || data.role || 'member';
          if (role === 'leader') return `role_leader:${actor}:${target}`;
          if (role === 'deputy') return `role_deputy:${actor}:${target}`;
          return `role_undeputy:${actor}:${target}`;
        case 'group_disbanded': return `group_disbanded:${actor}`;
        case 'group_updated': return `group_updated:${actor}:Cập nhật thông tin nhóm`;
        default: return '';
      }
    };

    // Bắt các sự kiện nhóm (Rời nhóm, đổi quyền, thêm thành viên...)
    const handleGroupAction = (actionName: string) => (data: any) => {
      if (data.conversationId !== id) return;

      const content = parseSystemContent(actionName, data);
      if (!content) return;

      // Xử lý ẩn thanh chat nếu mình bị ảnh hưởng
      if (actionName === 'member_left' && String(data.userId || data.targetUserId) === String(currentUserId)) setIsMember(false);
      if (actionName === 'member_removed' && String(data.targetUserId || data.userId) === String(currentUserId)) setIsMember(false);
      if (actionName === 'group_disbanded') {
        setIsMember(false);
        Alert.alert('Nhóm đã bị giải tán', 'Nhóm chat này đã được trưởng nhóm giải tán.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      }

      setMessages(prev => {
        // LỌC BỎ các tin nhắn rỗng ("") gây lỗi hiển thị trước đó
        const filtered = prev.filter(m => !(m.messageType === 'system' && (!m.content || m.content.trim() === '')));

        const systemMsg: Message = {
          _id: `sys_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          senderId: 'system',
          recipientId: '',
          content: content,
          messageType: 'system',
          createdAt: new Date().toISOString(),
          status: 'received',
        };
        return [systemMsg, ...filtered];
      });
    };

    const handleMessageSent = (data: any) => {
      if (data.conversationId !== id) return;
      
      setMessages(prev => {
        // 1. Trực tiếp xử lý bằng tempId (Tin nhắn do chính máy này gửi)
        if (data.tempId) {
          const pendingIdx = prev.findIndex(m => m._id === data.tempId || m.tempId === data.tempId);
          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = { 
              ...updated[pendingIdx], 
              tempId: data.tempId, 
              _id: data.messageId || updated[pendingIdx]._id, 
              status: 'sent' 
            };
            return updated;
          }
          // Nếu có tempId mà không tìm thấy (có thể đã bị fetchHistory xóa), thì KHÔNG thêm mới để tránh duplicate
          return prev;
        }

        // 2. Xử lý tin nhắn hệ thống sinh ra (ví dụ: bắt đầu cuộc gọi nhóm, không có tempId)
        if (data.messageId && !prev.some(m => String(m._id) === String(data.messageId) || String(m.tempId) === String(data.messageId))) {
          const newMsg: Message = {
            _id: data.messageId, 
            senderId: String(data.senderId || currentUserId), 
            recipientId: String(data.recipientId || ''),
            content: data.text || data.content || '', 
            messageType: data.messageType || 'text', 
            fileUrl: data.fileUrl,
            createdAt: data.timestamp || new Date().toISOString(), 
            status: 'sent',
          };
          return [newMsg, ...prev];
        }
        return prev;
      });
    };

    const handleMessageReceived = (data: any) => {
      if (data.conversationId !== id) return;

      let content = data.content || data.text || '';
      const msgType = data.messageType || 'text';

      // Cứu cánh: Nếu Backend gửi message_received hệ thống mà quên nội dung (content='')
      if (msgType === 'system') {
        if (!content && (data.action || data.type)) {
          content = parseSystemContent(data.action || data.type, data);
        }

        if (content.startsWith('member_removed:')) {
          const removedId = content.split(':')[2];
          if (String(removedId) === String(currentUserId)) setIsMember(false);
        } else if (content.startsWith('member_left:')) {
          const leftId = content.split(':')[1];
          if (String(leftId) === String(currentUserId)) setIsMember(false);
        } else if (content.startsWith('group_disbanded:')) {
          setIsMember(false);
          Alert.alert('Nhóm đã bị giải tán', 'Nhóm chat này đã được trưởng nhóm giải tán.', [
            { text: 'OK', onPress: () => router.replace('/(tabs)') }
          ]);
        }
      }

      setMessages(prev => {
        const exists = prev.some(m => String(m._id) === String(data.messageId));
        if (exists) return prev;

        // LỌC BỎ rác rỗng
        const filtered = prev.filter(m => !(m.messageType === 'system' && (!m.content || m.content.trim() === '')));

        const newMsg: Message = {
          _id: data.messageId || Math.random().toString(),
          senderId: String(data.senderId), recipientId: String(data.recipientId || ''),
          content: content, messageType: msgType, fileUrl: data.fileUrl,
          fileName: data.fileName, fileSize: data.fileSize,
          createdAt: data.timestamp || new Date().toISOString(), status: 'received', replyTo: data.replyTo,
        };

        // Bỏ qua mark_as_seen cho AI conversation (ID ảo, không có trong DB)
        if (!isAi) {
          socket.emit('mark_as_seen', { messageId: newMsg._id, conversationId: id, userId: currentUserId });
        }
        return [newMsg, ...filtered];
      });
    };

    const handleMessageSeen = (data: any) => {
      if (data.conversationId !== id || String(data.seenBy) === String(currentUserId)) return;
      setMessages(prev => prev.map(m => String(m._id) === String(data.messageId) ? { ...m, status: 'seen' } : m));
    };

    const handleMessageRevoked = (data: any) => {
      if (data.messageId) setMessages(prev => prev.map(m => String(m._id) === String(data.messageId) ? { ...m, isRevoked: true } : m));
    };

    const handleMessageDeleted = (data: any) => {
      if (data.messageId) setMessages(prev => prev.filter(m => String(m._id) !== String(data.messageId)));
    };

    const handleMessagePinned = (data: any) => {
      if (data.conversationId === id && data.pinnedMessage) setPinnedMessage(data.pinnedMessage);
    };

    const handleMessageUnpinned = (data: any) => {
      if (data.conversationId === id) setPinnedMessage(null);
    };

    // Đăng ký listeners
    socket.on('message_sent', handleMessageSent);
    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('message_revoked', handleMessageRevoked);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_unpinned', handleMessageUnpinned);

    // Đăng ký listeners cho các Event nhóm chuẩn
    const onMemberLeft = handleGroupAction('member_left');
    const onMemberRemoved = handleGroupAction('member_removed');
    const onAddedMembers = handleGroupAction('added_members');
    const onRoleUpdated = handleGroupAction('role_updated');
    const onGroupDisbanded = handleGroupAction('group_disbanded');
    const onGroupUpdated = handleGroupAction('group_updated');

    socket.on('member_left', onMemberLeft);
    socket.on('member_removed', onMemberRemoved);
    socket.on('added_members', onAddedMembers);
    socket.on('role_updated', onRoleUpdated);
    socket.on('group_disbanded', onGroupDisbanded);
    socket.on('group_updated', onGroupUpdated);

    return () => {
      socket.off('message_sent', handleMessageSent);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('message_revoked', handleMessageRevoked);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_unpinned', handleMessageUnpinned);

      socket.off('member_left', onMemberLeft);
      socket.off('member_removed', onMemberRemoved);
      socket.off('added_members', onAddedMembers);
      socket.off('role_updated', onRoleUpdated);
      socket.off('group_disbanded', onGroupDisbanded);
      socket.off('group_updated', onGroupUpdated);
    };
  }, [socket, id, currentUserId]);

  // ─── Typing indicator ──────────────────────────────────────────────────────

  // Derived actions — override for AI conversations
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId) return;

    if (isAi) {
      // ── AI Chat Route — gửi qua AI service, không qua socket ──
      const userMsg: Message = {
        _id: `user_${Date.now()}`,
        senderId: currentUserId,
        recipientId: 'ai_food_bot',
        content: trimmed,
        messageType: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
      };
      setMessages(prev => [userMsg, ...prev]);
      setText('');

      // Start AI streaming
      setIsAiStreaming(true);
      let aiResponse = '';

      streamAiChatMobile(
        currentUserId,
        trimmed,
        (token) => {
          aiResponse += token;
          // Update streaming message in real-time
          setMessages(prev => {
            const streamingIdx = prev.findIndex(m => m._id === '__ai_streaming__');
            const streamingMsg: Message = {
              _id: '__ai_streaming__',
              senderId: 'ai_food_bot',
              recipientId: currentUserId,
              content: aiResponse,
              messageType: 'text',
              createdAt: new Date().toISOString(),
              status: 'received',
            };
            if (streamingIdx > -1) {
              const updated = [...prev];
              updated[streamingIdx] = streamingMsg;
              return updated;
            }
            return [streamingMsg, ...prev];
          });
        },
        () => {
          // Done — replace streaming placeholder with final message
          setIsAiStreaming(false);
          setMessages(prev => prev.map(m =>
            m._id === '__ai_streaming__'
              ? { ...m, _id: `ai_${Date.now()}` }
              : m
          ));
        },
        (errMsg) => {
          setIsAiStreaming(false);
          console.log('AI Error:', errMsg);
          // Remove streaming message on error
          setMessages(prev => prev.filter(m => m._id !== '__ai_streaming__'));
        }
      );
    } else {
      // ── Normal Chat Route — gửi qua socket ──
      _handleSend(text, setText, setIsTyping);
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (isAi) return; // AI chat không cần typing indicator qua socket
    if (!isTyping && val.trim().length > 0) {
      setIsTyping(true);
      socket?.emit('typing', { conversationId: id, userId: currentUserId, isTyping: true });
    } else if (isTyping && val.trim().length === 0) {
      setIsTyping(false);
      socket?.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
    }
  };


  // handleSend is already defined above

  // ─── Gửi Sticker ────────────────────────────────────────────────────────────
  // sendSticker is now provided by useChatActions hook

  // ─── Toggle Sticker Panel ───────────────────────────────────────────────────
  const toggleStickerPanel = (forceShow?: boolean) => {
    const willShow = forceShow !== undefined ? forceShow : !showStickers;
    if (willShow) {

      setShowMoreActions(false);
      RNAnimated.timing(moreActionsPanelHeight, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    }
    setShowStickers(willShow);
    RNAnimated.timing(stickerPanelHeight, {
      toValue: willShow ? 300 : 0, duration: 250, useNativeDriver: false
    }).start();
  };

  const toggleMoreActions = (forceShow?: boolean) => {
    const willShow = forceShow !== undefined ? forceShow : !showMoreActions;
    if (willShow) {
      setShowStickers(false);
      RNAnimated.timing(stickerPanelHeight, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    }
    setShowMoreActions(willShow);
    RNAnimated.timing(moreActionsPanelHeight, {
      toValue: willShow ? 320 : 0, duration: 250, useNativeDriver: false
    }).start();
  };

  const handleDownloadFile = async (url: string, fileName?: string) => {
    try {
      const name = fileName || url.split('/').pop() || 'downloaded_file';
      const fileUri = `${(FileSystem as any).documentDirectory}${name}`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      console.log('Download error:', err);
    }
  };

  const handleDownloadImage = async (url: string) => {
    await handleDownloadFile(url, `image_${Date.now()}.jpg`);
  };

  const openLocationInMaps = (lat: number, lng: number) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const label = 'Vị trí';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  const formatReminderTime = (isoString: string): string => {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: isRecording ? '#FFF0F0' : '#fff' }}>
      {/* Background for top notch on iOS */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: ZaloColors.blue }} />

      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <StatusBar backgroundColor={ZaloColors.blue} style="light" />
        <ChatHeader
          id={id} name={dynamicName} avatar={dynamicAvatar} recipientId={recipientId}
          isGroup={isGroup} groupMemberCount={groupMemberCount}
          isOnline={isOnline} isOtherTyping={isOtherTyping}
        />

        {/* Pinned Message Banner */}

        {/* Pinned Message */}

        {
          pinnedMessage && pinnedMessage.messageId && (pinnedMessage.content || pinnedMessage.messageType) && (
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
                onPress={() => socket?.emit('unpin_message', { conversationId: id, userId: currentUserId })}
              >
                <Text style={styles.unpinBtnText}>Bỏ ghim</Text>
              </TouchableOpacity>
            </View>
          )
        }

        <KeyboardAvoidingView
          style={[styles.chatArea, { backgroundColor: '#e2e9f1' }]}
          behavior="padding"
        >
          <View style={{ flex: 1 }}>
            {isLoading ? (
              <View style={styles.centerWrap}>
                <ActivityIndicator size="large" color={ZaloColors.blue} />
              </View>
            ) : isAi && messages.length === 0 && !isAiStreaming ? (
              /* AI Welcome Screen — khi chưa có tin nhắn */
              <View style={styles.aiWelcomeWrap}>
                <View style={styles.aiWelcomeHero}>
                  <Text style={{ fontSize: 48 }}>🍜</Text>
                </View>
                <Text style={styles.aiWelcomeTitle}>Bếp AI 🍜</Text>
                <Text style={styles.aiWelcomeDesc}>
                  Trợ lý ẩm thực thông minh — Hỏi tôi về công thức, mẹo nấu ăn, gợi ý món ăn!
                </Text>
                <View style={styles.aiSuggestionsGrid}>
                  {[
                    { emoji: '🍲', title: 'Công thức phở bò', prompt: 'Công thức phở bò' },
                    { emoji: '🥗', title: 'Món ăn healthy', prompt: 'Gợi ý món ăn healthy' },
                    { emoji: '🍳', title: 'Nấu từ trứng & rau', prompt: 'Nấu gì từ trứng và rau?' },
                    { emoji: '🌶️', title: 'Món miền Trung', prompt: 'Món ngon miền Trung' },
                  ].map((s) => (
                    <TouchableOpacity
                      key={s.title}
                      style={styles.aiSuggestionCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        setText(s.prompt);
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                      <Text style={styles.aiSuggestionText}>{s.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.aiWelcomeDisclaimer}>Bếp AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={messages}
                  extraData={messages}
                  keyExtractor={item => item.tempId || item._id}
                  renderItem={({ item }) => (
                    <MessageBubble
                      item={item} currentUserId={currentUserId} lastSeenMessageId={lastSeenMessageId}
                      avatar={dynamicAvatar} name={dynamicName} playingAudioId={playingAudioId} audioProgress={audioProgress}
                      translatedMessages={translatedMessages} translatingId={translatingId}
                      memberMap={memberMap} isGroup={isGroup} participantRoles={participantRoles}
                      handleMessageLongPress={(msg) => {
                        setActionSheetMessage(msg);
                        setReactionTooltipId(null);
                      }}
                      playAudio={playAudio} setLightboxUrl={setLightboxUrl}
                      handleDownloadFile={handleDownloadFile} openLocationInMaps={openLocationInMaps}
                      onQuickReact={(msg, specificType) => {
                        handleReactMessage(msg, specificType || lastReaction);
                      }}
                      onLongPressQuickReact={(msg) => setReactionTooltipId(prev => prev === msg._id ? null : msg._id)}
                      showReactionTooltip={reactionTooltipId === item._id}
                      closeReactionTooltip={() => setReactionTooltipId(null)}
                      lastReactionType={lastReaction}
                      onVotePoll={handleVotePoll}
                      onAddPollOption={handleAddPollOption}
                    />
                  )}
                  inverted
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => setReactionTooltipId(null)}
                />

                {/* AI Streaming Indicator — dots khi đang chờ AI */}
                {isAi && isAiStreaming && !messages.some(m => m._id === '__ai_streaming__') && (
                  <View style={styles.aiTypingBar}>
                    <View style={styles.aiTypingDot} />
                    <View style={[styles.aiTypingDot, { opacity: 0.7 }]} />
                    <View style={[styles.aiTypingDot, { opacity: 0.4 }]} />
                    <Text style={styles.aiTypingText}>Bếp AI đang trả lời...</Text>
                  </View>
                )}
              </>
            )}
          </View>

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

          {/* BỔ SUNG: Bao bọc ChatInputBar và ActionPanels bằng điều kiện isMember và canSendMessage */}
          {isMember ? (
            canSendMessage ? (
              <>
                <ChatInputBar
                  inputRef={inputRef} text={text} handleTextChange={handleTextChange} handleSend={handleSend}
                  isRecording={isRecording} recordingTime={recordingTime} cancelRecording={cancelRecording}
                  stopAndSendRecording={stopAndSendRecording} startRecording={startRecording}
                  toggleStickerPanel={toggleStickerPanel} showStickers={showStickers}
                  toggleMoreActions={toggleMoreActions} showMoreActions={showMoreActions}
                  handlePickImage={handlePickImage}
                />

                <ActionPanels
                  showStickers={showStickers} stickerPanelHeight={stickerPanelHeight} toggleStickerPanel={toggleStickerPanel} sendSticker={sendSticker}
                  showMoreActions={showMoreActions} moreActionsPanelHeight={moreActionsPanelHeight} toggleMoreActions={toggleMoreActions}
                  handleSendLocation={handleSendLocation} handlePickDocument={handlePickDocument} setShowReminderModal={setShowReminderModal}
                  setShowContactModal={setShowContactModal} handlePickImage={handlePickImage}
                  setShowPollModal={setShowPollModal} canCreatePoll={canCreatePoll}
                />
              </>
            ) : (
              <View style={[styles.notMemberBannerUI, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.notMemberTextUI, { color: '#ef4444' }]}>Chỉ Trưởng/Phó nhóm mới được gửi tin</Text>
              </View>
            )
          ) : (
            <View style={styles.notMemberBannerUI}>
              <Text style={styles.notMemberTextUI}>Bạn không còn là thành viên của nhóm này</Text>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Uploading File Indicator */}
        {
          uploadingFile && (
            <View style={styles.uploadingFileOverlay}>
              <View style={styles.uploadingFileBox}>
                <ActivityIndicator size="large" color={ZaloColors.blue} />
                <Text style={styles.uploadingFileText}>Đang tải tệp lên...</Text>
              </View>
            </View>
          )
        }

        {/* Media Preview Modal */}
        <Modal visible={pendingMedia.length > 0} transparent animationType="fade">
          <View style={styles.previewOverlay}>
            <View style={styles.previewBox}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewHeaderText}>
                  {pendingMedia.length === 1 ? (pendingMedia[0].type === 'video' ? 'Xem trước video' : 'Xem trước ảnh') : `Đã chọn ${pendingMedia.length} ảnh/video`}
                </Text>
              </View>

              {pendingMedia.length === 1 ? (
                pendingMedia[0].type === 'video' ? (
                  <Video source={{ uri: pendingMedia[0].uri }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={styles.previewVideo} />
                ) : (
                  <Image source={{ uri: pendingMedia[0].uri }} style={styles.previewImage} resizeMode="contain" />
                )
              ) : (
                <ScrollView style={styles.previewGrid} contentContainerStyle={styles.previewGridContent} showsVerticalScrollIndicator={true}>
                  <View style={styles.previewGridRow}>
                    {pendingMedia.map((media, index) => (
                      <View key={`preview-${index}`} style={styles.previewGridItem}>
                        {media.type === 'video' ? (
                          <View style={styles.previewGridThumb}>
                            <Video source={{ uri: media.uri }} resizeMode={ResizeMode.COVER} style={styles.previewGridThumbImg} />
                            <View style={styles.previewVideoOverlay}>
                              <Ionicons name="play-circle" size={28} color="#fff" />
                            </View>
                          </View>
                        ) : (
                          <Image source={{ uri: media.uri }} style={styles.previewGridThumbImg} />
                        )}
                        <TouchableOpacity style={styles.previewGridRemoveBtn} onPress={() => handleRemovePendingMedia(index)}>
                          <Ionicons name="close-circle" size={22} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}

              {uploadingMedia && pendingMedia.length > 1 && (
                <View style={styles.uploadProgressWrap}>
                  <View style={styles.uploadProgressBar}>
                    <View style={[styles.uploadProgressFill, { width: `${(uploadProgress / pendingMedia.length) * 100}%` }]} />
                  </View>
                  <Text style={styles.uploadProgressText}>Đang gửi {uploadProgress}/{pendingMedia.length}...</Text>
                </View>
              )}

              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.previewBtn} onPress={() => setPendingMedia([])} disabled={uploadingMedia}>
                  <Ionicons name="close" size={22} color="#fff" />
                  <Text style={styles.previewBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewBtn, styles.previewSendBtn, uploadingMedia && { opacity: 0.6 }]} onPress={handleSendMedia} disabled={uploadingMedia}>
                  {uploadingMedia ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                  <Text style={styles.previewBtnText}>{pendingMedia.length > 1 ? `Gửi (${pendingMedia.length})` : 'Gửi'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ForwardModal visible={!!forwardingMessage} message={forwardingMessage} onClose={() => setForwardingMessage(null)} />
        <ContactSelectionModal visible={showContactModal} onClose={() => setShowContactModal(false)} onSelect={handleSendContact} />

        {/* Image Lightbox */}
        <Modal visible={!!lightboxUrl} transparent animationType="fade">
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setLightboxUrl(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.lightboxDownloadBtn} onPress={() => { if (lightboxUrl) handleDownloadImage(lightboxUrl); }}>
              <Ionicons name="download-outline" size={26} color="#fff" />
            </TouchableOpacity>
            {lightboxUrl && <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />}
          </View>
        </Modal>

        {/* Reminder Modal */}
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
              <TextInput style={styles.reminderModalInput} placeholder="Nhập nội dung nhắc hẹn..." placeholderTextColor="#999" value={reminderText} onChangeText={setReminderText} multiline maxLength={200} />
              <Text style={styles.reminderModalLabel}>Thời gian</Text>
              <View style={styles.reminderTimePickerRow}>
                {[
                  { label: '30 phút', mins: 30 }, { label: '1 giờ', mins: 60 }, { label: '3 giờ', mins: 180 }, { label: 'Ngày mai', mins: 1440 },
                ].map((opt) => {
                  const optDate = new Date(Date.now() + opt.mins * 60000);
                  const isSelected = Math.abs(reminderDate.getTime() - optDate.getTime()) < 60000;
                  return (
                    <TouchableOpacity key={opt.label} style={[styles.reminderTimeChip, isSelected && styles.reminderTimeChipActive]} onPress={() => setReminderDate(new Date(Date.now() + opt.mins * 60000))}>
                      <Text style={[styles.reminderTimeChipText, isSelected && styles.reminderTimeChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.reminderPreviewTimeRow}>
                <Ionicons name="calendar-outline" size={16} color="#FF6348" />
                <Text style={styles.reminderPreviewTimeText}>{formatReminderTime(reminderDate.toISOString())}</Text>
              </View>
              <TouchableOpacity style={styles.reminderSendBtn} onPress={handleSendReminder}>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.reminderSendBtnText}>Gửi nhắc hẹn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Custom Action Sheet Modal */}
        <Modal visible={!!actionSheetMessage} transparent animationType="fade" onRequestClose={() => setActionSheetMessage(null)}>
          <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setActionSheetMessage(null)}>
            <View style={styles.actionSheetContainer}>
              <View style={styles.actionSheetHandle} />

              {/* Reaction Picker */}
              {actionSheetMessage && (
                <View style={styles.reactionPickerContainer}>
                  {REACTION_EMOJIS.map((emoji) => {
                    const hasReacted = actionSheetMessage.reactions?.some(r => r.userId === currentUserId && r.type === emoji.type);
                    return (
                      <TouchableOpacity
                        key={emoji.type}
                        style={[styles.reactionEmojiBtn, hasReacted && styles.reactionEmojiBtnActive]}
                        onPress={() => {
                          handleReactMessage(actionSheetMessage, emoji.type);
                        }}
                      >
                        <Text style={styles.reactionEmojiText}>{emoji.icon}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.actionSheetTitle}>Tùy chọn tin nhắn</Text>

              <TouchableOpacity style={styles.actionSheetItem} onPress={() => { if (actionSheetMessage) setReplyingMessage(actionSheetMessage); setActionSheetMessage(null); }}>
                <Ionicons name="arrow-undo-outline" size={22} color="#333" />
                <Text style={styles.actionSheetItemText}>Trả lời</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionSheetItem} onPress={() => { if (actionSheetMessage) setForwardingMessage(actionSheetMessage); setActionSheetMessage(null); }}>
                <Ionicons name="share-outline" size={22} color="#333" />
                <Text style={styles.actionSheetItemText}>Chuyển tiếp</Text>
              </TouchableOpacity>

              {(!isGroup || canCreatePoll) && (
                <TouchableOpacity style={styles.actionSheetItem} onPress={() => { if (actionSheetMessage) handleTogglePinMessage(actionSheetMessage); setActionSheetMessage(null); }}>
                  <Ionicons name={pinnedMessage?.messageId === actionSheetMessage?._id ? 'pin-outline' : 'pin'} size={22} color="#333" />
                  <Text style={styles.actionSheetItemText}>{pinnedMessage?.messageId === actionSheetMessage?._id ? 'Bỏ ghim' : 'Ghim tin nhắn'}</Text>
                </TouchableOpacity>
              )}

              {actionSheetMessage && (!actionSheetMessage.messageType || actionSheetMessage.messageType === 'text') && (
                <TouchableOpacity style={styles.actionSheetItem} onPress={() => { if (actionSheetMessage) handleTranslate(actionSheetMessage); setActionSheetMessage(null); }}>
                  <Ionicons name="language-outline" size={22} color="#333" />
                  <Text style={styles.actionSheetItemText}>{translatingId === actionSheetMessage?._id ? 'Đang dịch...' : 'Dịch sang Tiếng Việt'}</Text>
                </TouchableOpacity>
              )}

              {isGroup && canCreatePoll && (
                <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setActionSheetMessage(null); setShowPollModal(true); }}>
                  <Ionicons name="bar-chart-outline" size={22} color="#333" />
                  <Text style={styles.actionSheetItemText}>Tạo bình chọn</Text>
                </TouchableOpacity>
              )}

              {actionSheetMessage && actionSheetMessage.messageType === 'poll' && String(actionSheetMessage.senderId) === String(currentUserId) && (
                <>
                  <TouchableOpacity style={styles.actionSheetItem} onPress={() => {
                    setEditingPoll(actionSheetMessage);
                    setActionSheetMessage(null);
                    setShowPollModal(true);
                  }}>
                    <Ionicons name="create-outline" size={22} color="#333" />
                    <Text style={styles.actionSheetItemText}>Chỉnh sửa bình chọn</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionSheetItem} onPress={() => {
                    const msg = actionSheetMessage;
                    setActionSheetMessage(null);
                    if (msg) handleRevoke(msg);
                  }}>
                    <Ionicons name="trash-outline" size={22} color="#FF4757" />
                    <Text style={[styles.actionSheetItemText, { color: '#FF4757' }]}>Xóa bình chọn (Thu hồi)</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.actionSheetSeparator} />

              {actionSheetMessage && String(actionSheetMessage.senderId) === String(currentUserId) && (
                <TouchableOpacity style={styles.actionSheetItem} onPress={() => { const msg = actionSheetMessage; setActionSheetMessage(null); if (msg) handleRevoke(msg); }}>
                  <Ionicons name="refresh-outline" size={22} color="#FF4757" />
                  <Text style={[styles.actionSheetItemText, { color: '#FF4757' }]}>Thu hồi</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionSheetItem} onPress={() => { const msg = actionSheetMessage; setActionSheetMessage(null); if (msg) handleDeleteMessage(msg); }}>
                <Ionicons name="trash-outline" size={22} color="#FF4757" />
                <Text style={[styles.actionSheetItemText, { color: '#FF4757' }]}>Xóa phía tôi</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionSheetCancelBtn} onPress={() => setActionSheetMessage(null)}>
                <Text style={styles.actionSheetCancelText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        <CreatePollModal
          visible={showPollModal}
          onClose={() => { setShowPollModal(false); setEditingPoll(null); }}
          onCreate={handleCreatePoll}
          onUpdate={(q, o) => {
            if (editingPoll) {
              handleCreatePoll(q, o, editingPoll._id);
            }
          }}
          initialData={editingPoll?.messageType === 'poll' ? (() => {
            try {
              return typeof editingPoll.content === 'string' ? JSON.parse(editingPoll.content) : editingPoll.content;
            } catch (e) { return null; }
          })() : null}
        />

      </SafeAreaView >
    </View >
  );

}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e9f1' },
  chatArea: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Thêm vào cuối mảng styles
  notMemberBannerUI: {
    paddingVertical: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  notMemberTextUI: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pinnedBannerTitle: { fontSize: 12, fontWeight: '600', color: ZaloColors.blue, marginBottom: 2 },
  pinnedBannerContent: { fontSize: 13, color: '#333' },
  unpinBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f0f0f0', borderRadius: 12, marginLeft: 8 },
  unpinBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },

  replyPreviewWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  replyPreviewBorder: { width: 3, backgroundColor: ZaloColors.blue, borderRadius: 2, height: '100%', marginRight: 8 },
  replyPreviewContentWrap: { flex: 1 },
  replyPreviewHeader: { fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 2 },
  replyPreviewContent: { fontSize: 13, color: '#555' },
  replyPreviewClose: { padding: 4 },

  uploadingFileOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  uploadingFileBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' },
  uploadingFileText: { marginTop: 10, fontSize: 14, color: '#333', fontWeight: '500' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewBox: { width: '100%', maxHeight: '80%', backgroundColor: '#222', borderRadius: 16, overflow: 'hidden' },
  previewHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#333', alignItems: 'center' },
  previewHeaderText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewImage: { width: '100%', height: 300, backgroundColor: '#000' },
  previewVideo: { width: '100%', height: 300, backgroundColor: '#000' },
  previewGrid: { maxHeight: 400 },
  previewGridContent: { padding: 10 },
  previewGridRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  previewGridItem: { width: '33.33%', aspectRatio: 1, padding: 5, position: 'relative' },
  previewGridThumb: { flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#333' },
  previewGridThumbImg: { flex: 1, width: '100%', height: '100%', borderRadius: 8 },
  previewVideoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  previewGridRemoveBtn: { position: 'absolute', top: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, padding: 2 },
  uploadProgressWrap: { padding: 16, backgroundColor: '#111' },
  uploadProgressBar: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  uploadProgressFill: { height: '100%', backgroundColor: ZaloColors.blue },
  uploadProgressText: { color: '#aaa', fontSize: 12, textAlign: 'center' },
  previewActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333' },
  previewBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  previewSendBtn: { backgroundColor: ZaloColors.blue },
  previewBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxCloseBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 8 },
  lightboxDownloadBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  lightboxImage: { width: SCREEN_WIDTH, height: '100%' },

  reminderModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  reminderModalBox: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  reminderModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  reminderModalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  reminderModalLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  reminderModalInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, minHeight: 80, fontSize: 15, textAlignVertical: 'top', marginBottom: 20, color: '#000' },
  reminderTimePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  reminderTimeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  reminderTimeChipActive: { backgroundColor: '#FFEDEA', borderColor: '#FF6348' },
  reminderTimeChipText: { fontSize: 14, color: '#666', fontWeight: '500' },
  reminderTimeChipTextActive: { color: '#FF6348', fontWeight: '600' },
  reminderPreviewTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 20 },
  reminderPreviewTimeText: { fontSize: 15, fontWeight: '600', color: '#333', marginLeft: 8 },
  reminderSendBtn: { backgroundColor: '#FF6348', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 8, gap: 8 },
  reminderSendBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  actionSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, paddingHorizontal: 20 },
  actionSheetHandle: { width: 40, height: 5, backgroundColor: '#ddd', borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  actionSheetTitle: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 20 },
  actionSheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  actionSheetItemText: { fontSize: 16, color: '#333', marginLeft: 16 },
  actionSheetSeparator: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  actionSheetCancelBtn: { marginTop: 10, paddingVertical: 16, alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12 },
  actionSheetCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },

  reactionPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 30,
    paddingVertical: 8,
  },
  reactionEmojiBtn: {
    padding: 8,
    borderRadius: 20,
  },
  reactionEmojiBtnActive: {
    backgroundColor: '#e6f0ff',
  },
  reactionEmojiText: {
    fontSize: 28,
  },

  // AI Welcome Screen
  aiWelcomeWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  aiWelcomeHero: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  aiWelcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  aiWelcomeDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  aiSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 320,
  },
  aiSuggestionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 6,
  },
  aiSuggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  aiWelcomeDisclaimer: {
    fontSize: 11,
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },

  // AI Typing Indicator
  aiTypingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(249,115,22,0.15)',
    gap: 6,
  },
  aiTypingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  aiTypingText: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
    marginLeft: 4,
  },
});