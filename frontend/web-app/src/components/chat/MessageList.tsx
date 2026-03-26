import { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
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
        // Ensure chronological order
        // res.data from axios contains the API response { success, data }
        if (res.data && Array.isArray(res.data.data)) {
           // Backend may have already reversed it, but to be sure we can check or just use it.
           // Actually backend returns chronologically reversed, so it's already oldest-first.
           setMessages(res.data.data); 
        } else if (res.data && Array.isArray(res.data)) {
           setMessages(res.data);
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
  }, [activeConversation, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!activeConversation) {
    return <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50"><div className="px-4 py-2 bg-white rounded-full shadow-sm text-sm text-slate-500 font-medium">Chọn một cuộc trò chuyện để bắt đầu</div></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Date separator */}
      <div className="flex justify-center mb-6 mt-2">
        <div className="bg-black/15 text-white text-xs py-1 px-3 rounded-full font-medium shadow-sm backdrop-blur-sm">
          Hôm nay
        </div>
      </div>

      {messages.map((msg, idx) => {
        const isMe = msg.senderId === user?.id?.toString();
        const msgTime = msg.createdAt ? new Date(msg.createdAt) : (msg.timestamp ? new Date(msg.timestamp) : new Date());
        
        return (
        <div
          key={msg._id || msg.id || idx}
          className={clsx(
            'flex flex-col',
            isMe ? 'items-end' : 'items-start'
          )}
        >
          <div className={clsx("flex items-end gap-2", isMe ? "max-w-[75%]" : "max-w-[70%]")}>
            {!isMe && (
              <div className="w-8 h-8 rounded-full mx-1 bg-indigo-100 shrink-0 flex items-center justify-center font-bold text-indigo-600 text-sm shadow-sm select-none overflow-hidden">
                {/* Fallback to generic avatar if specific missing */}
                <span className="text-xs uppercase">{activeConversation?.participants?.[0]?.fullName?.charAt(0) || 'U'}</span>
              </div>
            )}
            <div
              className={clsx(
                'px-3.5 py-2 shadow-sm text-[15px] leading-relaxed relative flex flex-col',
                isMe
                  ? 'bg-[#EEFFDE] text-slate-800 rounded-2xl rounded-br-none'
                  : 'bg-white text-slate-800 rounded-2xl rounded-bl-none ml-1'
              )}
            >
              {isMe && (
                <svg className="absolute bottom-0 -right-2 w-2.5 h-3 text-[#EEFFDE] fill-current" viewBox="0 0 10 12">
                  <path d="M0 12C5.52285 12 10 7.52285 10 2V0C10 5.52285 5.52285 10 0 10V12Z" />
                </svg>
              )}
              {!isMe && (
                <svg className="absolute bottom-0 -left-2 w-2.5 h-3 text-white fill-current" viewBox="0 0 10 12">
                  <path d="M10 12C4.47715 12 0 7.52285 0 2V0C0 5.52285 4.47715 10 10 10V12Z" />
                </svg>
              )}
              <span className="pr-10">{msg.content || msg.text}</span>
              <span className={clsx("text-[11px] mt-1 float-right self-end absolute bottom-1.5 right-2 flex items-center gap-0.5 select-none", isMe ? "text-green-700/60" : "text-slate-400")}>
                {format(msgTime, 'HH:mm')}
                {isMe && (
                   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </span>
            </div>
          </div>
        </div>
      )})}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
