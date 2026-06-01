import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, Dimensions,
  FlatList, ActivityIndicator, Text, TouchableOpacity, Modal, Image, ScrollView,
  TextInput, Linking, Animated as RNAnimated, TouchableWithoutFeedback, Keyboard, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import CloudImageGallery from '@/components/chat/CloudImageGallery';
import CloudFileGallery from '@/components/chat/CloudFileGallery';
import CloudLinkGallery from '@/components/chat/CloudLinkGallery';
import CloudTextGallery from '@/components/chat/CloudTextGallery';

// Hooks
import { useChatMessages } from '@/hooks/chat/useChatMessages';
import { useChatSocket } from '@/hooks/chat/useChatSocket';
import { useVoiceRecording } from '@/hooks/chat/useVoiceRecording';
import { useMediaHandling } from '@/hooks/chat/useMediaHandling';
import { useAudioPlayback } from '@/hooks/chat/useAudioPlayback';
import { useChatActions } from '@/hooks/chat/useChatActions';
import { useGroupCallStore } from '@/stores/groupCallStore';


export default function ChatScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;
  const name = params.name as string;
  const avatar = params.avatar as string;
  const isOnline = params.isOnline === 'true';
  const initialUnreadParam = parseInt(params.initialUnreadCount as string) || 0;
  const openSearch = params.openSearch === 'true';

  const { socket, currentUserId } = useSocket();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  const isCloud = (id as string)?.startsWith('cloud_');
  const recipientId = isCloud ? (currentUserId as string) : (params.recipientId as string);

  // BỔ SUNG: Refs và State cho cuộn tin nhắn
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialUnreadCount, setInitialUnreadCount] = useState(initialUnreadParam);

  // Search State
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  useEffect(() => {
    if (openSearch) {
      setIsSearchMode(true);
      router.setParams({ openSearch: undefined });
    }
  }, [openSearch]);

  // States
  const [text, setText] = useState('');
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        AsyncStorage.getItem(`wallpaper_${id}`)
          .then(val => {
            setWallpaper(val);
          })
          .catch(err => console.log('Lỗi khi đọc hình nền:', err));

        // Load contact nickname for 1-1 chats
        if (isGroup !== 'true' && !id.startsWith('cloud_')) {
          const targetId = recipientId || id;
          if (targetId && typeof targetId === 'string' && !targetId.startsWith('cloud_')) {
            apiClient.get('/contacts?page=0&size=100')
              .then(contactsRes => {
                const contacts = contactsRes.data?.data?.content || contactsRes.data?.data || [];
                const contact = contacts.find((c: any) => String(c.contactUserId) === String(targetId));
                if (contact && contact.nickname) {
                  setCustomName(contact.nickname);
                } else if (contact) {
                  setCustomName(contact.fullName);
                }
              })
              .catch(err => console.log('Lỗi khi tải nickname trong chat:', err));
          }
        }
      }
    }, [id, recipientId, isGroup])
  );

  // Listen for real-time wallpaper updates from backend
  useEffect(() => {
    if (!socket || !id) return;

    const handleWallpaperUpdated = (data: any) => {
      if (data.conversationId === id) {
        setWallpaper(data.wallpaper);
        if (data.wallpaper) {
          AsyncStorage.setItem(`wallpaper_${id}`, data.wallpaper).catch(() => {});
        } else {
          AsyncStorage.removeItem(`wallpaper_${id}`).catch(() => {});
        }
      }
    };

    socket.on('wallpaper_updated', handleWallpaperUpdated);
    return () => {
      socket.off('wallpaper_updated', handleWallpaperUpdated);
    };
  }, [socket, id]);

  const [isTyping, setIsTyping] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showSummarizeModal, setShowSummarizeModal] = useState(false);
  const [summarizeResult, setSummarizeResult] = useState('');
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [summarizeError, setSummarizeError] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const { messages, setMessages, isLoading, isLoadingMore, fetchMore, pinnedMessage, setPinnedMessage, groupMemberCount, isGroup, memberMap, participantRoles, groupName, groupAvatar, groupSettings } = useChatMessages(id, currentUserId, socket);
  const { isOtherTyping, lastSeenMessageId } = useChatSocket({ socket, id, currentUserId, setMessages, setPinnedMessage });

  const [cloudFilter, setCloudFilter] = useState<'all' | 'image' | 'file' | 'link' | 'text' | 'collection'>('all');
  
  const filteredMessages = useMemo(() => {
    if (!isCloud || cloudFilter === 'all') return messages;
    return messages.filter(msg => {
      if (cloudFilter === 'image') {
        return msg.messageType === 'image' || (msg.messageType === 'file' && /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(msg.fileUrl || ''));
      }
      if (cloudFilter === 'file') {
        return msg.messageType === 'file' || msg.messageType === 'document';
      }
      if (cloudFilter === 'link') {
        return typeof msg.content === 'string' && (msg.content.includes('http://') || msg.content.includes('https://'));
      }
      if (cloudFilter === 'text') {
        return msg.messageType === 'text' && !(typeof msg.content === 'string' && (msg.content.includes('http://') || msg.content.includes('https://')));
      }
      if (cloudFilter === 'collection') {
        return msg.messageType === 'sticker' || msg.messageType === 'sticker-message';
      }
      return true;
    });
  }, [messages, isCloud, cloudFilter]);

  const messageSeenMap = useMemo(() => {
    const map: Record<string, { userId: string, avatarUrl?: string, fullName: string }[]> = {};
    const userSeenTracker = new Set<string>();

    for (const msg of filteredMessages) {
      if (msg.seenBy && msg.seenBy.length > 0) {
        msg.seenBy.forEach(s => {
          if (!userSeenTracker.has(s.userId)) {
            userSeenTracker.add(s.userId);
            if (String(s.userId) !== String(currentUserId)) {
              if (!map[msg._id]) map[msg._id] = [];
              map[msg._id].push({
                userId: s.userId,
                avatarUrl: memberMap?.[s.userId]?.avatarUrl,
                fullName: memberMap?.[s.userId]?.fullName || 'Thành viên'
              });
            }
          }
        });
      }
    }
    return map;
  }, [filteredMessages, memberMap, currentUserId]);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 150) {
      if (!showScrollToBottom) setShowScrollToBottom(true);
    } else {
      if (showScrollToBottom) setShowScrollToBottom(false);
      if (unreadCount > 0) setUnreadCount(0);
    }
  };

  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
     if (messages.length > prevMessagesLength.current) {
        const newMsg = messages[0];
        if (newMsg && newMsg.senderId !== currentUserId && showScrollToBottom) {
           setUnreadCount(prev => prev + 1);
        }
     }
     prevMessagesLength.current = messages.length;
  }, [messages, showScrollToBottom, currentUserId]);

  useEffect(() => {
    if (!isSearchMode || !searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    messages.forEach((msg, index) => {
      if (msg.messageType === 'text' && msg.content && typeof msg.content === 'string' && msg.content.toLowerCase().includes(query)) {
        results.push(index);
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(0);
    
    if (results.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: results[0], animated: true, viewPosition: 0.5 });
      }, 100);
    }
  }, [searchQuery, isSearchMode, messages.length]); // depend on messages.length to avoid too frequent re-renders, or just don't re-search on every msg change if not needed

  const handleNextSearch = () => { // "Lên" - older messages (higher index)
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: searchResults[nextIndex], animated: true, viewPosition: 0.5 });
  };

  const handlePrevSearch = () => { // "Xuống" - newer messages (lower index)
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    flatListRef.current?.scrollToIndex({ index: searchResults[prevIndex], animated: true, viewPosition: 0.5 });
  };

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
  const dynamicName = isCloud ? 'Cloud của tôi' : (isGroup ? (groupName || name) : (customName || name));
  const dynamicAvatar = isCloud ? 'cloud' : (isGroup ? (groupAvatar || avatar) : avatar);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);


  const isAi = (id as string)?.startsWith('ai_');
  const [isAiStreaming, setIsAiStreaming] = useState(false);

  // BỔ SUNG: State cho Mention (Tag)
  const [mentionKeyword, setMentionKeyword] = useState<string | null>(null);
  const [mentionActionUser, setMentionActionUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // BỔ SUNG: State cho Mention Tag (nhảy đến tin nhắn @)
  const [unreadMentionIndex, setUnreadMentionIndex] = useState<number | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [myFullName, setMyFullName] = useState<string | null>(null);

  // Fetch fullName riêng của user hiện tại
  useEffect(() => {
    if (!currentUserId) return;
    const fetchMyName = async () => {
      try {
        const res = await apiClient.get(`/users/${currentUserId}`);
        const name = res.data?.data?.fullName;
        if (name) {
          console.log('[Mention] My fullName:', name);
          setMyFullName(name);
        }
      } catch (err) {
        console.log('[Mention] Failed to fetch my fullName', err);
      }
    };
    fetchMyName();
  }, [currentUserId]);

  // Quét tin nhắn để tìm @tên mình (quét toàn bộ messages, không giới hạn unread)
  useEffect(() => {
    if (!isGroup || !myFullName || messages.length === 0) {
      setUnreadMentionIndex(null);
      return;
    }

    // FlatList inverted: messages[0] = mới nhất, messages[N-1] = cũ nhất
    const escapedName = myFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRegex = new RegExp(`@${escapedName}`, 'i');

    console.log('[Mention] Scanning', messages.length, 'messages for @' + myFullName);

    // Tìm tin nhắn CŨ NHẤT chứa tag (duyệt từ cuối mảng - tin cũ nhất)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (String(msg.senderId) === String(currentUserId)) continue; // Bỏ qua tin do mình gửi
      const content = msg.content || '';
      if (mentionRegex.test(content)) {
        console.log('[Mention] Found mention at index', i, ':', content.substring(0, 50));
        setUnreadMentionIndex(i);
        return;
      }
    }
    console.log('[Mention] No mention found');
    setUnreadMentionIndex(null);
  }, [messages, isGroup, currentUserId, myFullName]);

  const handleMentionSelect = (fullName: string) => {
    const match = text.match(/(?:^|\s)@([^@]*)$/);
    if (match) {
       const beforeAt = text.substring(0, text.length - match[0].length + (match[0].startsWith(' ') ? 1 : 0));
       const newText = beforeAt + '@' + fullName + ' ';
       setText(newText);
       setMentionKeyword(null);
       inputRef.current?.focus();
    }
  };

  const handleTagMentionUser = () => {
    if (mentionActionUser) {
      setText(prev => {
        const prefix = prev ? (prev.endsWith(' ') ? prev : prev + ' ') : '';
        return prefix + '@' + mentionActionUser.name + ' ';
      });
      setMentionActionUser(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleDirectMessageMention = async () => {
    if (!currentUserId || !mentionActionUser) return;
    const targetUserId = mentionActionUser.id;
    if (String(targetUserId) === String(currentUserId)) {
      Alert.alert('Thông báo', 'Bạn không thể nhắn tin riêng cho chính mình!');
      setMentionActionUser(null);
      return;
    }
    const ids = [currentUserId.toString(), targetUserId.toString()].sort();
    const convId = `1to1_${ids[0]}_${ids[1]}`;
    try {
        const { chatApiClient } = await import('@/constants/chatApi');
        await chatApiClient.post('/conversation', {
            conversationId: convId,
            participants: [currentUserId.toString(), targetUserId.toString()],
            isGroup: false
        });
        setMentionActionUser(null);
        router.replace({
            pathname: "/chat/[id]",
            params: {
                id: convId,
                name: mentionActionUser.name,
                recipientId: targetUserId.toString(),
                avatar: memberMap?.[targetUserId]?.avatarUrl || ""
            }
        });
    } catch (error) {
        console.error("Failed to start conversation", error);
        Alert.alert('Lỗi', 'Không thể kết nối để tạo cuộc trò chuyện mới.');
    }
  };

  const handleCallMention = async () => {
    if (!currentUserId || !mentionActionUser || !socket) return;
    const targetUserId = mentionActionUser.id;
    if (String(targetUserId) === String(currentUserId)) {
      Alert.alert('Thông báo', 'Bạn không thể gọi cho chính mình!');
      setMentionActionUser(null);
      return;
    }
    const ids = [currentUserId.toString(), targetUserId.toString()].sort();
    const convId = `1to1_${ids[0]}_${ids[1]}`;
    try {
        const { chatApiClient } = await import('@/constants/chatApi');
        await chatApiClient.post('/conversation', {
            conversationId: convId,
            participants: [currentUserId.toString(), targetUserId.toString()],
            isGroup: false
        });
        setMentionActionUser(null);
        
        socket.emit('group_call_start', {
          conversationId: convId,
          callerInfo: { id: currentUserId },
          isVideo: false,
        });
        useGroupCallStore.getState().setOutgoingCall(convId, currentUserId.toString(), false);
    } catch (error) {
        console.error("Failed to start call", error);
        Alert.alert('Lỗi', 'Không thể bắt đầu cuộc gọi.');
    }
  };

  const handleTransferMention = () => {
    if (!mentionActionUser) return;
    const name = mentionActionUser.name;
    setMentionActionUser(null);
    Alert.alert(
      'Chuyển khoản nhanh',
      `Tính năng chuyển khoản nhanh đến ${name} đang được phát triển!`,
      [{ text: 'Đồng ý', style: 'default' }]
    );
  };

  const handleViewMentionProfile = async () => {
    if (!mentionActionUser) return;
    const targetUserId = mentionActionUser.id;
    setMentionActionUser(null);
    setLoadingProfile(true);
    try {
      const res = await apiClient.get(`/users/${targetUserId}`);
      setSelectedUserProfile(res.data?.data || null);
    } catch (err) {
      console.log('Failed to fetch profile', err);
      Alert.alert('Lỗi', 'Không thể tải thông tin cá nhân của người này.');
    } finally {
      setLoadingProfile(false);
    }
  };

  // groupMemberCount is now provided by useChatMessages hook

  // Pinned Message state is now managed by useChatMessages hook

  // ─── Reminder States ───

  const [showPollModal, setShowPollModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Message | null>(null);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState<Date>(new Date(Date.now() + 3600000));

  // Smart time suggestion
  const [timeSuggestion, setTimeSuggestion] = useState<{ text: string; date: Date } | null>(null);

  const detectTimeInText = useCallback((input: string) => {
    if (!input || input.length < 3 || isAi) { setTimeSuggestion(null); return; }
    const now = new Date();
    const patterns: { regex: RegExp; parse: (m: RegExpMatchArray) => { text: string; date: Date } | null }[] = [
      { regex: /(\d{1,2})[hH:](\d{0,2})\s*(sáng|chiều|tối)?/i, parse: (m) => {
        let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const p = m[3]?.toLowerCase();
        if (p === 'chiều' && h < 12) h += 12; if (p === 'tối' && h < 18) h += 6;
        const d = new Date(now); d.setHours(h, min, 0, 0); if (d <= now) d.setDate(d.getDate() + 1);
        return { text: `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`, date: d };
      }},
      { regex: /(\d{1,2})\s*giờ\s*(\d{0,2})\s*(sáng|chiều|tối|phút)?/i, parse: (m) => {
        let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const p = m[3]?.toLowerCase();
        if (p === 'chiều' && h < 12) h += 12; if (p === 'tối' && h < 18) h += 6;
        const d = new Date(now); d.setHours(h, min, 0, 0); if (d <= now) d.setDate(d.getDate() + 1);
        return { text: `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`, date: d };
      }},
      { regex: /(sáng mai|chiều mai|tối mai|ngày mai)/i, parse: (m) => {
        const d = new Date(now); d.setDate(d.getDate() + 1); const kw = m[1].toLowerCase();
        if (kw.includes('sáng')) d.setHours(8,0,0,0); else if (kw.includes('chiều')) d.setHours(14,0,0,0);
        else if (kw.includes('tối')) d.setHours(19,0,0,0); else d.setHours(9,0,0,0);
        return { text: m[1], date: d };
      }},
      { regex: /(sáng nay|chiều nay|tối nay)/i, parse: (m) => {
        const d = new Date(now); const kw = m[1].toLowerCase();
        if (kw.includes('sáng')) d.setHours(8,0,0,0); else if (kw.includes('chiều')) d.setHours(14,0,0,0); else d.setHours(19,0,0,0);
        if (d <= now) return null; return { text: m[1], date: d };
      }},
      { regex: /(tuần sau|tuần tới)/i, parse: (m) => { const d = new Date(now); d.setDate(d.getDate()+7); d.setHours(9,0,0,0); return { text: m[1], date: d }; }},
      { regex: /(cuối tuần)/i, parse: (m) => { const d = new Date(now); const day = d.getDay(); const diff = day===0?6:(6-day); d.setDate(d.getDate()+diff); d.setHours(9,0,0,0); if(d<=now) d.setDate(d.getDate()+7); return { text: m[1], date: d }; }},
      { regex: /(\d{1,2})\s*(phút|tiếng|giờ)\s*nữa/i, parse: (m) => {
        const num = parseInt(m[1]); const unit = m[2].toLowerCase(); const d = new Date(now);
        if (unit === 'phút') d.setMinutes(d.getMinutes()+num); else d.setHours(d.getHours()+num);
        return { text: `${num} ${m[2]} nữa`, date: d };
      }},
    ];
    for (const p of patterns) {
      const match = input.match(p.regex);
      if (match) { const result = p.parse(match); if (result && result.date > now) { setTimeSuggestion(result); return; } }
    }
    setTimeSuggestion(null);
  }, [isAi]);

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

  const handleScrollToPinnedMessage = useCallback(() => {
    if (!pinnedMessage?.messageId || !flatListRef.current) return;
    const index = messages.findIndex(m => String(m._id) === String(pinnedMessage.messageId));
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } else {
      Alert.alert('Không tìm thấy', 'Tin nhắn này đã quá cũ hoặc không còn tồn tại trong lịch sử tải về.');
    }
  }, [pinnedMessage?.messageId, messages]);

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
      setMessages(prev => prev.map(m => String(m._id) === String(data.messageId) ? { ...m, status: 'seen', seenBy: data.seenList || [{ userId: data.seenBy, timestamp: data.timestamp }] } : m));
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
  const handleSummarize = async () => {
    setShowSummarizeModal(true);
    setSummarizeLoading(true);
    setSummarizeResult('');
    setSummarizeError('');

    try {
      // 1. Lấy tin nhắn cần tóm tắt
      const summarizeCount = Math.max(initialUnreadCount, 10);
      // messages đang theo thứ tự từ mới nhất đến cũ nhất
      const recentMessages = [...messages].slice(0, summarizeCount).reverse(); // Lấy N tin mới nhất và đảo ngược về thời gian

      // 2. Lọc rác
      const validMessages = recentMessages.filter(m => {
        if (m.isRevoked) return false;
        if (m.messageType === 'system') return false;
        if (m.messageType === 'text') {
          const content = (m.content || '').trim();
          if (content.length < 2) return false;
        }
        return true;
      });

      if (validMessages.length === 0) {
        setSummarizeError('Không có đủ dữ liệu hội thoại để tóm tắt.');
        setSummarizeLoading(false);
        return;
      }

      // 3. Tạo transcript
      const transcript = validMessages.map(m => {
        const name = memberMap?.[m.senderId]?.fullName || (m.senderId === currentUserId ? 'Tôi' : 'Thành viên');
        const typeStr = m.messageType !== 'text' ? `[Gửi ${m.messageType}]` : '';
        const content = m.content || '';
        return `${name}: ${typeStr} ${content}`;
      }).join('\n');

      // 4. Gọi API
      const res = await apiClient.post('/api/ai-chat/summarize', { transcript });
      if (res.data?.success) {
        setSummarizeResult(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Có lỗi xảy ra');
      }
    } catch (err: any) {
      console.error('Lỗi tóm tắt:', err);
      setSummarizeError(err.message || 'Không thể kết nối đến Bếp AI.');
    } finally {
      setSummarizeLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!currentUserId) return;

    if (isAi) {
      // ── AI Chat Route — gửi qua AI service, không qua socket ──
      // Lấy ảnh đầu tiên nếu có (AI chỉ hỗ trợ 1 ảnh)
      const aiImage = pendingMedia.length > 0 ? pendingMedia[0] : null;
      const hasImage = !!aiImage;
      const hasText = !!trimmed;

      // Phải có ít nhất text hoặc ảnh
      if (!hasText && !hasImage) return;

      const displayContent = hasImage
        ? (hasText ? trimmed : 'Dựa vào ảnh này, hãy gợi ý cho tôi các món ăn có thể nấu.')
        : trimmed;

      // User message hiển thị trên UI
      const userMsg: Message = {
        _id: `user_${Date.now()}`,
        senderId: currentUserId,
        recipientId: 'ai_food_bot',
        content: displayContent,
        messageType: hasImage ? 'image' : 'text',
        imageUrl: hasImage ? aiImage.uri : undefined,
        createdAt: new Date().toISOString(),
        status: 'sent',
      };
      setMessages(prev => [userMsg, ...prev]);
      setText('');
      setPendingMedia([]); // Xóa ảnh pending

      // Sử dụng base64 từ ImagePicker thay vì đọc lại bằng FileSystem để tránh lỗi trên Android 13+
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      if (hasImage && aiImage && aiImage.base64) {
        imageBase64 = aiImage.base64;
        const ext = aiImage.uri.split('.').pop()?.toLowerCase() || 'jpeg';
        imageMimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      }

      // Start AI streaming
      setIsAiStreaming(true);
      let aiResponse = '';

      streamAiChatMobile(
        currentUserId,
        displayContent,
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
        },
        imageBase64,
        imageMimeType
      );
    } else {
      // ── Normal Chat Route — gửi qua socket ──
      _handleSend(text, setText, setIsTyping);
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    detectTimeInText(val); // Smart time detection
    
    // BỔ SUNG: Detect Mention cho nhóm
    if (isGroup) {
      const match = val.match(/(?:^|\s)@([^@]*)$/);
      if (match) {
         setMentionKeyword(match[1]);
      } else {
         setMentionKeyword(null);
      }
    }

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
        {isSearchMode ? (
          <View style={{ height: 56, backgroundColor: ZaloColors.blue, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <TouchableOpacity style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={() => setIsSearchMode(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TextInput
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 6, fontSize: 16, marginLeft: 8 }}
              placeholder="Nhập từ khóa tìm kiếm..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        ) : (
          <ChatHeader
            id={id} name={dynamicName} avatar={dynamicAvatar} recipientId={recipientId}
            isGroup={isGroup} groupMemberCount={groupMemberCount}
            isOnline={isOnline} isOtherTyping={isOtherTyping}
            onOpenSearch={() => setIsSearchMode(true)}
          />
        )}

        {/* Pinned Message Banner */}

        {/* Pinned Message */}

        {
          pinnedMessage && pinnedMessage.messageId && (pinnedMessage.content || pinnedMessage.messageType) && (
            <View style={styles.pinnedBanner}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={handleScrollToPinnedMessage}
                activeOpacity={0.7}
              >
                <Ionicons name="pricetag" size={16} color={ZaloColors.blue} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedBannerTitle}>Tin nhắn đã ghim</Text>
                  <Text style={styles.pinnedBannerContent} numberOfLines={1}>
                    {pinnedMessage.messageType === 'sticker' ? '[Nhãn dán]' :
                      pinnedMessage.messageType === 'image' ? '[Hình ảnh]' :
                        pinnedMessage.messageType === 'video' ? '[Video]' :
                          pinnedMessage.messageType === 'audio' ? '[Tin nhắn thoại]' :
                            pinnedMessage.messageType === 'file' || pinnedMessage.messageType === 'document' ? '[Tệp]' :
                              pinnedMessage.messageType === 'contact' ? '[Danh thiếp]' :
                                pinnedMessage.messageType === 'location' ? '[Vị trí]' :
                                  pinnedMessage.messageType === 'reminder' ? '[Nhắc hẹn]' :
                                    pinnedMessage.messageType === 'poll' ? '[Bình chọn]' :
                                      pinnedMessage.content}
                  </Text>
                </View>
              </TouchableOpacity>
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
          style={[
            styles.chatArea,
            { backgroundColor: wallpaper && wallpaper.startsWith('#') ? wallpaper : '#e2e9f1' }
          ]}
          behavior="padding"
        >
          {wallpaper && !wallpaper.startsWith('#') && (
            <Image
              source={{ uri: wallpaper }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}
          {/* Nút nhảy đến tin nhắn chưa đọc đầu tiên (khi mới vào) */}
          {initialUnreadCount > 0 && initialUnreadCount <= messages.length && (
            <TouchableOpacity 
              style={styles.jumpToUnreadBanner}
              activeOpacity={0.9}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: initialUnreadCount - 1, animated: true, viewPosition: 1 });
                setInitialUnreadCount(0); // Ẩn nút sau khi click
              }}
            >
              <Text style={styles.jumpToUnreadText}>{initialUnreadCount} tin nhắn chưa xem</Text>
              <Ionicons name="chevron-up" size={18} color="#0068FF" />
            </TouchableOpacity>
          )}

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
                {isCloud && (
                  <View style={styles.filterBarContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarScroll}>
                      {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'image', label: 'Ảnh' },
                        { key: 'file', label: 'File' },
                        { key: 'link', label: 'Link' },
                        { key: 'text', label: 'Văn bản' },
                        { key: 'collection', label: 'Bộ sưu tập' }
                      ].map((tab) => {
                        const isActive = cloudFilter === tab.key;
                        return (
                          <TouchableOpacity
                            key={tab.key}
                            onPress={() => setCloudFilter(tab.key as any)}
                            style={[styles.filterTabButton, isActive && styles.filterTabButtonActive]}
                          >
                            <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                              {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                
                {isCloud && cloudFilter === 'image' ? (
                  <View style={{ flex: 1 }}>
                    <CloudImageGallery messages={filteredMessages} onImagePress={setLightboxUrl} />
                  </View>
                ) : isCloud && cloudFilter === 'file' ? (
                  <View style={{ flex: 1 }}>
                    <CloudFileGallery 
                      messages={filteredMessages} 
                      memberMap={memberMap}
                      currentUserId={currentUserId}
                      onFilePress={handleDownloadFile}
                      onFileOptionsPress={(msg) => setActionSheetMessage(msg)}
                    />
                  </View>
                ) : isCloud && cloudFilter === 'link' ? (
                  <View style={{ flex: 1 }}>
                    <CloudLinkGallery 
                      messages={filteredMessages} 
                      memberMap={memberMap}
                      currentUserId={currentUserId}
                      onLinkOptionsPress={(msg) => setActionSheetMessage(msg)}
                    />
                  </View>
                ) : isCloud && cloudFilter === 'text' ? (
                  <View style={{ flex: 1 }}>
                    <CloudTextGallery 
                      messages={filteredMessages} 
                      onTextLongPress={(msg) => setActionSheetMessage(msg)}
                    />
                  </View>
                ) : (
                  <FlatList
                    ref={flatListRef}
                    data={filteredMessages}
                    extraData={filteredMessages}
                  keyExtractor={item => item.tempId || item._id}
                  renderItem={({ item }) => (
                    <MessageBubble
                      item={item} currentUserId={currentUserId} lastSeenMessageId={lastSeenMessageId}
                      latestSeenUsers={messageSeenMap[item._id]}
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
                      allMessages={messages}
                      onJoinCall={(convId, isVid) => {
                        useGroupCallStore.getState().setOutgoingCall(id, String(currentUserId), isVid);
                      }}
                      onPressMention={(fullName, userId) => {
                        setMentionActionUser({ id: userId, name: fullName });
                      }}
                      isHighlighted={isSearchMode && !!searchQuery && searchResults.includes(messages.indexOf(item))}
                      searchQuery={isSearchMode ? searchQuery : undefined}
                    />
                  )}
                  inverted
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => setReactionTooltipId(null)}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 300));
                    wait.then(() => {
                      flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    });
                  }}
                  onEndReached={fetchMore}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={isLoadingMore ? <ActivityIndicator size="small" color="#0068FF" style={{ marginVertical: 10 }} /> : null}
                />
                )}

                {/* Nút @ nổi - nhảy đến tin nhắn nhắc tên */}
                {unreadMentionIndex !== null && (
                  <TouchableOpacity
                    style={[styles.scrollToBottomBtn, { bottom: showScrollToBottom ? 72 : 20 }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (unreadMentionIndex !== null) {
                        flatListRef.current?.scrollToIndex({ index: unreadMentionIndex, animated: true, viewPosition: 0.5 });
                        const msgId = messages[unreadMentionIndex]?._id;
                        if (msgId) {
                          setHighlightedMessageId(msgId);
                          setTimeout(() => setHighlightedMessageId(null), 2500);
                        }
                        setUnreadMentionIndex(null);
                      }
                    }}
                  >
                    <Text style={{ color: '#0068FF', fontWeight: 'bold', fontSize: 18 }}>@</Text>
                  </TouchableOpacity>
                )}

                {/* Nút cuộn xuống dưới & Tin nhắn mới */}
                {showScrollToBottom && (
                  <TouchableOpacity 
                    style={styles.scrollToBottomBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                      setUnreadCount(0);
                      setShowScrollToBottom(false);
                    }}
                  >
                    <Ionicons name="chevron-down" size={24} color="#0068FF" />
                    {unreadCount > 0 && (
                      <View style={styles.unreadBadgeMsg}>
                        <Text style={styles.unreadBadgeTextMsg}>{unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

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
          {isSearchMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
              <Ionicons name="search" size={24} color="#888" />
              <Text style={{ fontSize: 16, color: '#555' }}>
                {searchResults.length > 0 ? `Kết quả thứ ${currentSearchIndex + 1}/${searchResults.length}` : 'Không tìm thấy kết quả'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={handleNextSearch} disabled={searchResults.length === 0}>
                  <Ionicons name="chevron-up" size={24} color={searchResults.length > 0 ? ZaloColors.blue : '#ccc'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePrevSearch} disabled={searchResults.length === 0}>
                  <Ionicons name="chevron-down" size={24} color={searchResults.length > 0 ? ZaloColors.blue : '#ccc'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : isMember ? (
            canSendMessage ? (
              <>
                {/* Smart Time Suggestion Banner */}
                {timeSuggestion && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,99,72,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,99,72,0.15)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="alarm-outline" size={16} color="#FF6348" />
                      <Text style={{ fontSize: 12, color: '#FF6348', marginLeft: 6, flex: 1 }} numberOfLines={1}>
                        Phát hiện thời gian <Text style={{ fontWeight: '700' }}>"{timeSuggestion.text}"</Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={{ backgroundColor: '#FF6348', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                        onPress={() => {
                          setReminderText(text);
                          setReminderDate(timeSuggestion.date);
                          setShowReminderModal(true);
                          setTimeSuggestion(null);
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Tạo nhắc hẹn</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setTimeSuggestion(null)} style={{ padding: 2 }}>
                        <Ionicons name="close" size={16} color="#FF6348" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Danh sách Tag (Mention) */}
                {mentionKeyword !== null && isGroup && (
                  <View style={styles.mentionListWrap}>
                    <ScrollView keyboardShouldPersistTaps="always" style={styles.mentionScrollView}>
                      {Object.entries(memberMap)
                        .filter(([uid, user]) => 
                          uid !== currentUserId && 
                          participantRoles[uid] && 
                          (user.fullName.toLowerCase().includes(mentionKeyword.toLowerCase()) || mentionKeyword === '')
                        )
                        .map(([uid, user]) => (
                          <TouchableOpacity 
                            key={uid} 
                            style={styles.mentionItem}
                            onPress={() => handleMentionSelect(user.fullName)}
                          >
                            <Image source={{ uri: user.avatarUrl || 'https://via.placeholder.com/40' }} style={styles.mentionAvatar} />
                            <Text style={styles.mentionName}>{user.fullName}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}

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
                  isGroup={isGroup} handleSummarize={handleSummarize}
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
          {isAi ? (
            /* ═══ AI-specific fullscreen preview — professional Telegram-style ═══ */
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
              {/* Top bar */}
              <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                  <TouchableOpacity onPress={() => setPendingMedia([])} style={{ padding: 4 }}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#f97316' }}>🍜 Bếp AI</Text>
                  </View>
                  <View style={{ width: 36 }} />
                </View>
              </SafeAreaView>

              {/* Center: Image */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}>
                {pendingMedia[0] && (
                  <Image 
                    source={{ uri: pendingMedia[0].uri }} 
                    style={{ width: '100%', height: '80%', borderRadius: 12 }} 
                    resizeMode="contain" 
                  />
                )}
              </View>

              {/* Bottom bar: text input + send */}
              <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'rgba(30,30,30,0.95)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, minHeight: 42, justifyContent: 'center' }}>
                    <TextInput
                      style={{ fontSize: 15, color: '#fff', maxHeight: 100, lineHeight: 20 }}
                      placeholder="Hỏi Bếp AI về ảnh này..."
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      value={text}
                      onChangeText={setText}
                      multiline
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={handleSend}
                    style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          ) : (
            /* ═══ Normal chat preview — unchanged ═══ */
            <View style={styles.previewOverlay}>
              <View style={styles.previewBox}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewHeaderText}>
                    {pendingMedia.length === 1 ? (pendingMedia[0]?.type === 'video' ? 'Xem trước video' : 'Xem trước ảnh') : `Đã chọn ${pendingMedia.length} ảnh/video`}
                  </Text>
                </View>

                {pendingMedia.length === 1 ? (
                  pendingMedia[0]?.type === 'video' ? (
                    <Video source={{ uri: pendingMedia[0].uri }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={styles.previewVideo} />
                  ) : (
                    <Image source={{ uri: pendingMedia[0]?.uri }} style={styles.previewImage} resizeMode="contain" />
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
                  <TouchableOpacity 
                    style={[styles.previewBtn, styles.previewSendBtn, uploadingMedia && { opacity: 0.6 }]} 
                    onPress={handleSendMedia} 
                    disabled={uploadingMedia}
                  >
                    {uploadingMedia ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                    <Text style={styles.previewBtnText}>{pendingMedia.length > 1 ? `Gửi (${pendingMedia.length})` : 'Gửi'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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

        {/* AI Summarize Modal */}
        <Modal visible={showSummarizeModal} transparent animationType="slide" onRequestClose={() => setShowSummarizeModal(false)}>
          <View style={styles.summarizeModalOverlay}>
            <View style={styles.summarizeModalContainer}>
              {/* Header */}
              <View style={styles.summarizeModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="flash" size={20} color="#fff" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#333' }}>AI Tóm Tắt</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>
                      {initialUnreadCount > 0 ? `Tóm tắt ${Math.max(initialUnreadCount, 10)} tin nhắn chưa đọc` : `Tóm tắt 10 tin nhắn gần nhất`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowSummarizeModal(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 20 }}>
                {summarizeLoading ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16 }}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={{ color: '#888', fontWeight: '500' }}>Bếp AI đang phân tích hội thoại...</Text>
                  </View>
                ) : summarizeError ? (
                  <View style={{ backgroundColor: '#fef2f2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', gap: 10 }}>
                    <Ionicons name="warning" size={24} color="#ef4444" />
                    <Text style={{ color: '#ef4444', flex: 1, fontWeight: '500' }}>{summarizeError}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 15, lineHeight: 24, color: '#333' }}>{summarizeResult}</Text>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.summarizeModalFooter}>
                <TouchableOpacity style={styles.summarizeModalBtn} onPress={() => setShowSummarizeModal(false)}>
                  <Text style={styles.summarizeModalBtnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
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

        {/* Loading Profile Overlay */}
        <Modal visible={loadingProfile} transparent animationType="fade">
          <View style={styles.mentionDialogOverlay}>
            <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0068FF" />
              <Text style={{ marginTop: 12, color: '#666' }}>Đang tải...</Text>
            </View>
          </View>
        </Modal>

        {/* Custom Mention Dialog Modal */}
        <Modal visible={!!mentionActionUser} transparent animationType="fade" onRequestClose={() => setMentionActionUser(null)}>
          <TouchableOpacity style={styles.mentionDialogOverlay} activeOpacity={1} onPress={() => setMentionActionUser(null)}>
            <TouchableWithoutFeedback>
              <View style={styles.mentionDialogContainer}>
                <Text style={styles.mentionDialogTitle}>{mentionActionUser?.name}</Text>
                
                <TouchableOpacity style={styles.mentionDialogItem} onPress={handleViewMentionProfile}>
                  <Text style={styles.mentionDialogItemText}>Xem trang cá nhân</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mentionDialogItem} onPress={handleTagMentionUser}>
                  <Text style={styles.mentionDialogItemText}>@ Nhắc đến...</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mentionDialogItem} onPress={handleDirectMessageMention}>
                  <Text style={styles.mentionDialogItemText}>Nhắn tin riêng</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mentionDialogItem} onPress={handleCallMention}>
                  <Text style={styles.mentionDialogItemText}>Gọi Zalo miễn phí</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mentionDialogItem} onPress={handleTransferMention}>
                  <Text style={styles.mentionDialogItemText}>Chuyển khoản nhanh</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* User Profile Card Modal */}
        <Modal visible={!!selectedUserProfile} transparent animationType="slide" onRequestClose={() => setSelectedUserProfile(null)}>
          <View style={styles.mentionDialogOverlay}>
            <View style={styles.profileCardContainer}>
              {/* Cover photo */}
              <View style={styles.profileCardCoverWrap}>
                {selectedUserProfile?.coverUrl ? (
                  <Image source={{ uri: selectedUserProfile.coverUrl }} style={styles.profileCardCover} />
                ) : (
                  <View style={[styles.profileCardCover, { backgroundColor: '#005FD8' }]} />
                )}
                {/* Close button */}
                <TouchableOpacity style={styles.profileCardCloseBtn} onPress={() => setSelectedUserProfile(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Avatar */}
              <View style={styles.profileCardAvatarWrap}>
                {selectedUserProfile?.avatarUrl ? (
                  <Image source={{ uri: selectedUserProfile.avatarUrl }} style={styles.profileCardAvatar} />
                ) : (
                  <View style={styles.profileCardAvatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#fff" />
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={styles.profileCardName}>{selectedUserProfile?.fullName}</Text>

              {/* Details card */}
              <View style={styles.profileCardInfoWrap}>
                <Text style={styles.profileCardInfoTitle}>Thông tin cá nhân</Text>
                
                <View style={styles.profileCardInfoRow}>
                  <Text style={styles.profileCardInfoLabel}>Giới tính</Text>
                  <Text style={styles.profileCardInfoValue}>{selectedUserProfile?.gender || 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.profileCardInfoRow}>
                  <Text style={styles.profileCardInfoLabel}>Ngày sinh</Text>
                  <Text style={styles.profileCardInfoValue}>
                    {selectedUserProfile?.birthday ? new Date(selectedUserProfile.birthday).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                  </Text>
                </View>

                <View style={styles.profileCardInfoRow}>
                  <Text style={styles.profileCardInfoLabel}>ID người dùng</Text>
                  <Text style={styles.profileCardInfoValue}>#{selectedUserProfile?.id || '---'}</Text>
                </View>

                <View style={styles.profileCardInfoRow}>
                  <Text style={styles.profileCardInfoLabel}>Số điện thoại</Text>
                  <Text style={styles.profileCardInfoValue}>{selectedUserProfile?.phone || 'Ẩn'}</Text>
                </View>
              </View>

              {/* Footer action buttons */}
              <View style={styles.profileCardFooter}>
                <TouchableOpacity 
                  style={styles.profileCardFooterBtn} 
                  onPress={() => {
                    const u = selectedUserProfile;
                    setSelectedUserProfile(null);
                    setMentionActionUser({ id: u.id, name: u.fullName });
                    handleDirectMessageMention();
                  }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                  <Text style={styles.profileCardFooterBtnText}>Nhắn tin</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.profileCardFooterBtn, { backgroundColor: '#e0e0e0' }]} 
                  onPress={() => setSelectedUserProfile(null)}
                >
                  <Text style={{ color: '#333', fontWeight: '600' }}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#e1e4ea',
  },
  unreadBadgeMsg: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeTextMsg: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  jumpToUnreadBanner: {
    position: 'absolute',
    top: 10,
    right: 16,
    backgroundColor: '#e6f0ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#b3d4ff',
  },
  jumpToUnreadText: {
    color: '#0068FF',
    fontSize: 13,
    fontWeight: '600',
  },
  mentionListWrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e4ea',
    maxHeight: 180,
  },
  mentionScrollView: {
    paddingVertical: 4,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e1bee7',
    marginRight: 12,
  },
  mentionName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },

  // Custom Mention Dialog & Profile Card Modals
  mentionDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mentionDialogContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '80%',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  mentionDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  mentionDialogItem: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  mentionDialogItemText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  profileCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '85%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  profileCardCoverWrap: {
    position: 'relative',
    height: 120,
    width: '100%',
  },
  profileCardCover: {
    height: 120,
    width: '100%',
  },
  profileCardCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardAvatarWrap: {
    alignSelf: 'center',
    marginTop: -40,
    position: 'relative',
    zIndex: 1,
  },
  profileCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileCardAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#b0c4de',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  profileCardInfoWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  profileCardInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  profileCardInfoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  profileCardInfoLabel: {
    width: 110,
    fontSize: 14,
    color: '#888',
  },
  profileCardInfoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  profileCardFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  profileCardFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  profileCardFooterBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  filterBarContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
  },
  filterBarScroll: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  filterTabButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
  },
  filterTabButtonActive: {
    backgroundColor: '#0068FF',
    borderColor: '#0068FF',
  },
  filterTabText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // --- AI Summarize Modal ---
  summarizeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  summarizeModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    flexDirection: 'column',
  },
  summarizeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summarizeModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  summarizeModalBtn: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  summarizeModalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});