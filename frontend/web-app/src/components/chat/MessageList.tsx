import { useRef, useEffect, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';

const MessageList = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { activeConversation, messages, setMessages, setReplyingMessage, setForwardingMessage, updateMessage, activeContactInfo } = useChatStore();
  const { user } = useAuthStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--bg-chat)' }}>
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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ background: 'var(--bg-chat)' }}>
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
                      {msg.messageType === 'sticker' && msg.fileUrl ? (
                        <div className="relative group/sticker flex flex-col">
                           {/* Reply preview inside sticker if it had replies */}
                          {msg.replyTo && (
                            <div className="text-xs p-1.5 mb-1 border-l-[3px] rounded opacity-90 max-w-full truncate" style={{ borderColor: '#0068FF', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                              <span className="font-semibold">{msg.replyTo.senderId === user?.id?.toString() ? 'Bạn' : contactName}</span>
                              <br/>
                              <span className="opacity-80">{msg.replyTo.messageType === 'sticker' ? '[Nhãn dán]' : msg.replyTo.content}</span>
                            </div>
                          )}
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
                      ) : (
                        <div className="px-3 py-[7px] rounded-2xl relative text-[15px] leading-relaxed transition-shadow duration-150 hover:shadow-md"
                          style={{
                            background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)',
                            color: 'var(--text-primary)',
                            borderBottomRightRadius: isMe ? '6px' : undefined,
                            borderBottomLeftRadius: !isMe ? '6px' : undefined,
                          }}>
                          
                          {/* Reply Block */}
                          {msg.replyTo && (
                            <div className="text-xs p-1.5 mb-1.5 border-l-[3px] rounded opacity-90 truncate max-w-[200px]" 
                               style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderColor: isMe ? '#004A99' : '#0068FF' }}>
                              <span className="font-semibold block">{msg.replyTo.senderId === user?.id?.toString() ? 'Bạn' : contactName}</span>
                              <span className="opacity-80">{msg.replyTo.messageType === 'sticker' ? '[Nhãn dán]' : msg.replyTo.content}</span>
                            </div>
                          )}

                          <span className="pr-12">{msg.content || msg.text}</span>
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
  );
};

export default MessageList;
