import { useRef, useEffect } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useChatStore } from '../../stores/chatStore';
import { getConversationHistory } from '../../services/message.service';
import { useAuthStore } from '../../stores/authStore';

const MessageList = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { activeConversation, messages, setMessages } = useChatStore();
  const { user } = useAuthStore();

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

  // Helper: format date separator
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Hôm nay';
    if (isYesterday(date)) return 'Hôm qua';
    return format(date, 'dd/MM/yyyy', { locale: vi });
  };

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
  const contactAvatar = contact?.avatarUrl;
  const contactName = contact?.nickname || contact?.fullName || '?';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3" style={{ background: 'var(--bg-chat)' }}>
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

          return (
            <div key={msg._id || msg.id || idx}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="text-[11px] py-1 px-4 rounded-full font-medium select-none"
                    style={{ background: 'var(--bg-date-separator)', color: 'var(--text-date-separator)' }}>
                    {getDateLabel(msgTime)}
                  </div>
                </div>
              )}

              {/* Message Bubble */}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 group`}>
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

                <div className={`max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="px-3 py-[7px] rounded-2xl relative text-[15px] leading-relaxed transition-shadow duration-150 hover:shadow-md"
                    style={{
                      background: isMe ? 'var(--bg-msg-sent)' : 'var(--bg-msg-received)',
                      color: 'var(--text-primary)',
                      borderBottomRightRadius: isMe ? '6px' : undefined,
                      borderBottomLeftRadius: !isMe ? '6px' : undefined,
                    }}>
                    <span className="pr-12">{msg.content || msg.text}</span>
                    <span className="absolute bottom-1.5 right-2.5 text-[10px] flex items-center gap-0.5 select-none whitespace-nowrap opacity-70"
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
              </div>
            </div>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
