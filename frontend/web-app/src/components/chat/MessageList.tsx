import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal, Download, FileText, Loader2, AlertCircle, Video, Phone, Smile, BarChart2, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { socket } from '../../services/socket';
import { contactService } from '../../services/contactService';
import ProfileModal from '../ProfileModal';
import CreatePollModal from './CreatePollModal';

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

const renderTextWithLinks = (text: string) => {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex after test
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: '#4A90D9',
            textDecoration: 'underline',
            wordBreak: 'break-all',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLAnchorElement).style.color = '#2B6CB0';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLAnchorElement).style.color = '#4A90D9';
          }}
        >
          {part}
        </a>
      );
    }
    // Reset regex lastIndex
    URL_REGEX.lastIndex = 0;
    return part;
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

const MessageList = () => {
  const [editingPoll, setEditingPoll] = useState<{ isOpen: boolean, msgId: string, initialData?: any } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { activeConversation, messages, setMessages, setReplyingMessage, setForwardingMessage, updateMessage, activeContactInfo } = useChatStore();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string; }>>({});
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [unreadCountToShow, setUnreadCountToShow] = useState<number>(0);
  const [reactionTooltipId, setReactionTooltipId] = useState<string | null>(null);
  const bubbleR = BUBBLE_RADIUS[settings.bubbleStyle] || BUBBLE_RADIUS.modern;

  useEffect(() => {
    // Reset when switching conversations
    setFirstUnreadMessageId(null);
    setUnreadCountToShow(0);
  }, [activeConversation?.conversationId]);

  useEffect(() => {
    if (!activeConversation || !user?.id) return;
    const fetchHistory = async () => {
      try {
        const res = await getConversationHistory(activeConversation.conversationId, user.id.toString());
        const history = res.data?.data || res.data || [];
        if (Array.isArray(history)) {
          setMessages(history);
          
          // Identify the first unread message anchor
          const unreadCount = activeConversation.unreadCount || 0;
          if (unreadCount > 0 && history.length > 0) {
            const index = Math.max(0, history.length - unreadCount);
            setFirstUnreadMessageId(history[index]?._id || history[index]?.id || null);
            setUnreadCountToShow(unreadCount);
          }
        }
      } catch (err) {
        console.error('Error fetching messages', err);
      }
    };
    if (!activeConversation.conversationId.startsWith('new_') && !activeConversation.conversationId.startsWith('contact_')) {
      fetchHistory();
    } else {
      setMessages([]);
    }
  }, [activeConversation, user, setMessages]);

  useEffect(() => {
    if (!activeConversation?.isGroup) return;
    const fetchMembers = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      const { default: api } = await import('../../services/axios');
      
      // Collect IDs from current participants
      const allIds = new Set<string>();
      for (const p of (activeConversation.participants || [])) {
        const uid = String(p.userId || p.contactUserId || p.id || p);
        if (uid && uid !== user?.id?.toString()) allIds.add(uid);
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
      
      // Remove own ID
      allIds.delete(user?.id?.toString() || '');
      
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

  // Socket listener for revoke and reaction
  useEffect(() => {
    const handleRevoked = (data: any) => {
      if (data.messageId) {
        updateMessage(data.messageId, { isRevoked: true });
      }
    };
    const handleReacted = (data: any) => {
        if (data.messageId) {
            updateMessage(data.messageId, { 
                reactions: data.reactions,
                content: data.content // This is important for real-time poll updates
            });
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

  // Get contact info for received messages (default for private chats)
  const contact = activeConversation?.participants?.find((p: any) => p.userId !== user?.id?.toString() && p.id !== user?.id?.toString()) || activeConversation?.participants?.[0];
  const defaultContactAvatar = activeContactInfo?.avatarUrl || contact?.avatarUrl;
  const defaultContactName = activeContactInfo?.name || contact?.nickname || contact?.fullName || '?';

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
          <span className="text-[10px] flex items-center gap-0.5 select-none"
             style={{ color: 'var(--text-msg-time)' }}>
            {format(msgTime, 'HH:mm')}
            {isMe && (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <span className="text-[10px] self-end flex items-center gap-0.5 select-none whitespace-nowrap flex-shrink-0"
          style={{ color: 'var(--text-msg-time)' }}>
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

  // Render contact message
  const renderContactMessage = (msg: any, isMe: boolean, msgTime: Date, isLastInCluster: boolean = true) => {
    let parsedContact: any = null;
    try {
      parsedContact = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
    } catch {
      parsedContact = {};
    }

    const { fullName, nickname, avatarUrl, phone, contactUserId, id } = parsedContact || {};
    const displayName = nickname || fullName || 'Người dùng';
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
          <span className="text-[10px] flex items-center gap-0.5 select-none"
             style={{ color: 'var(--text-msg-time)' }}>
            {format(msgTime, 'HH:mm')}
            {isMe && (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </span>
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
                  className={`w-full text-left p-2.5 rounded-xl border transition-all relative overflow-hidden flex items-center justify-between ${
                    hasVoted ? 'border-[#0068FF] bg-[#0068FF]/5' : 'border-[var(--border-primary)] hover:border-[#0068FF]/50'
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
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        <div className="w-full space-y-1">
          {messages.map((msg, idx) => {
            const currentUserId = user?._id?.toString() || user?.id?.toString();
            const isMe = String(msg.senderId) === currentUserId;
            const msgTime = msg.createdAt ? new Date(msg.createdAt) : (msg.timestamp ? new Date(msg.timestamp) : new Date());
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
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
               while(fwdIdx < messages.length) {
                  const fwdMsg = messages[fwdIdx];
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
            }

            const actionMenu = !msg.isRevoked && (
              <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity mx-2 relative ${clusterMessages.length > 1 ? 'self-end' : ''}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setReactionTooltipId(reactionTooltipId === messageId ? null : messageId); setOpenMenuId(null); }}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  title="Bày tỏ cảm xúc"
                >
                  <Smile size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === messageId ? null : messageId); setReactionTooltipId(null); }}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                >
                  <MoreHorizontal size={18} />
                </button>

                {/* Reaction Tooltip */}
                {reactionTooltipId === messageId && (
                  <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white border border-[#e6e8eb] shadow-xl rounded-full p-1 z-[100] animate-bounce-in`}
                    onClick={(e) => e.stopPropagation()}>
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji.type}
                        className="p-2 hover:scale-125 transition-all duration-200 rounded-full hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => handleReactMessage(messageId, emoji.type)}
                        title={emoji.type}
                      >
                        <span className="text-[22px] leading-none">{emoji.icon}</span>
                      </button>
                    ))}
                  </div>
                )}

                {openMenuId === messageId && (
                  <div className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} w-36 bg-[var(--bg-panel)] border border-[var(--border-light)] shadow-lg rounded-lg py-1 z-50 text-sm`}
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
              <div key={messageId || idx}>
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
                        background: msgSenderAvatar ? 'transparent' : '#0068FF',
                        visibility: isLastInCluster ? 'visible' : 'hidden'
                      }}
                      title={msgSenderName}
                    >
                      {msgSenderAvatar ? (
                        <img src={msgSenderAvatar} alt={msgSenderName} className="w-full h-full object-cover" />
                      ) : (
                        msgSenderName.charAt(0).toUpperCase()
                      )}
                    </div>
                  )}

                  {/* Actions Menu Left (if isMe) */}
                  {isMe && actionMenu}

                  <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender Name in Group Chat */}
                    {!isMe && activeConversation.isGroup && isFirstInCluster && (
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
                            <span className="font-semibold">{msg.replyTo.senderId === user?.id?.toString() ? 'Bạn' : (activeConversation.isGroup ? (memberMap[msg.replyTo.senderId]?.fullName || 'Thành viên') : defaultContactName)}</span>
                            <br/>
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

                        /* Group Call */
                        ) : msg.messageType === 'group_call' ? (
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
                              className="w-full py-2 rounded-2xl font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                              style={{ background: '#0068FF', fontSize: '14px' }}
                              onClick={(e) => {
                                e.stopPropagation();
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
                              Tham gia
                            </button>
                            {/* Time overlay */}
                            <span className="text-[10px] self-end flex items-center gap-0.5 select-none whitespace-nowrap flex-shrink-0"
                              style={{ color: 'var(--text-msg-time)', marginTop: '-2px' }}>
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

                        /* Poll */
                        ) : msg.messageType === 'poll' ? (
                          <div className="relative">
                            {renderPollMessage(msg, isMe, msgTime)}
                          </div>

                        /* Text (default) */
                        ) : (
                          <div className="px-3 py-[7px] relative text-[15px] leading-relaxed transition-shadow duration-150 hover:shadow-sm"
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

                            <div className="pr-12">
                              <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.content || msg.text || '')}</div>
                              {translatedMessages[messageId] && (
                                <div className="mt-1.5 pt-1.5 text-[0.9em] italic opacity-90" style={{ borderTop: '1px dashed currentColor' }}>
                                  {translatedMessages[messageId]}
                                </div>
                              )}
                            </div>
                            {settings.showMessageTime && (
                              <span className="absolute bottom-1.5 right-2.5 text-[10px] flex items-center gap-0.5 select-none whitespace-nowrap opacity-70"
                                style={{ color: isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-msg-time)' }}>
                                {format(msgTime, 'HH:mm')}
                                {isMe && (
                                  <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </span>
                            )}
                            {renderReactions(msg)}
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
        <div ref={bottomRef} className="h-4" />
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
    </>
  );
};

export default MessageList;
