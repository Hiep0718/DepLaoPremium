import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


import { MoreHorizontal, Download, FileText, Loader2, AlertCircle, Pin, Video, Phone, Smile, BarChart2, Trash2, Copy, Check, RefreshCw, Volume2, VolumeX } from 'lucide-react';

import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { fetchAiMessages, streamAiChat } from '../../services/aiChat.service';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { socket } from '../../services/socket';
import { contactService } from '../../services/contactService';
import api from '../../services/axios';
import ProfileModal from '../ProfileModal';
import CreatePollModal from './CreatePollModal';
import SummarizeModal from './SummarizeModal';

const BUBBLE_RADIUS = {
  modern: { normal: '18px', corner: '6px' },
  classic: { normal: '8px', corner: '3px' },
  minimal: { normal: '4px', corner: '2px' },
};

const REACTION_EMOJIS = [
  { type: 'love', icon: '❤️' },
  { type: 'like', icon: '👍' },
  { type: 'haha', icon: '😆' },
  { type: 'wow', icon: '😯' },
  { type: 'sad', icon: '😢' },
  { type: 'angry', icon: '😡' },
];

// Helper: detect URLs in text and render as clickable links
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

const renderTextWithLinks = (
  text: string, 
  memberMap?: Record<string, any>, 
  onPressMention?: (userId: string, fullName: string) => void
) => {
  if (!text) return text;
  
  let mentionRegex: RegExp | null = null;
  if (memberMap) {
    const names = Object.values(memberMap).map(m => m.fullName).filter(Boolean);
    if (names.length > 0) {
      // Sort by length desc to match longer names first
      const escapedNames = names
        .sort((a, b) => b.length - a.length)
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      mentionRegex = new RegExp(`@(${escapedNames.join('|')})`, 'gi');
    }
  }

  const parts = text.split(URL_REGEX);
  if (parts.length === 1 && !mentionRegex) {
    return text;
  }

  // If there are mentions but NO URLs, handle them directly
  if (parts.length === 1 && mentionRegex) {
    const mentionParts = text.split(mentionRegex);
    if (mentionParts.length > 1) {
      return mentionParts.map((mPart, j) => {
        if (j % 2 === 1) {
          const memberEntry = Object.entries(memberMap || {}).find(([_, info]) => info.fullName === mPart);
          const userId = memberEntry ? memberEntry[0] : null;
          return (
            <span 
              key={`mention-single-${j}`} 
              style={{ color: '#0068FF', fontWeight: 600, cursor: userId ? 'pointer' : 'default' }}
              className={userId ? 'hover:underline' : ''}
              onClick={(e) => {
                if (userId && onPressMention) {
                  e.stopPropagation();
                  onPressMention(userId, mPart);
                }
              }}
            >
              @{mPart}
            </span>
          );
        }
        return <span key={`text-single-${j}`}>{mPart}</span>;
      });
    }
    return text;
  }

  return parts.map((urlPart, i) => {
    if (URL_REGEX.test(urlPart)) {
      URL_REGEX.lastIndex = 0;
      const href = urlPart.startsWith('http') ? urlPart : `https://${urlPart}`;
      return (
        <a
          key={`url-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#4A90D9', textDecoration: 'underline', wordBreak: 'break-all' }}
          onMouseEnter={(e) => (e.target as HTMLAnchorElement).style.color = '#2B6CB0'}
          onMouseLeave={(e) => (e.target as HTMLAnchorElement).style.color = '#4A90D9'}
        >
          {urlPart}
        </a>
      );
    }
    
    URL_REGEX.lastIndex = 0;
    
    if (mentionRegex) {
      const mentionParts = urlPart.split(mentionRegex);
      if (mentionParts.length > 1) {
        return mentionParts.map((mPart, j) => {
          if (j % 2 === 1) {
            const memberEntry = Object.entries(memberMap || {}).find(([_, info]) => info.fullName === mPart);
            const userId = memberEntry ? memberEntry[0] : null;
            return (
              <span 
                key={`mention-${i}-${j}`} 
                style={{ color: '#0068FF', fontWeight: 600, cursor: userId ? 'pointer' : 'default' }}
                className={userId ? 'hover:underline' : ''}
                onClick={(e) => {
                  if (userId && onPressMention) {
                    e.stopPropagation();
                    onPressMention(userId, mPart);
                  }
                }}
              >
                @{mPart}
              </span>
            );
          }
          return <span key={`text-${i}-${j}`}>{mPart}</span>;
        });
      }
    }
    return <span key={`text-${i}`}>{urlPart}</span>;
  });
};
// Helper: format file size
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Helper: Get file extension
const getFileExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toUpperCase() || '';
    return ext.length <= 5 ? ext : '';
  } catch {
    return '';
  }
};

// ── Markdown components for AI messages ──


const markdownComponents: any = {
  code: ({ children }: any) => (
    <span className="font-semibold text-[#f97316] bg-[#fff7ed] px-1.5 py-0.5 rounded-md border border-[#ffedd5] shadow-sm mx-0.5">
      {children}
    </span>
  ),
  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-bold mb-1.5 mt-2.5">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
  strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-3 pl-3 my-2 italic opacity-80" style={{ borderColor: '#f97316' }}>
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2 rounded-lg" style={{ border: '1px solid var(--border-light)' }}>
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-bold text-xs" style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-light)' }}>{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5 text-sm" style={{ borderBottom: '1px solid var(--border-light)' }}>{children}</td>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600">{children}</a>,
  hr: () => <hr className="my-3" style={{ borderColor: 'var(--border-light)' }} />,
};

// AI welcome screen suggestion categories
const AI_WELCOME_SUGGESTIONS = [
  { emoji: '🍜', title: 'Công thức nấu ăn', prompt: 'Cho tôi công thức nấu phở bò tại nhà' },
  { emoji: '🥗', title: 'Món ăn healthy', prompt: 'Gợi ý 3 món ăn healthy dễ làm cho bữa trưa' },
  { emoji: '🍳', title: 'Nấu từ nguyên liệu', prompt: 'Tôi có trứng, cà chua và hành. Nấu được món gì?' },
  { emoji: '🌶️', title: 'Ẩm thực vùng miền', prompt: 'Giới thiệu món ăn đặc trưng miền Trung' },
  { emoji: '🧁', title: 'Món tráng miệng', prompt: 'Cách làm bánh flan caramel siêu mềm mịn' },
  { emoji: '💡', title: 'Mẹo nấu ăn', prompt: 'Chia sẻ 5 mẹo nấu ăn giúp tiết kiệm thời gian' },
];


const MessageList = () => {
  const [editingPoll, setEditingPoll] = useState<{ isOpen: boolean, msgId: string, initialData?: any } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { activeConversation, messages, setMessages, setReplyingMessage, setForwardingMessage, updateMessage, activeContactInfo, pinnedMessage, setPinnedMessage } = useChatStore();
  const { user } = useAuthStore();

  const [cloudFilter, setCloudFilter] = useState<'all' | 'image' | 'file' | 'link' | 'text' | 'collection'>('all');
  const isCloudConversation = activeConversation?.conversationId?.startsWith('cloud_');

  const filteredMessages = useMemo(() => {
    if (!isCloudConversation || cloudFilter === 'all') return messages;
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
  }, [messages, isCloudConversation, cloudFilter]);
  const { settings } = useSettingsStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('up');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [addingOptionToId, setAddingOptionToId] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState("");
  const [showEndedCallPopup, setShowEndedCallPopup] = useState(false);

  // AI streaming state (must be before any early return)
  const isAiStreaming = useChatStore((s) => s.isAiStreaming);
  const aiStreamingText = useChatStore((s) => s.aiStreamingText);

  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string; }>>({});
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [unreadCountToShow, setUnreadCountToShow] = useState<number>(0);
  const [reactionTooltipId, setReactionTooltipId] = useState<string | null>(null);
  const [tooltipDirection, setTooltipDirection] = useState<'up' | 'down'>('up');

  // AI action states
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [readingMsgId, setReadingMsgId] = useState<string | null>(null);
  const [isSummarizeModalOpen, setIsSummarizeModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenSummarize = () => setIsSummarizeModalOpen(true);
    window.addEventListener('open-summarize-modal', handleOpenSummarize);
    return () => window.removeEventListener('open-summarize-modal', handleOpenSummarize);
  }, []);

  // Mention Tag Tracking
  const [unreadMentionMessageId, setUnreadMentionMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Pagination states
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    if (!activeConversation?.isGroup || !user?.fullName || messages.length === 0) {
      setUnreadMentionMessageId(null);
      return;
    }

    // Quét toàn bộ messages để tìm @tên mình (không giới hạn unread)
    const escapedName = user.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRegex = new RegExp(`@${escapedName}`, 'i');
    
    // Tìm tin nhắn CŨ NHẤT chứa tag (từ đầu mảng - tin cũ nhất)
    const taggedMsg = messages.find(msg => {
      if (String(msg.senderId) === String(user.id)) return false; // Bỏ qua tin do mình gửi
      const content = msg.content || msg.text || '';
      return mentionRegex.test(content);
    });

    if (taggedMsg) {
      setUnreadMentionMessageId(taggedMsg._id || taggedMsg.id);
    } else {
      setUnreadMentionMessageId(null);
    }
  }, [messages, activeConversation?.isGroup, user?.fullName, user?.id]);

  const handlePressMention = async (userId: string, fullName: string) => {
    try {
      const res = await api.get(`/users/${userId}`);
      if (res.data?.data) {
        setActiveProfile(res.data.data);
      } else {
        setActiveProfile({ id: Number(userId), fullName });
      }
      setIsProfileModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch user profile via mention", err);
      setActiveProfile({ id: Number(userId), fullName });
      setIsProfileModalOpen(true);
    }
  };

  // Read AI message aloud
  const handleReadAloud = useCallback((msgId: string, content: string) => {
    if (readingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setReadingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    
    // Clean markdown before speaking
    const cleanText = content.replace(/[#*`_~\[\]()]/g, '').trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    
    utterance.onend = () => setReadingMsgId(null);
    utterance.onerror = () => setReadingMsgId(null);
    
    setReadingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  }, [readingMsgId]);

  const bubbleR = BUBBLE_RADIUS[settings.bubbleStyle] || BUBBLE_RADIUS.modern;

  // Copy AI message to clipboard
  const handleCopyAiMessage = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  const handleScrollToPinnedMessage = useCallback(() => {
    if (!pinnedMessage?.messageId) return;
    const targetElement = document.getElementById(`message-${pinnedMessage.messageId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(pinnedMessage.messageId);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    }
  }, [pinnedMessage?.messageId]);

  // Regenerate AI response
  const handleRegenerateAi = useCallback(async (aiMsgId: string) => {
    if (!user?.id || !activeConversation) return;
    // Find the user message that preceded this AI response
    const msgIdx = messages.findIndex(m => (m._id || m.id) === aiMsgId);
    if (msgIdx <= 0) return;

    // Walk backwards to find the last user message
    let userContent = '';
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (messages[i].senderId === user.id.toString()) {
        userContent = messages[i].content || messages[i].text || '';
        break;
      }
    }
    if (!userContent) return;

    setRegeneratingId(aiMsgId);

    // Remove the old AI message from the UI
    const { setMessages: setMsgs, setAiStreaming, appendAiToken, finishAiStream } = useChatStore.getState();
    setMsgs(messages.filter(m => (m._id || m.id) !== aiMsgId));

    // Re-stream
    setAiStreaming(true);
    await streamAiChat(
      user.id.toString(),
      userContent,
      (token) => appendAiToken(token),
      () => { finishAiStream(user.id.toString()); setRegeneratingId(null); },
      () => { setAiStreaming(false); setRegeneratingId(null); }
    );
  }, [user, activeConversation, messages]);

  useEffect(() => {
    // Reset when switching conversations
    setFirstUnreadMessageId(null);
    setUnreadCountToShow(0);
  }, [activeConversation?.conversationId]);

  useEffect(() => {
    if (!activeConversation || !user?.id) return;
    const isAi = activeConversation.conversationId.startsWith('ai_');

    const fetchHistory = async () => {
      try {

        if (isAi) {
          // Load AI messages from ai-chat-service
          const aiMsgs = await fetchAiMessages(user.id.toString());
          const mapped = aiMsgs.map((m) => ({
            id: m._id,
            _id: m._id,
            conversationId: activeConversation.conversationId,
            senderId: m.role === 'user' ? user.id.toString() : 'ai_food_bot',
            content: m.content,
            text: m.content,
            messageType: 'text' as const,
            createdAt: m.createdAt,
          }));
          setMessages(mapped);
          setPinnedMessage(null);
        } else {
          const res = await getConversationHistory(activeConversation.conversationId, user.id.toString());
          if (res.data && Array.isArray(res.data.data)) {
            setMessages(res.data.data);
            setPinnedMessage(res.data.pinnedMessage || null);
            setNextCursor(res.data.pagination?.nextCursor || null);
            setHasMore(!!res.data.pagination?.nextCursor);
          }
        }
      } catch (err) {
        console.error('Error fetching messages', err);
      }
    };

    if (!activeConversation.conversationId.startsWith('new_') && !activeConversation.conversationId.startsWith('contact_')) {
      setMessages([]); // Clear old messages immediately to prevent flickering/leaking
      fetchHistory();
    } else {
      setMessages([]);
      setPinnedMessage(null);
    }
  }, [activeConversation, user, setMessages, setPinnedMessage]);

  useEffect(() => {
    if (!activeConversation?.isGroup) return;
    const fetchMembers = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      const { default: api } = await import('../../services/axios');

      // Collect IDs from current participants
      const allIds = new Set<string>();
      for (const p of (activeConversation.participants || [])) {
        const uid = String(p.userId || p.contactUserId || p.id || p);
        if (uid) allIds.add(uid);
      }

      // Also collect IDs from system messages (removed/left members, added members)
      for (const msg of messages) {
        if (msg.messageType !== 'system') continue;
        const content = msg.content || msg.text || '';
        if (content.startsWith('member_left:')) {
          allIds.add(content.split(':')[1]);
        } else if (content.startsWith('member_removed:')) {
          const parts = content.split(':');
          if (parts[1]) allIds.add(parts[1]);
          if (parts[2]) allIds.add(parts[2]);
        } else if (content.startsWith('added_members:')) {
          content.split(':')[1].split(',').forEach((id: string) => allIds.add(id));
        }
        // Also add senderId
        if (msg.senderId && msg.senderId !== user?.id?.toString()) {
          allIds.add(msg.senderId);
        }
      }

      // Giữ tất cả ID bao gồm cả user hiện tại (cần cho mention matching)

      // Fetch all unique IDs
      for (const uid of allIds) {
        if (!uid) continue;
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName || res.data.data.nickname, avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }
      setMemberMap(map);
    };
    fetchMembers();
  }, [activeConversation?.conversationId, activeConversation?.isGroup, activeConversation?.participants?.length, messages.length, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Scroll-to-bottom and load-more tracking
  const handleScroll = useCallback(async () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 200);

    // Load more when reaching top
    if (el.scrollTop < 100 && hasMore && !loadingMore && nextCursor && activeConversation?.conversationId && user?.id) {
      if (activeConversation.conversationId.startsWith('ai_')) return;

      setLoadingMore(true);
      const previousScrollHeight = el.scrollHeight;
      try {
        const res = await getConversationHistory(activeConversation.conversationId, user.id.toString(), 1, 50, nextCursor);
        if (res.data && Array.isArray(res.data.data)) {
          const newMessages = res.data.data;
          // Zustand setMessages in chatStore just replaces the array, so we must merge
          const { messages: currentMessages, setMessages: updateMsgs } = useChatStore.getState();
          // Assuming older messages are appended to the end of the array, or prepended?
          // The initial fetch sets `messages` to `res.data.data`.
          // `messageController` returns messages in chronological order!
          // Wait, `messageController.js` says: `data: messages.reverse(), // Return in chronological order`
          // So the array returned has oldest first, newest last.
          // Therefore, the "older page" (nextCursor) contains messages older than the oldest message in our current state.
          // We must PREPEND them.
          updateMsgs([...newMessages, ...currentMessages]);
          
          setNextCursor(res.data.pagination?.nextCursor || null);
          setHasMore(!!res.data.pagination?.nextCursor);

          // Restore scroll position so user doesn't jump to top
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - previousScrollHeight;
            }
          }, 0);
        }
      } catch (err) {
        console.error('Error loading more messages', err);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [hasMore, loadingMore, nextCursor, activeConversation, user]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToMention = useCallback(() => {
    if (!unreadMentionMessageId) return;
    const el = document.getElementById(`message-${unreadMentionMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(unreadMentionMessageId);
      // Xoá highlight sau 2 giây (khớp với thời gian animation)
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, [unreadMentionMessageId]);

  // Socket listener for revoke and reaction
  useEffect(() => {
    const handleRevoked = (data: any) => {
      if (data.messageId) {
        updateMessage(data.messageId, { isRevoked: true });
      }
    };
    const handleReacted = (data: any) => {
      if (data.messageId) {
        const payload: any = { reactions: data.reactions };
        if (data.content !== undefined) {
          payload.content = data.content; // This is important for real-time poll updates
        }
        updateMessage(data.messageId, payload);
      }
    };

    socket.on('message_revoked', handleRevoked);
    socket.on('message_reacted', handleReacted);
    return () => {
      socket.off('message_revoked', handleRevoked);
      socket.off('message_reacted', handleReacted);
    };
  }, [updateMessage]);

  const handleRevoke = (msg: any) => {
    if (!user) return;
    socket.emit('revoke_message', {
      messageId: msg._id || msg.id,
      conversationId: activeConversation?.conversationId,
      userId: user.id.toString(),
    });
    setOpenMenuId(null);
  };

  const handleTogglePinMessage = (msg: any) => {
    if (!user) return;
    const isCurrentlyPinned = pinnedMessage?.messageId === (msg._id || msg.id);
    if (isCurrentlyPinned) {
      socket.emit('unpin_message', { conversationId: activeConversation?.conversationId, userId: user.id.toString() });
    } else {
      socket.emit('pin_message', { messageId: msg._id || msg.id, conversationId: activeConversation?.conversationId, userId: user.id.toString() });
    }
    setOpenMenuId(null);
  };

  const handleTranslate = async (msg: any) => {
    const textToTranslate = msg.content || msg.text;
    const msgId = msg._id || msg.id;
    if (!textToTranslate || !msgId) return;

    setTranslatingId(msgId);
    setOpenMenuId(null);
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
      console.error('Translation error:', err);
    } finally {
      setTranslatingId(null);
    }
  };

  const handleReactMessage = (msgId: string, reactionType: string) => {
    if (!user || !activeConversation) return;

    // Emit socket event
    socket.emit('react_message', {
      messageId: msgId,
      conversationId: activeConversation.conversationId,
      userId: user.id.toString(),
      reactionType
    });

    setReactionTooltipId(null);
    setOpenMenuId(null);
  };

  // Helper: format date separator
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Hôm nay';
    if (isYesterday(date)) return 'Hôm qua';
    return format(date, 'dd/MM/yyyy', { locale: vi });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);


  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        <div className="text-center max-w-sm animate-fadeIn">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-hover)' }}>
            <span className="text-4xl">💬</span>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Chào mừng đến với Zalo Clone!
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu nhắn tin.
          </p>
        </div>
      </div>
    );
  }

  // Get contact info for received messages
  // Get contact info for received messages
  const isAiConversation = activeConversation.conversationId.startsWith('ai_');
  const conversationContact = activeConversation?.participants?.find((p: any) => p.userId !== user?.id?.toString() && p.id !== user?.id?.toString()) || activeConversation?.participants?.[0];

  const contactAvatar = isAiConversation ? undefined : (activeContactInfo?.avatarUrl || conversationContact?.avatarUrl);
  const contactName = isAiConversation ? 'Bếp AI 🍜' : (activeContactInfo?.name || conversationContact?.nickname || conversationContact?.fullName || '?');


  // Render image message
  const renderImageMessage = (msg: any, isMe: boolean, msgTime: Date, isInGrid: boolean = false, isLastInCluster: boolean = true) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;

    return (
      <div className={`relative group/media overflow-hidden cursor-pointer ${isInGrid ? 'w-full h-full rounded-md' : 'max-w-[280px]'}`}
        style={{
          borderRadius: isInGrid ? '4px' : (isLastInCluster ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px') : '18px'),
        }}
        onClick={() => !isUploading && msg.fileUrl && setLightboxUrl(msg.fileUrl)}
      >
        <img
          src={msg.fileUrl}
          alt="Hình ảnh"
          className={`w-full object-cover transition-all ${isUploading ? 'opacity-50 blur-[1px]' : 'hover:brightness-95'} ${isInGrid ? 'h-full absolute inset-0' : 'max-h-[300px]'}`}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5Ij5MxJdpIHThuqNpIMOjbmg8L3RleHQ+PC9zdmc+';
          }}
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-white drop-shadow-lg" />
          </div>
        )}
        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
            <AlertCircle size={28} className="text-red-400" />
          </div>
        )}
        {/* Time overlay */}
        <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-0.5 select-none whitespace-nowrap bg-black/40 text-white backdrop-blur-sm">
          {format(msgTime, 'HH:mm')}
          {isMe && (
            <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </span>
      </div>
    );
  };

  // Render video message
  const renderVideoMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;

    return (
      <div className="relative group/media overflow-hidden max-w-[320px]"
        style={{
          borderRadius: isLastInCluster ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px') : '18px',
        }}
      >
        {isUploading ? (
          <div className="w-[280px] h-[160px] bg-[var(--bg-hover)] rounded-xl flex items-center justify-center">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
          </div>
        ) : (
          <video
            src={msg.fileUrl}
            controls
            preload="metadata"
            className={`w-full max-h-[300px] rounded-xl ${isFailed ? 'opacity-50' : ''}`}
            style={{ background: '#000' }}
          />
        )}
        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl z-20 pointer-events-none">
            <AlertCircle size={28} className="text-red-400" />
          </div>
        )}
        {/* Time overlay */}
        <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-0.5 select-none whitespace-nowrap bg-black/40 text-white backdrop-blur-sm z-10">
          {format(msgTime, 'HH:mm')}
          {isMe && (
            <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </span>
      </div>
    );
  };

  // Render audio message
  const renderAudioMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    const isUploading = (msg as any)._uploading;

    return (
      <div className="relative group/media p-2 max-w-[320px]"
        style={{
          background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)',
          borderRadius: isLastInCluster ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px') : '18px',
          boxShadow: !isMe ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        }}>
        {isUploading ? (
          <div className="flex items-center gap-2 w-48 h-10 px-2 justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
          </div>
        ) : (
          <audio
            src={msg.fileUrl}
            controls
            preload="metadata"
            className="w-64 h-12 outline-none rounded-lg"
          />
        )}
        {/* Time overlay */}
        <div className="flex justify-end mt-1 px-1">
          <span className="text-[11px] flex items-center gap-0.5 select-none"
            style={{ color: '#6b7b8d' }}>
            {format(msgTime, 'HH:mm')}
            {isMe && (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Render file message
  const renderFileMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;
    const fileName = (msg as any).fileName || msg.content || msg.text || 'File';
    const fileSize = (msg as any).fileSize;
    const ext = msg.fileUrl ? getFileExtension(msg.fileUrl) : '';

    return (
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl max-w-[320px] transition-shadow hover:shadow-md cursor-pointer ${isFailed ? 'opacity-70 bg-red-50' : ''}`}
        style={{
          background: isFailed ? 'var(--bg-panel)' : isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)',
          borderRadius: isLastInCluster
            ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px')
            : '18px',
          boxShadow: !isMe ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          border: isFailed ? '1px solid red' : undefined
        }}
        onClick={() => {
          if (!isUploading && !isFailed && msg.fileUrl) {
            window.open(msg.fileUrl, '_blank');
          }
        }}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,104,255,0.1)' }}
        >
          {isUploading ? (
            <Loader2 size={20} className="animate-spin" style={{ color: '#0068FF' }} />
          ) : (
            <FileText size={20} style={{ color: '#0068FF' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {typeof fileName === 'string' && fileName.startsWith('[Tệp]') ? fileName.replace('[Tệp] ', '') : fileName}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {ext && <span className="mr-1">{ext}</span>}
            {fileSize ? formatFileSize(fileSize) : ''}
          </p>
        </div>
        {!isUploading && msg.fileUrl && (
          <a
            href={msg.fileUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-full transition-colors flex-shrink-0"
            style={{ color: '#0068FF' }}
          >
            <Download size={18} />
          </a>
        )}
        {/* Time inside file bubble */}
        <span className="text-[11px] self-end flex items-center gap-0.5 select-none whitespace-nowrap flex-shrink-0"
          style={{ color: '#6b7b8d' }}>
          {format(msgTime, 'HH:mm')}
          {isMe && (
            <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
              stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </span>
      </div>
    );
  };

  // Render contact message
  const renderContactMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    let parsedContact: any = null;
    try {
      parsedContact = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
    } catch {
      parsedContact = {};
    }

    const { fullName, avatarUrl, phone, contactUserId, id } = parsedContact || {};
    const displayName = fullName || 'Người dùng';
    const avatar = avatarUrl;
    const targetUserId = contactUserId || id;

    return (
      <div
        className="flex flex-col gap-2 px-3 py-2.5 rounded-2xl min-w-[220px] max-w-[280px] shadow-sm cursor-default"
        style={{
          background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-panel)',
          border: isMe ? 'none' : '1px solid var(--border-light)',
          borderRadius: isLastInCluster
            ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px')
            : '18px',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-lg text-white"
            style={{ background: avatar ? 'transparent' : 'var(--accent-primary)' }}>
            {avatar ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
            <span className="text-xs truncate opacity-80" style={{ color: 'var(--text-secondary)' }}>
              {phone || 'Không có SĐT'}
            </span>
          </div>
        </div>

        <div className="border-t pt-2 mt-1 flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-light)' }}>
          <button
            className="flex-1 text-[11px] py-1.5 rounded-md font-medium transition-colors text-center"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            onClick={async (e) => {
              e.stopPropagation();
              if (phone) {
                try {
                  await contactService.sendFriendRequest(phone);
                  alert("Đã gửi lời mời kết bạn");
                } catch (err: any) {
                  alert(err?.response?.data?.message || "Không thể gửi kết bạn");
                }
              }
            }}
          >
            Kết bạn
          </button>

          <button
            className="flex-1 text-[11px] py-1.5 rounded-md font-medium transition-colors text-center"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveProfile({ id: targetUserId, fullName: displayName, avatarUrl: avatar, phone });
              setIsProfileModalOpen(true);
            }}
          >
            Trang cá nhân
          </button>
        </div>

        {/* Time overlay */}
        <div className="flex justify-end mt-1 px-1">
          <span className="text-[11px] flex items-center gap-0.5 select-none"
            style={{ color: '#6b7b8d' }}>
            {format(msgTime, 'HH:mm')}
            {isMe && (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Render Location Message
  const renderLocationMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    let locData: { latitude: number; longitude: number; address: string } | null = null;
    try {
      const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      if (parsed?.latitude && parsed?.longitude) locData = parsed;
    } catch {
      const text = msg.content || msg.text || '';
      const match = text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (match) locData = { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]), address: text };
    }
    if (!locData) return null;

    const mapUrl = `https://www.openstreetmap.org/#map=16/${locData.latitude}/${locData.longitude}`;
    const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${locData.latitude},${locData.longitude}&zoom=15&size=280x140&maptype=mapnik&markers=${locData.latitude},${locData.longitude},red-pushpin`;

    return (
      <div
        className="w-[280px] rounded-2xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
        style={{
          background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-panel)',
          border: isMe ? 'none' : '1px solid var(--border-light)',
          borderRadius: isLastInCluster ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px') : '18px',
        }}
        onClick={() => window.open(mapUrl, '_blank')}
      >
        {/* Map Preview */}
        <div className="w-full h-[140px] bg-[var(--bg-hover)] flex items-center justify-center relative overflow-hidden">
          <img
            src={staticMapUrl}
            alt="Map"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0068FF" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>';
            }}
          />
        </div>
        {/* Info */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4757" stroke="#FF4757" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Vị trí của tôi</span>
          </div>
          <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{locData.address}</p>
          <p className="text-[10px] mb-2 font-mono" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{locData.latitude.toFixed(6)}, {locData.longitude.toFixed(6)}</p>
          <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg" style={{ background: 'rgba(0,104,255,0.08)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0068FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span className="text-xs font-semibold" style={{ color: '#0068FF' }}>Mở bản đồ</span>
          </div>
        </div>
        {/* Time */}
        <div className="flex justify-end px-3 pb-2">
          <span className="text-[11px] flex items-center gap-0.5 select-none" style={{ color: '#6b7b8d' }}>
            {format(msgTime, 'HH:mm')}
            {isMe && (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Render Reminder Message
  const renderReminderMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    let remData: { text: string; reminderTime: string } | null = null;
    try {
      const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      if (parsed?.text && parsed?.reminderTime) remData = parsed;
    } catch {}
    if (!remData) return null;

    const isPast = new Date(remData.reminderTime) < new Date();
    const reminderDate = new Date(remData.reminderTime);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedTime = `${pad(reminderDate.getHours())}:${pad(reminderDate.getMinutes())} - ${pad(reminderDate.getDate())}/${pad(reminderDate.getMonth() + 1)}/${reminderDate.getFullYear()}`;

    return (
      <div
        className="flex items-start gap-3 px-3 py-3 min-w-[220px] max-w-[280px]"
        style={{
          background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-panel)',
          border: isMe ? 'none' : '1px solid var(--border-light)',
          borderRadius: isLastInCluster ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px') : '18px',
          boxShadow: !isMe ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isPast ? 'rgba(153,153,153,0.12)' : 'rgba(255,99,72,0.12)' }}>
          {isPast ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6348" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M5 3L2 6"></path><path d="M22 6l-3-3"></path></svg>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isPast ? 'Đã nhắc hẹn' : '⏰ Nhắc hẹn'}
            </span>
          </div>
          <p className="text-sm leading-relaxed mb-2 line-clamp-3" style={{ color: 'var(--text-primary)', opacity: isPast ? 0.6 : 1 }}>
            {remData.text}
          </p>
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span className="text-xs" style={{ color: '#888' }}>{formattedTime}</span>
          </div>
          {/* Message time */}
          <div className="flex justify-end mt-1.5">
            <span className="text-[11px] flex items-center gap-0.5 select-none" style={{ color: '#6b7b8d' }}>
              {format(msgTime, 'HH:mm')}
              {isMe && (
                <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render Poll Message
  const renderPollMessage = (msg: any, isMe: boolean, msgTime: Date) => {
    let pollData;
    try {
      pollData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
    } catch (e) {
      return <div className="p-3 text-red-500 italic">Lỗi hiển thị bình chọn</div>;
    }

    const totalVotes = pollData.options.reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0);

    const handleVote = (optId: any) => {
      socket.emit('vote_poll', {
        messageId: msg._id || msg.id,
        conversationId: activeConversation.conversationId,
        optionId: optId
      });
    };

    const handleRevokePoll = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Bạn có muốn xóa bình chọn này?')) {
        socket.emit('revoke_message', {
          messageId: msg._id || msg.id,
          conversationId: activeConversation.conversationId,
          userId: user?.id?.toString()
        });
      }
    };

    const handleEditPoll = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingPoll({
        isOpen: true,
        msgId: msg._id || msg.id,
        initialData: pollData
      });
    };

    const handleAddPollOption = () => {
      if (!newOptionText.trim() || !addingOptionToId) return;
      socket.emit('add_poll_option', {
        messageId: addingOptionToId,
        conversationId: activeConversation.conversationId,
        optionText: newOptionText.trim()
      });
      setAddingOptionToId(null);
      setNewOptionText("");
    };

    return (
      <div className="p-4 min-w-[280px] max-w-[350px] shadow-sm relative group"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[#0068FF]">
            <BarChart2 size={20} />
            <span className="font-bold text-[15px]">Bình chọn</span>
          </div>
          {isMe && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleEditPoll} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[#0068FF]" title="Chỉnh sửa">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onClick={handleRevokePoll} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-red-500" title="Xóa">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <h4 className="font-bold text-[16px] mb-4 text-[var(--text-primary)] leading-tight">
          {pollData.question}
        </h4>

        <div className="space-y-3 mb-4">
          {pollData.options.map((option: any) => {
            const votesCount = option.votes?.length || 0;
            const percentage = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;
            const hasVoted = option.votes?.includes(user?.id?.toString());

            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => handleVote(option.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all relative overflow-hidden flex items-center justify-between ${hasVoted ? 'border-[#0068FF] bg-[#0068FF]/5' : 'border-[var(--border-primary)] hover:border-[#0068FF]/50'
                    }`}
                >
                  {/* Progress Bar Background */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#0068FF]/15 transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />

                  <span className={`relative z-10 text-sm font-medium ${hasVoted ? 'text-[#0068FF]' : 'text-[var(--text-primary)]'}`}>
                    {option.text}
                  </span>

                  <span className="relative z-10 text-xs font-bold text-[var(--text-secondary)]">
                    {votesCount > 0 && votesCount}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {addingOptionToId === (msg._id || msg.id) ? (
          <div className="mb-4 animate-fadeIn">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                autoFocus
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                placeholder="Nhập phương án mới..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#0068FF] bg-white focus:outline-none"
                style={{ color: 'var(--text-primary)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPollOption();
                  if (e.key === 'Escape') setAddingOptionToId(null);
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddPollOption}
                  disabled={!newOptionText.trim()}
                  className="flex-1 py-1.5 bg-[#0068FF] text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  Thêm
                </button>
                <button
                  onClick={() => setAddingOptionToId(null)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setAddingOptionToId(msg._id || msg.id); }}
            className="w-full mb-4 py-2 border border-dashed border-[#0068FF]/50 rounded-xl text-[#0068FF] text-sm font-medium hover:bg-[#0068FF]/5 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Thêm phương án
          </button>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-light)]">
          <span className="text-[12px] text-[var(--text-secondary)]">
            {totalVotes} người đã bình chọn
          </span>
          <span className="text-[10px] text-[var(--text-msg-time)]">
            {format(msgTime, 'HH:mm')}
          </span>
        </div>
        {renderReactions(msg)}
      </div>
    );
  };

  // Render Reactions Pill
  const renderReactions = (msg: any) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;

    // Group reactions by type
    const groups = msg.reactions.reduce((acc: any, r: any) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});

    const uniqueTypes = Object.keys(groups);
    const totalCount = msg.reactions.length;
    const messageId = msg._id || msg.id;

    return (
      <div
        className="absolute -bottom-2.5 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white shadow-sm border border-[#e6e8eb] cursor-pointer hover:bg-gray-50 transition-colors z-20 select-none scale-[0.9] origin-bottom-right"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        onClick={(e) => { e.stopPropagation(); setReactionTooltipId(reactionTooltipId === messageId ? null : messageId); }}
      >
        <div className="flex -space-x-1.5 items-center">
          {uniqueTypes.slice(0, 3).map(type => {
            const emoji = REACTION_EMOJIS.find(e => e.type === type);
            return (
              <div key={type} className="flex items-center justify-center w-4 h-4 rounded-full bg-white ring-1 ring-white">
                <span className="text-[12px] leading-none">{emoji?.icon}</span>
              </div>
            );
          })}
        </div>
        <span className="text-[11px] font-bold ml-0.5 text-[#4a5568]">
          {totalCount}
        </span>
      </div>
    );
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        <div className="text-center max-w-sm animate-fadeIn">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-hover)' }}>
            <span className="text-4xl">💬</span>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Chào mừng đến với Zalo Clone!
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu nhắn tin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showEndedCallPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-bounce-in">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-500">
              <Phone size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cuộc gọi đã kết thúc</h3>
            <p className="text-sm text-gray-500 mb-6">
              Bạn không thể tham gia vì cuộc gọi nhóm này đã kết thúc.
            </p>
            <button
              onClick={() => setShowEndedCallPopup(false)}
              className="w-full py-2.5 bg-[#0068FF] text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 min-h-0 relative" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 size={24} className="animate-spin text-[#0068FF]" />
          </div>
        )}
        {isCloudConversation && (
          <div className="sticky top-0 z-[45] flex items-center justify-start gap-2 py-2 px-3 mb-2 rounded-xl backdrop-blur border shadow-sm select-none"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-light)' }}>
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
                <button
                  key={tab.key}
                  onClick={() => setCloudFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer`}
                  style={{
                    background: isActive ? 'var(--zalo-blue)' : 'var(--bg-search)',
                    color: isActive ? '#fff' : 'var(--text-primary)',
                    borderColor: isActive ? 'var(--zalo-blue)' : 'transparent'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        {pinnedMessage && pinnedMessage.messageId && (
          <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 mb-2 cursor-pointer"
            onClick={handleScrollToPinnedMessage}
            style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
              <Pin size={14} className="text-blue-600 shrink-0" />
              <span className="text-[13px] truncate" style={{ color: 'var(--text-primary)' }}>
                {pinnedMessage.messageType === 'image' ? '[Hình ảnh]' :
                  pinnedMessage.messageType === 'video' ? '[Video]' :
                    pinnedMessage.messageType === 'audio' ? '[Tin nhắn thoại]' :
                      pinnedMessage.messageType === 'file' ? '[Tệp]' :
                        pinnedMessage.messageType === 'sticker' ? '[Nhãn dán]' :
                          pinnedMessage.messageType === 'contact' ? '[Danh thiếp]' :
                            pinnedMessage.content}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-[12px] px-2 py-0.5 rounded font-medium whitespace-nowrap"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                +1 ghim
              </span>
              <button className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (user) {
                    socket.emit('unpin_message', { conversationId: activeConversation?.conversationId, userId: user.id.toString() });
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>

          {/* AI Welcome Screen */}
          {isAiConversation && messages.length === 0 && !isAiStreaming && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn px-4">
              {/* Hero */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                  🍜
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-500 border-3 flex items-center justify-center"
                  style={{ borderColor: 'var(--bg-chat)' }}>
                  <span className="text-white text-xs">✓</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Bếp AI 🍜
              </h2>
              <p className="text-sm text-center max-w-md mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Trợ lý ẩm thực thông minh — Hỏi tôi về công thức, mẹo nấu ăn, gợi ý món ăn, và mọi thứ về ẩm thực Việt Nam & thế giới!
              </p>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {AI_WELCOME_SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('ai_prompt_selected', { detail: s.prompt }));
                    }}
                    className="flex items-start gap-3 p-3.5 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] group"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-light)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block" style={{ color: 'var(--text-primary)' }}>
                        {s.title}
                      </span>
                      <span className="text-xs mt-0.5 block truncate" style={{ color: 'var(--text-secondary)' }}>
                        {s.prompt}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-[11px] mt-6 opacity-60" style={{ color: 'var(--text-secondary)' }}>
                Bếp AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
              </p>
            </div>
          )}

          <div className="w-full space-y-1">
            {filteredMessages.map((msg, idx) => {
              const currentUserId = user?._id?.toString() || user?.id?.toString();
              const isMe = String(msg.senderId) === currentUserId;
              const msgTime = msg.createdAt ? new Date(msg.createdAt) : (msg.timestamp ? new Date(msg.timestamp) : new Date());
              const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
              const nextMsg = idx < filteredMessages.length - 1 ? filteredMessages[idx + 1] : null;
              const prevTime = prevMsg
                ? (prevMsg.createdAt ? new Date(prevMsg.createdAt) : (prevMsg.timestamp ? new Date(prevMsg.timestamp) : null))
                : null;
              const nextTime = nextMsg
                ? (nextMsg.createdAt ? new Date(nextMsg.createdAt) : (nextMsg.timestamp ? new Date(nextMsg.timestamp) : null))
                : null;

              // Show date separator if different day
              const showDateSeparator = idx === 0 || (prevTime && !isSameDay(msgTime, prevTime));

              // Clustering logic for Zalo-style bubbles
              const isFirstInCluster = !prevMsg || prevMsg.senderId !== msg.senderId || (prevTime && Math.abs(msgTime.getTime() - prevTime.getTime()) > 60000) || prevMsg.messageType === 'system' || showDateSeparator;
              const isLastInCluster = !nextMsg || nextMsg.senderId !== msg.senderId || (nextTime && Math.abs(nextTime.getTime() - msgTime.getTime()) > 60000) || nextMsg.messageType === 'system';

              // Check if this is an image inside a cluster (for grid rendering)
              const isImage = msg.messageType === 'image' && !msg.isRevoked && !msg.replyTo;
              let clusterMessages = [msg];

              if (isImage) {
                const isPrevImage = prevMsg && prevMsg.messageType === 'image' && !prevMsg.isRevoked && !prevMsg.replyTo;
                const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
                const isCloseToPrev = prevTime && Math.abs(msgTime.getTime() - prevTime.getTime()) < 60000;
                if (isPrevImage && isSameSenderAsPrev && isCloseToPrev && !showDateSeparator) {
                  return null; // Skip rendering, already rendered in previous cluster
                }

                let fwdIdx = idx + 1;
                while (fwdIdx < filteredMessages.length) {
                  const fwdMsg = filteredMessages[fwdIdx];
                  const fwdTime = fwdMsg.createdAt ? new Date(fwdMsg.createdAt) : (fwdMsg.timestamp ? new Date(fwdMsg.timestamp) : new Date());
                  const lastClMsg = clusterMessages[clusterMessages.length - 1];
                  const lastClTime = lastClMsg.createdAt ? new Date(lastClMsg.createdAt) : (lastClMsg.timestamp ? new Date(lastClMsg.timestamp) : new Date());

                  const fwdClose = Math.abs(fwdTime.getTime() - lastClTime.getTime()) < 60000;
                  const fwdDiffDay = !isSameDay(fwdTime, lastClTime);
                  const fwdSameSender = fwdMsg.senderId === msg.senderId;
                  const fwdIsImage = fwdMsg.messageType === 'image' && !fwdMsg.isRevoked && !fwdMsg.replyTo;

                  if (fwdIsImage && fwdSameSender && fwdClose && !fwdDiffDay) {
                    clusterMessages.push(fwdMsg);
                    fwdIdx++;
                  } else {
                    break;
                  }
                }
              }

              const messageId = msg._id || msg.id;

              let msgSenderAvatar: string | undefined = undefined;
              let msgSenderName = 'Thành viên';


              if (activeConversation.isGroup && !isMe) {
                const sender = activeConversation.participants?.find((p: any) => {
                  const pid = p.userId || p.contactUserId || p.id;
                  return pid?.toString() === msg.senderId;
                });
                const fetchedInfo = memberMap[msg.senderId];
                if (fetchedInfo) {
                  msgSenderAvatar = fetchedInfo.avatarUrl;
                  msgSenderName = fetchedInfo.fullName || 'Thành viên';
                } else if (sender) {
                  msgSenderAvatar = sender.avatarUrl;
                  msgSenderName = sender.nickname || sender.fullName || sender.name || 'Thành viên';
                } else {
                  msgSenderName = 'Thành viên';
                  msgSenderAvatar = undefined;
                }
              } else if (!isMe && !isAiConversation) {
                // Chat 1-1: dùng avatar và tên từ contactAvatar/contactName
                msgSenderAvatar = contactAvatar;
                msgSenderName = contactName;
              }

              const actionMenu = !msg.isRevoked && (
                <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity mx-2 relative ${clusterMessages.length > 1 ? 'self-end' : ''}`}>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (reactionTooltipId === messageId) {
                        setReactionTooltipId(null);
                      } else {
                        setReactionTooltipId(messageId);
                        setTooltipDirection(e.clientY < 250 ? 'down' : 'up');
                      }
                      setOpenMenuId(null); 
                    }}
                    className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                    title="Bày tỏ cảm xúc"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (openMenuId === messageId) {
                        setOpenMenuId(null);
                      } else {
                        setOpenMenuId(messageId);
                        setMenuDirection(e.clientY < 300 ? 'down' : 'up');
                      }
                      setReactionTooltipId(null); 
                    }}
                    className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {/* Reaction Tooltip */}
                  {reactionTooltipId === messageId && (
                    <div className={`absolute ${tooltipDirection === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'} ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 shadow-xl rounded-full p-1 z-[100] animate-bounce-in`}
                      style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
                      onClick={(e) => e.stopPropagation()}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji.type}
                          className="p-2 hover:scale-125 transition-all duration-200 rounded-full flex items-center justify-center"
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => handleReactMessage(messageId, emoji.type)}
                          title={emoji.type}
                        >
                          <span className="text-[22px] leading-none">{emoji.icon}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {openMenuId === messageId && (
                    <div className={`absolute ${menuDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} ${isMe ? 'right-0' : 'left-0'} w-36 bg-[var(--bg-panel)] border border-[var(--border-light)] shadow-lg rounded-lg py-1 z-50 text-sm`}
                      onClick={(e) => e.stopPropagation()}>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                        onClick={() => { setReplyingMessage(msg); setOpenMenuId(null); }}>
                        Trả lời
                      </button>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                        onClick={() => { setForwardingMessage(msg); setOpenMenuId(null); }}>
                        Chuyển tiếp
                      </button>
                      {(!msg.messageType || msg.messageType === 'text') && (msg.content || msg.text) && (
                        <button className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                          onClick={() => handleTranslate(msg)}
                          disabled={translatingId === messageId}
                        >
                          {translatingId === messageId ? 'Đang dịch...' : 'Dịch sang Tiếng Việt'}
                        </button>
                      )}
                      <button className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                        onClick={() => handleTogglePinMessage(msg)}>
                        {pinnedMessage?.messageId === messageId ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                      </button>
                      {isMe && (
                        <button className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-red-500"
                          onClick={() => handleRevoke(msg)}>
                          Thu hồi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );

              return (
                <div 
                  key={messageId || idx} 
                  id={messageId ? `message-${messageId}` : undefined}
                  className={highlightedMessageId === messageId ? 'animate-pulse-yellow' : ''}
                >
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <div className="text-[11px] py-1 px-4 rounded-full font-medium select-none"
                        style={{ background: 'var(--bg-date-separator)', color: 'var(--text-date-separator)' }}>
                        {getDateLabel(msgTime)}
                      </div>
                    </div>
                  )}

                  {/* Unread Messages Divider */}
                  {firstUnreadMessageId && messageId === firstUnreadMessageId && (
                    <div className="flex justify-center my-4">
                      <div className="text-[12px] py-1 px-4 rounded-full font-medium select-none bg-[rgba(255,59,48,0.1)] text-[#FF3B30] border border-[rgba(255,59,48,0.2)]">
                        {unreadCountToShow} tin nhắn chưa đọc
                      </div>
                    </div>
                  )}

                  {/* System Message */}
                  {msg.messageType === 'system' ? (
                    <div className="flex justify-center my-3">
                      <div className="text-[12px] py-1 px-4 rounded-full font-medium select-none bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                        {(() => {
                          const content = msg.content || msg.text || '';
                          const actor = isMe ? 'Bạn' : msgSenderName;
                          if (content === 'Nhóm đã được tạo') {
                            if (activeConversation.groupName) {
                              return `${actor} đã tạo nhóm "${activeConversation.groupName}"`;
                            } else {
                              return `${actor} đã tạo một nhóm mới`;
                            }
                          } else if (content === 'Đã thêm thành viên mới vào nhóm') {
                            return `${actor} đã thêm thành viên mới vào nhóm`;
                          } else if (content.startsWith('added_members:')) {
                            const addedIds = content.split(':')[1].split(',');
                            const names = addedIds.map((id: string) => id === user?.id?.toString() ? 'Bạn' : (memberMap[id]?.fullName || 'Thành viên')).join(', ');
                            return `${actor} đã thêm ${names} vào nhóm`;
                          } else if (content.startsWith('member_left:')) {
                            const leftId = content.split(':')[1];
                            const leftName = leftId === user?.id?.toString() ? 'Bạn' : (memberMap[leftId]?.fullName || 'Thành viên');
                            return `${leftName} đã rời khỏi nhóm`;
                          } else if (content.startsWith('member_removed:')) {
                            const parts = content.split(':');
                            const removerId = parts[1];
                            const removedId = parts[2];
                            const removerName = removerId === user?.id?.toString() ? 'Bạn' : (memberMap[removerId]?.fullName || 'Thành viên');
                            const removedName = removedId === user?.id?.toString() ? 'Bạn' : (memberMap[removedId]?.fullName || 'Thành viên');
                            return `${removerName} đã xóa ${removedName} ra khỏi nhóm`;
                          } else if (content.startsWith('group_disbanded:')) {
                            const disbanderId = content.split(':')[1];
                            const disbanderName = disbanderId === user?.id?.toString() ? 'Bạn' : (memberMap[disbanderId]?.fullName || 'Trưởng nhóm');
                            return `${disbanderName} đã giải tán nhóm`;
                          } else if (content.startsWith('role_deputy:')) {
                            const parts = content.split(':');
                            const actorName = parts[1] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[1]]?.fullName || 'Trưởng nhóm');
                            const targetName = parts[2] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[2]]?.fullName || 'Thành viên');
                            return `${actorName} đã đặt ${targetName} làm phó nhóm`;
                          } else if (content.startsWith('role_undeputy:')) {
                            const parts = content.split(':');
                            const actorName = parts[1] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[1]]?.fullName || 'Trưởng nhóm');
                            const targetName = parts[2] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[2]]?.fullName || 'Thành viên');
                            return `${actorName} đã gỡ phó nhóm của ${targetName}`;
                          } else if (content.startsWith('role_leader:')) {
                            const parts = content.split(':');
                            const actorName = parts[1] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[1]]?.fullName || 'Trưởng nhóm');
                            const targetName = parts[2] === user?.id?.toString() ? 'Bạn' : (memberMap[parts[2]]?.fullName || 'Thành viên');
                            return `${actorName} đã đặt ${targetName} làm trưởng nhóm`;
                          } else if (content.startsWith('group_updated:')) {
                            const parts = content.split(':');
                            const actorId = parts[1];
                            const updatesString = parts[2] || '';
                            const actorName = actorId === user?.id?.toString() ? 'Bạn' : (memberMap[actorId]?.fullName || 'Thành viên');

                            // Parse special formatting for name
                            if (updatesString.includes('tên nhóm|')) {
                              const newName = updatesString.split('tên nhóm|')[1].split(',')[0];
                              return `${actorName} đã đổi tên đoạn chat thành "${newName}"`;
                            }
                            return `${actorName} đã thay đổi ${updatesString}`;
                          } else if (content.startsWith('member_joined_via_link:')) {
                            const joinedId = content.split(':')[1];
                            const joinedName = joinedId === user?.id?.toString() ? 'Bạn' : (memberMap[joinedId]?.fullName || 'Thành viên');
                            return `${joinedName} đã tham gia nhóm qua link mời`;
                          }
                          return content;
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* Message Bubble container */
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isLastInCluster ? 'mb-4' : 'mb-1'} group relative`}>

                      {/* Received: Avatar */}
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-auto mb-0.5 flex items-center justify-center font-bold text-xs text-white overflow-hidden"
                          style={{
                            background: isAiConversation
                              ? 'linear-gradient(135deg, #f97316, #ea580c)'
                              : (msgSenderAvatar ? 'transparent' : '#0068FF'),
                            visibility: isLastInCluster ? 'visible' : 'hidden'
                          }}
                          title={msgSenderName}
                        >
                          {isAiConversation ? (
                            <span className="text-base">🍜</span>
                          ) : msgSenderAvatar ? (
                            <img src={msgSenderAvatar} alt={msgSenderName} className="w-full h-full object-cover" />
                          ) : (
                            msgSenderName.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}

                      {/* Actions Menu Left (if isMe) */}
                      {isMe && actionMenu}

                      <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender Name in Group Chat (show above bubble) */}
                        {!isMe && activeConversation.isGroup && isFirstInCluster && !msg.isRevoked && (
                          <div className="flex items-center gap-2 mb-1 ml-1">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                              {msgSenderName}
                            </span>
                            {(() => {
                              const participant = activeConversation.participants?.find(
                                (p: any) => String(p.userId || p.id || p) === String(msg.senderId)
                              );
                              const role = (participant as any)?.role;
                              if (role === 'leader') {
                                return (
                                  <span className="text-[9px] px-1 rounded bg-[#fff7ed] text-[#f59e0b] font-bold border border-[#f59e0b40] uppercase">
                                    Trưởng nhóm
                                  </span>
                                );
                              }
                              if (role === 'deputy') {
                                return (
                                  <span className="text-[9px] px-1 rounded bg-[#f0fdf4] text-[#10b981] font-bold border border-[#10b98140] uppercase">
                                    Phó nhóm
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}

                        {msg.isRevoked ? (
                          <div className="px-3 py-[7px] rounded-2xl border border-[var(--border-light)] text-[15px] italic text-[var(--text-secondary)] bg-transparent opacity-70">
                            Tin nhắn đã bị thu hồi
                          </div>
                        ) : (
                          <>
                            {/* Reply Block (shared for all types) */}
                            {msg.replyTo && (
                              <div className="text-xs p-1.5 mb-1 border-l-[3px] rounded opacity-90 max-w-full truncate"
                                style={{ borderColor: '#0068FF', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                                <span className="font-semibold">{msg.replyTo.senderId === user?.id?.toString() ? 'Bạn' : (activeConversation.isGroup ? (memberMap[msg.replyTo.senderId]?.fullName || 'Thành viên') : contactName)}</span>
                                <br />
                                <span className="opacity-80">
                                  {msg.replyTo.messageType === 'sticker' ? '[Nhãn dán]' :
                                    msg.replyTo.messageType === 'image' ? '[Hình ảnh]' :
                                      msg.replyTo.messageType === 'video' ? '[Video]' :
                                        msg.replyTo.messageType === 'audio' ? '[Tin nhắn thoại]' :
                                          msg.replyTo.messageType === 'contact' ? '[Danh thiếp]' :
                                            msg.replyTo.messageType === 'file' ? '[Tệp]' :
                                              msg.replyTo.content}
                                </span>
                              </div>
                            )}

                            {/* Sticker */}
                            {msg.messageType === 'sticker' && msg.fileUrl ? (
                              <div className="relative group/sticker flex flex-col">
                                <img
                                  src={msg.fileUrl}
                                  alt="Sticker"
                                  className="w-32 h-32 object-contain drop-shadow-md"
                                />
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-0.5 select-none whitespace-nowrap bg-black/30 text-white backdrop-blur-sm opacity-0 group-hover/sticker:opacity-100 transition-opacity">
                                  {format(msgTime, 'HH:mm')}
                                  {isMe && (
                                    <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </span>
                                {renderReactions(msg)}
                              </div>

                              /* Image */
                            ) : msg.messageType === 'image' && msg.fileUrl ? (
                              clusterMessages.length > 1 ? (
                                <div className={`grid gap-1 max-w-[280px] w-[280px] ${clusterMessages.length >= 2 ? 'grid-cols-2' : ''}`}
                                  style={{
                                    gridTemplateRows: clusterMessages.length === 3 ? 'repeat(2, 140px)' : 'auto',
                                    gridAutoRows: '140px'
                                  }}>
                                  {clusterMessages.map((cMsg, cIdx) => {
                                    const cTime = cMsg.createdAt ? new Date(cMsg.createdAt) : (cMsg.timestamp ? new Date(cMsg.timestamp) : new Date());
                                    return (
                                      <div key={cMsg._id || cMsg.id || cIdx} className={`relative group/cmsg w-full h-full ${cIdx === 2 && clusterMessages.length === 3 ? 'col-span-2' : ''}`}>
                                        {renderImageMessage(cMsg, isMe, cTime, true, isLastInCluster)}
                                        {renderReactions(cMsg)}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="relative">
                                  {renderImageMessage(msg, isMe, msgTime, false, isLastInCluster)}
                                  {renderReactions(msg)}
                                </div>
                              )

                              /* Video */
                            ) : msg.messageType === 'video' && msg.fileUrl ? (
                              <div className="relative">
                                {renderVideoMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* File */
                            ) : msg.messageType === 'file' && msg.fileUrl ? (
                              <div className="relative">
                                {renderFileMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* Audio */
                            ) : msg.messageType === 'audio' && msg.fileUrl ? (
                              <div className="relative">
                                {renderAudioMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* Contact */
                            ) : msg.messageType === 'contact' ? (
                              <div className="relative">
                                {renderContactMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* Location */
                            ) : msg.messageType === 'location' ? (
                              <div className="relative">
                                {renderLocationMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* Reminder */
                            ) : msg.messageType === 'reminder' ? (
                              <div className="relative">
                                {renderReminderMessage(msg, isMe, msgTime, isLastInCluster)}
                                {renderReactions(msg)}
                              </div>

                              /* Group Call */
                            ) : msg.messageType === 'group_call' ? (
                              (() => {
                                const isCallEnded = messages.some(
                                  m => m.messageType === 'system' && 
                                  (m.content === 'Cuộc gọi nhóm đã kết thúc' || m.content === '📞 Cuộc gọi nhóm đã kết thúc') && 
                                  new Date(m.createdAt || m.timestamp || 0).getTime() > msgTime.getTime()
                                );
                                
                                return (
                                  <div
                                    className="flex flex-col gap-2.5 px-3 py-3 min-w-[200px] max-w-[250px] shadow-sm relative"
                                    style={{
                                      background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-panel)',
                                      border: isMe ? 'none' : '1px solid var(--border-light)',
                                      borderRadius: bubbleR.normal,
                                      borderBottomRightRadius: isMe ? bubbleR.corner : undefined,
                                      borderBottomLeftRadius: !isMe ? bubbleR.corner : undefined,
                                    }}
                                  >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#E5F0FF] text-[#0068FF]">
                                    {msg.content === 'video' ? <Video size={20} fill="currentColor" stroke="currentColor" /> : <Phone size={20} fill="currentColor" stroke="currentColor" />}
                                  </div>
                                  <span className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>
                                    Cuộc gọi nhóm
                                  </span>
                                </div>
                                <button
                                  className={`w-full py-2 rounded-2xl font-medium transition-opacity ${isCallEnded ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#0068FF] text-white hover:opacity-90 active:scale-[0.98]'}`}
                                  style={{ fontSize: '14px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isCallEnded) {
                                      setShowEndedCallPopup(true);
                                      return;
                                    }
                                    const conversationId = msg.conversationId || activeConversation?.conversationId;
                                    if (conversationId) {
                                      import('../../stores/groupCallStore').then(m => {
                                        const currentUser = useAuthStore.getState().user;
                                        m.useGroupCallStore.getState().setOutgoingCall(conversationId, String(currentUser?.id || currentUser?._id), msg.content === 'video');
                                      });
                                      socket.emit('group_call_join', { conversationId });
                                    }
                                  }}
                                >
                                  {isCallEnded ? 'Đã kết thúc' : 'Tham gia'}
                                </button>
                                {/* Time overlay */}
                                <span className="text-[11px] self-end flex items-center gap-0.5 select-none whitespace-nowrap flex-shrink-0"
                                  style={{ color: '#6b7b8d', marginTop: '-2px' }}>
                                  {format(msgTime, 'HH:mm')}
                                  {isMe && (
                                    <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                                      stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </span>
                                {renderReactions(msg)}
                                  </div>
                                );
                              })()

                              /* Poll */
                            ) : msg.messageType === 'poll' ? (
                              <div className="relative">
                                {renderPollMessage(msg, isMe, msgTime)}
                              </div>

                              /* Text (default) */
                            ) : (
                              <div className="flex flex-col">
                                <div className={`px-3 py-[7px] relative text-[15px] leading-relaxed transition-shadow duration-150 hover:shadow-sm ${isAiConversation && !isMe ? 'ai-markdown-bubble' : ''}`}
                                  style={{
                                    background: settings.bubbleStyle === 'minimal'
                                      ? 'transparent'
                                      : (isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)'),
                                    color: 'var(--text-primary)',
                                    borderRadius: isLastInCluster
                                      ? (isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px')
                                      : '18px',
                                    boxShadow: !isMe && settings.bubbleStyle !== 'minimal' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                    border: settings.bubbleStyle === 'minimal'
                                      ? '1px solid var(--border-primary)'
                                      : undefined,
                                  }}>


                                  <div className={isAiConversation && !isMe ? '' : 'pr-12'}>
                                    {isAiConversation && !isMe ? (
                                      /* AI Message — Markdown rendering */
                                      <div className="ai-markdown-content" style={{ wordBreak: 'break-word' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                          {msg.content || msg.text || ''}
                                        </ReactMarkdown>
                                      </div>
                                    ) : (
                                      /* Regular Message — plain text with links */
                                      <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.content || msg.text || '', activeConversation.isGroup ? memberMap : undefined, handlePressMention)}</div>
                                    )}
                                    {translatedMessages[messageId] && (
                                      <div className="mt-1.5 pt-1.5 text-[0.9em] italic opacity-90" style={{ borderTop: '1px dashed currentColor' }}>
                                        {translatedMessages[messageId]}
                                      </div>
                                    )}
                                  </div>
                                  {settings.showMessageTime && (
                                    <span className={`${isAiConversation && !isMe ? 'mt-1 flex' : 'absolute bottom-1.5 right-2.5 flex'} text-[11px] items-center gap-0.5 select-none whitespace-nowrap justify-end`}
                                      style={{ color: '#6b7b8d' }}>
                                      {format(msgTime, 'HH:mm')}
                                      {isMe && (
                                        <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                                          stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                      )}
                                    </span>
                                  )}
                                  {renderReactions(msg)}
                                </div>

                                {/* AI Action Bar — Copy / Regenerate */}
                                {isAiConversation && !isMe && !isAiStreaming && (
                                  <div className="flex items-center gap-1 mt-1 ml-1 animate-fadeIn">
                                    <button
                                      onClick={() => handleCopyAiMessage(messageId, msg.content || msg.text || '')}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-105"
                                      style={{
                                        color: copiedMsgId === messageId ? '#10b981' : 'var(--text-secondary)',
                                        background: copiedMsgId === messageId ? 'rgba(16,185,129,0.1)' : 'transparent',
                                      }}
                                      onMouseEnter={(e) => { if (copiedMsgId !== messageId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                      onMouseLeave={(e) => { if (copiedMsgId !== messageId) e.currentTarget.style.background = 'transparent'; }}
                                      title="Sao chép"
                                    >
                                      {copiedMsgId === messageId ? <><Check size={13} /> Đã sao chép</> : <><Copy size={13} /> Sao chép</>}
                                    </button>
                                    <button
                                      onClick={() => handleRegenerateAi(messageId)}
                                      disabled={!!regeneratingId}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                      style={{ color: 'var(--text-secondary)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                      title="Thử lại"
                                    >
                                      <RefreshCw size={13} className={regeneratingId === messageId ? 'animate-spin' : ''} /> Thử lại
                                    </button>
                                    <button
                                      onClick={() => handleReadAloud(messageId, msg.content || msg.text || '')}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-105"
                                      style={{
                                        color: readingMsgId === messageId ? '#0068FF' : 'var(--text-secondary)',
                                        background: readingMsgId === messageId ? 'rgba(0,104,255,0.1)' : 'transparent',
                                      }}
                                      onMouseEnter={(e) => { if (readingMsgId !== messageId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                      onMouseLeave={(e) => { if (readingMsgId !== messageId) e.currentTarget.style.background = 'transparent'; }}
                                      title={readingMsgId === messageId ? "Dừng đọc" : "Đọc văn bản"}
                                    >
                                      {readingMsgId === messageId ? <><VolumeX size={13} /> Dừng đọc</> : <><Volume2 size={13} /> Đọc thành tiếng</>}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Actions Menu Right (if !isMe) */}
                      {!isMe && actionMenu}

                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI Streaming Bubble */}
          {isAiConversation && isAiStreaming && (
            <div className="w-full animate-fadeIn">
              <div className="flex justify-start mb-0.5 group relative">
                <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-auto mb-0.5 flex items-center justify-center text-base text-white"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                  🍜
                </div>
                <div className="max-w-[70%]">
                  <div className="px-3 py-[7px] text-[15px] leading-relaxed ai-markdown-bubble"
                    style={{
                      background: 'var(--bg-msg-received)',
                      color: 'var(--text-primary)',
                      borderRadius: '4px 18px 18px 18px',
                      wordBreak: 'break-word',
                    }}>
                    {aiStreamingText ? (
                      <div className="ai-markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {aiStreamingText}
                        </ReactMarkdown>
                        <span className="inline-block w-[2px] h-[1em] ml-[2px] align-text-bottom" style={{ background: '#f97316', animation: 'blink 1s step-end infinite' }} />
                      </div>
                    ) : (
                      /* Bouncing dots typing indicator */
                      <div className="flex items-center gap-1.5 py-1.5 px-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: '#f97316', animation: 'aiBounce 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                        <span className="w-2 h-2 rounded-full" style={{ background: '#f97316', animation: 'aiBounce 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                        <span className="w-2 h-2 rounded-full" style={{ background: '#f97316', animation: 'aiBounce 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-4" />

          {/* Nút Mentions nổi */}
          {unreadMentionMessageId && (
            <button
              onClick={scrollToMention}
              className="fixed right-8 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 z-50 text-[#0068FF] font-bold text-lg"
              style={{
                bottom: showScrollToBottom ? '112px' : '72px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}
              title="Đi đến tin nhắn nhắc đến bạn"
            >
              @
            </button>
          )}

          {/* Scroll to bottom button (Zalo style) */}
          {showScrollToBottom && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-28 right-8 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 z-50"
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}
              title="Cuộn xuống cuối"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}

          <style>{`
            @keyframes pulse-yellow {
              0% { background-color: rgba(255, 235, 59, 0.6); }
              100% { background-color: transparent; }
            }
            .animate-pulse-yellow {
              animation: pulse-yellow 2s ease-out;
              border-radius: 8px;
            }
            @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
            @keyframes aiBounce {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
            .ai-markdown-content > *:first-child { margin-top: 0; }
            .ai-markdown-content > *:last-child { margin-bottom: 0; }
          `}</style>
        </div>

        {/* Image Lightbox - rendered via Portal to escape stacking context */}
        {lightboxUrl && createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer"
            style={{ zIndex: 99999 }}
            onClick={() => setLightboxUrl(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-6 left-6 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Đóng"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              style={{ animation: 'fadeIn 0.2s ease-out' }}
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={lightboxUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-6 right-6 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Tải xuống"
            >
              <Download size={22} />
            </a>
          </div>,
          document.body
        )}

        {/* Profile Modal */}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={activeProfile}
        />
        {editingPoll && createPortal(
          <CreatePollModal
            isOpen={editingPoll.isOpen}
            onClose={() => setEditingPoll(null)}
            conversationId={activeConversation.conversationId}
            initialData={editingPoll.initialData}
            messageId={editingPoll.msgId}
          />,
          document.body
        )}
        {/* AI Summarize Modal */}
        <SummarizeModal
          isOpen={isSummarizeModalOpen}
          onClose={() => setIsSummarizeModalOpen(false)}
          messages={messages}
          memberMap={memberMap}
          unreadCount={localUnreadCount}
        />
      </div>
    </>
  );
};

export default MessageList;