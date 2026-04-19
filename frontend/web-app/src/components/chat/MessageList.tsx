import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal, Download, FileText, Loader2, AlertCircle, Pin } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { fetchAiMessages } from '../../services/aiChat.service';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { socket } from '../../services/socket';
import { contactService } from '../../services/contactService';
import ProfileModal from '../ProfileModal';

const BUBBLE_RADIUS = {
  modern: { normal: '18px', corner: '6px' },
  classic: { normal: '8px', corner: '3px' },
  minimal: { normal: '4px', corner: '2px' },
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const { activeConversation, messages, setMessages, setReplyingMessage, setForwardingMessage, updateMessage, activeContactInfo, pinnedMessage, setPinnedMessage } = useChatStore();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  // AI streaming state (must be before any early return)
  const isAiStreaming = useChatStore((s) => s.isAiStreaming);
  const aiStreamingText = useChatStore((s) => s.aiStreamingText);
  const bubbleR = BUBBLE_RADIUS[settings.bubbleStyle] || BUBBLE_RADIUS.modern;

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
          } else if (res.data && Array.isArray(res.data)) {
            setMessages(res.data);
            setPinnedMessage((res as any).data.pinnedMessage || null);
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
      setPinnedMessage(null);
    }
  }, [activeConversation, user, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Socket listener for revoke
  useEffect(() => {
    const handleRevoked = (data: any) => {
      if (data.messageId) {
        updateMessage(data.messageId, { isRevoked: true });
      }
    };
    socket.on('message_revoked', handleRevoked);
    return () => {
      socket.off('message_revoked', handleRevoked);
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
  const isAiConversation = activeConversation.conversationId.startsWith('ai_');
  const contact = activeConversation.participants?.[0];
  const contactAvatar = isAiConversation ? undefined : (activeContactInfo?.avatarUrl || contact?.avatarUrl);
  const contactName = isAiConversation ? 'Bếp AI 🍜' : (activeContactInfo?.name || contact?.fullName || '?');

  // Render image message
  const renderImageMessage = (msg: any, isMe: boolean, msgTime: Date, isInGrid: boolean = false) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;

    return (
      <div className={`relative group/media overflow-hidden cursor-pointer ${isInGrid ? 'w-full h-full rounded-md' : 'rounded-xl max-w-[280px]'}`}
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
  const renderVideoMessage = (msg: any, isMe: boolean, msgTime: Date) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;

    return (
      <div className="relative group/media rounded-xl overflow-hidden max-w-[320px]">
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
  const renderAudioMessage = (msg: any, isMe: boolean, msgTime: Date) => {
    const isUploading = (msg as any)._uploading;

    return (
      <div className="relative group/media rounded-xl p-2 max-w-[320px]"
        style={{ background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)' }}>
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
  const renderFileMessage = (msg: any, isMe: boolean, msgTime: Date) => {
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
          borderRadius: bubbleR.normal,
          borderBottomRightRadius: isMe ? bubbleR.corner : undefined,
          borderBottomLeftRadius: !isMe ? bubbleR.corner : undefined,
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
  const renderContactMessage = (msg: any, isMe: boolean, msgTime: Date) => {
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
          borderRadius: bubbleR.normal,
          borderBottomRightRadius: isMe ? bubbleR.corner : undefined,
          borderBottomLeftRadius: !isMe ? bubbleR.corner : undefined,
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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 relative" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        {pinnedMessage && (
          <div className="sticky top-0 z-40 bg-[var(--bg-panel)] shadow-sm border border-[var(--border-light)] rounded-lg p-2.5 flex items-center justify-between mb-3 w-full opacity-95">
            <div className="flex items-center gap-3 overflow-hidden">
               <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Pin size={16} className="text-blue-600" />
               </div>
               <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Tin nhắn ghim</span>
                  <span className="text-sm truncate text-[var(--text-secondary)]">
                    {pinnedMessage.messageType === 'image' ? '[Hình ảnh]' :
                     pinnedMessage.messageType === 'video' ? '[Video]' :
                     pinnedMessage.messageType === 'audio' ? '[Tin nhắn thoại]' :
                     pinnedMessage.messageType === 'file' ? '[Tệp]' :
                     pinnedMessage.messageType === 'sticker' ? '[Nhãn dán]' :
                     pinnedMessage.messageType === 'contact' ? '[Danh thiếp]' :
                     pinnedMessage.content}
                  </span>
               </div>
            </div>
            <button className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                onClick={() => {
                   if (user) {
                      socket.emit('unpin_message', { conversationId: activeConversation?.conversationId, userId: user.id.toString() });
                   }
                }}
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                 <line x1="18" y1="6" x2="6" y2="18"></line>
                 <line x1="6" y1="6" x2="18" y2="18"></line>
               </svg>
            </button>
          </div>
        )}
        <div className="w-full space-y-1">
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.id?.toString();
            const msgTime = msg.createdAt ? new Date(msg.createdAt) : (msg.timestamp ? new Date(msg.timestamp) : new Date());
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const prevTime = prevMsg
              ? (prevMsg.createdAt ? new Date(prevMsg.createdAt) : (prevMsg.timestamp ? new Date(prevMsg.timestamp) : null))
              : null;

            // Show date separator if different day
            const showDateSeparator = idx === 0 || (prevTime && !isSameDay(msgTime, prevTime));

            // Check if this is an image inside a cluster
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

            const actionMenu = !msg.isRevoked && (
              <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity mx-2 relative ${clusterMessages.length > 1 ? 'self-end' : ''}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === messageId ? null : messageId); }}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                >
                  <MoreHorizontal size={18} />
                </button>
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

                {/* Message Bubble container */}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 group relative`}>
                  
                  {/* Received: Avatar */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-auto mb-0.5 flex items-center justify-center font-bold text-xs text-white overflow-hidden"
                      style={{
                        background: isAiConversation
                          ? 'linear-gradient(135deg, #f97316, #ea580c)'
                          : (contactAvatar ? 'transparent' : '#0068FF')
                      }}>
                      {isAiConversation ? (
                        <span className="text-base">🍜</span>
                      ) : contactAvatar ? (
                        <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                      ) : (
                        contactName.charAt(0).toUpperCase()
                      )}
                    </div>
                  )}

                  {/* Actions Menu Left (if isMe) */}
                  {isMe && actionMenu}

                  <div className={`max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
                            <span className="font-semibold">{msg.replyTo.senderId === user?.id?.toString() ? 'Bạn' : contactName}</span>
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
                                      {renderImageMessage(cMsg, isMe, cTime, true)}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : renderImageMessage(msg, isMe, msgTime, false)

                        /* Video */
                        ) : msg.messageType === 'video' && msg.fileUrl ? (
                          renderVideoMessage(msg, isMe, msgTime)

                        /* File */
                        ) : msg.messageType === 'file' && msg.fileUrl ? (
                          renderFileMessage(msg, isMe, msgTime)

                        /* Audio */
                        ) : msg.messageType === 'audio' && msg.fileUrl ? (
                          renderAudioMessage(msg, isMe, msgTime)

                        /* Contact */
                        ) : msg.messageType === 'contact' ? (
                          renderContactMessage(msg, isMe, msgTime)

                        /* Text (default) */
                        ) : (
                          <div className="px-3 py-[7px] relative text-[15px] leading-relaxed transition-shadow duration-150 hover:shadow-md"
                            style={{
                              background: settings.bubbleStyle === 'minimal'
                                ? 'transparent'
                                : (isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)'),
                              color: 'var(--text-primary)',
                              borderRadius: bubbleR.normal,
                              borderBottomRightRadius: isMe ? bubbleR.corner : undefined,
                              borderBottomLeftRadius: !isMe ? bubbleR.corner : undefined,
                              border: settings.bubbleStyle === 'minimal'
                                ? '1px solid var(--border-primary)'
                                : 'none',
                            }}>

                            <div className="pr-12">
                              <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content || msg.text}</div>
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
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions Menu Right (if !isMe) */}
                  {!isMe && actionMenu}

                </div>
              </div>
            );
          })}
        </div>

        {/* AI Streaming Bubble */}
        {isAiConversation && isAiStreaming && (
          <div className="w-full">
            <div className="flex justify-start mb-0.5 group relative">
              <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-auto mb-0.5 flex items-center justify-center text-base text-white"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                🍜
              </div>
              <div className="max-w-[60%]">
                <div className="px-3 py-[7px] text-[15px] leading-relaxed"
                  style={{
                    background: 'var(--bg-msg-received)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px 18px 18px 18px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                  {aiStreamingText || ''}
                  <span className="inline-block w-[2px] h-[1em] ml-[2px] align-text-bottom" style={{ background: '#f97316', animation: 'blink 1s step-end infinite' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />

        <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
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
    </>
  );
};

export default MessageList;
