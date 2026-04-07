import { useRef, useEffect, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { socket } from '../../services/socket';

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
  const { activeConversation, messages, setMessages, setReplyingMessage, setForwardingMessage, updateMessage, activeContactInfo } = useChatStore();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const bubbleR = BUBBLE_RADIUS[settings.bubbleStyle] || BUBBLE_RADIUS.modern;

  useEffect(() => {
    if (!activeConversation) return;
    const fetchHistory = async () => {
      try {
        const res = await getConversationHistory(activeConversation.conversationId);
        if (res.data && Array.isArray(res.data.data)) setMessages(res.data.data);
        else if (res.data && Array.isArray(res.data)) setMessages(res.data);
      } catch (err) {
        console.error('Error fetching messages', err);
      }
    };
    if (!activeConversation.conversationId.startsWith('new_') && !activeConversation.conversationId.startsWith('contact_')) {
      fetchHistory();
    } else {
      setMessages([]);
    }
  }, [activeConversation, setMessages]);

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
  const contact = activeConversation.participants?.[0];
  const contactAvatar = activeContactInfo?.avatarUrl || contact?.avatarUrl;
  const contactName = activeContactInfo?.name || contact?.nickname || contact?.fullName || '?';

  // Render image message
  const renderImageMessage = (msg: any, isMe: boolean, msgTime: Date) => {
    const isUploading = (msg as any)._uploading;
    const isFailed = (msg as any)._uploadFailed;

    return (
      <div className="relative group/media rounded-xl overflow-hidden cursor-pointer max-w-[280px]"
        onClick={() => !isUploading && msg.fileUrl && setLightboxUrl(msg.fileUrl)}
      >
        <img
          src={msg.fileUrl}
          alt="Hình ảnh"
          className={`w-full max-h-[300px] object-cover rounded-xl transition-all ${isUploading ? 'opacity-50 blur-[1px]' : 'hover:brightness-95'}`}
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
            className="w-full max-h-[300px] rounded-xl"
            style={{ background: '#000' }}
          />
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

  // Render file message
  const renderFileMessage = (msg: any, isMe: boolean, msgTime: Date) => {
    const isUploading = (msg as any)._uploading;
    const fileName = (msg as any).fileName || msg.content || msg.text || 'File';
    const fileSize = (msg as any).fileSize;
    const ext = msg.fileUrl ? getFileExtension(msg.fileUrl) : '';

    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl max-w-[320px] transition-shadow hover:shadow-md cursor-pointer"
        style={{
          background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)',
          borderRadius: bubbleR.normal,
          borderBottomRightRadius: isMe ? bubbleR.corner : undefined,
          borderBottomLeftRadius: !isMe ? bubbleR.corner : undefined,
        }}
        onClick={() => {
          if (!isUploading && msg.fileUrl) {
            window.open(msg.fileUrl, '_blank');
          }
        }}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,104,255,0.1)' }}
        >
          {isUploading ? (
            <Loader2 size={20} className="animate-spin" style={{ color: isMe ? '#fff' : '#0068FF' }} />
          ) : (
            <FileText size={20} style={{ color: isMe ? '#fff' : '#0068FF' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {typeof fileName === 'string' && fileName.startsWith('[Tệp]') ? fileName.replace('[Tệp] ', '') : fileName}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
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
            style={{ color: isMe ? '#fff' : '#0068FF' }}
          >
            <Download size={18} />
          </a>
        )}
        {/* Time inside file bubble */}
        <span className="text-[10px] self-end flex items-center gap-0.5 select-none whitespace-nowrap flex-shrink-0"
          style={{ color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-msg-time)' }}>
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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ background: 'var(--chat-wallpaper, var(--bg-chat))' }}>
        <div className="max-w-3xl mx-auto space-y-1">
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.id?.toString();
            const msgTime = msg.createdAt ? new Date(msg.createdAt) : (msg.timestamp ? new Date(msg.timestamp) : new Date());
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const prevTime = prevMsg
              ? (prevMsg.createdAt ? new Date(prevMsg.createdAt) : (prevMsg.timestamp ? new Date(prevMsg.timestamp) : null))
              : null;

            // Show date separator if different day
            const showDateSeparator = idx === 0 || (prevTime && !isSameDay(msgTime, prevTime));
            const messageId = msg._id || msg.id;

            const actionMenu = !msg.isRevoked && (
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mx-2 relative">
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
                      style={{ background: contactAvatar ? 'transparent' : '#0068FF' }}>
                      {contactAvatar ? (
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
                          renderImageMessage(msg, isMe, msgTime)

                        /* Video */
                        ) : msg.messageType === 'video' && msg.fileUrl ? (
                          renderVideoMessage(msg, isMe, msgTime)

                        /* File */
                        ) : msg.messageType === 'file' && msg.fileUrl ? (
                          renderFileMessage(msg, isMe, msgTime)

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

                            <span className="pr-12">{msg.content || msg.text}</span>
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
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
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
        </div>
      )}
    </>
  );
};

export default MessageList;
