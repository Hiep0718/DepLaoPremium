import { useState } from 'react';
import {
  Paperclip, Send, Smile, Image as ImageIcon, ThumbsUp, Sticker,
  ScreenShare, Code, Type, Zap, MoreHorizontal
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';

const MessageInput = () => {
  const [text, setText] = useState('');
  const { activeConversation, setActiveConversation, addMessage } = useChatStore();
  const { user } = useAuthStore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeConversation || !user) return;

    let currentConversation = activeConversation;
    const activeText = text.trim();
    setText('');

    if (currentConversation.conversationId.startsWith('new_') || currentConversation.conversationId.startsWith('contact_')) {
      try {
        const friendPart = currentConversation.participants[0];
        const friendId = friendPart.contactUserId || friendPart.id || friendPart.userId;
        const res = await createConversation([user.id.toString(), friendId.toString()], false);
        if (res.data?.data) {
          currentConversation = res.data.data;
          setActiveConversation(res.data.data);
        } else if (res.data) {
          currentConversation = res.data;
          setActiveConversation(res.data);
        }
      } catch (err) {
        console.error('Failed to create conversation', err);
        setText(activeText);
        return;
      }
    }

    const recipientPart = currentConversation.isGroup
      ? null
      : currentConversation.participants.find((p: any) =>
          p !== user.id && p !== user.id.toString() &&
          p.id !== user.id && p.id?.toString() !== user.id.toString() &&
          p.userId !== user.id && p.userId !== user.id.toString() &&
          p.contactUserId !== user.id && p.contactUserId?.toString() !== user.id.toString()
        );

    const recipientId = recipientPart?.userId || recipientPart?.contactUserId || recipientPart?.id || recipientPart;

    const messagePayload = {
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: activeText,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: Date.now().toString(), ...messagePayload, createdAt: new Date().toISOString() });
  };

  if (!activeConversation) return null;

  // Get recipient name for placeholder
  const contact = activeConversation.participants?.[0];
  const recipientName = contact ? (contact.nickname || contact.fullName || 'bạn bè') : 'bạn bè';

  // Zalo toolbar icons — matches real Zalo PC exactly
  const toolButtons = [
    { icon: Sticker, title: 'Sticker' },
    { icon: ImageIcon, title: 'Hình ảnh' },
    { icon: Paperclip, title: 'Đính kèm tệp' },
    { icon: ScreenShare, title: 'Chụp màn hình' },
    { icon: Code, title: 'Code Snippet' },
    { icon: Type, title: 'Định dạng tin nhắn' },
    { icon: Zap, title: 'Tin nhắn nhanh' },
    { icon: MoreHorizontal, title: 'Thêm' },
  ];

  return (
    <div className="relative z-10 theme-transition" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border-primary)' }}>
      {/* Zalo-style Toolbar */}
      <div className="flex items-center px-2 py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
        {toolButtons.map((btn, i) => (
          <button key={i} type="button"
            className="p-2 rounded-md transition-all duration-150 hover:scale-105"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={btn.title}
          >
            <btn.icon size={19} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      {/* Input Row */}
      <form onSubmit={handleSend} className="flex items-end gap-1 px-3 py-2">
        <div className="flex-1">
          <textarea
            className="w-full bg-transparent border-0 resize-none py-2 outline-none text-[15px] leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
            rows={1}
            placeholder={`Nhập @, tin nhắn tới ${recipientName}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
        </div>

        <div className="flex items-center gap-0.5 pb-1.5">
          <button type="button" className="p-2 rounded-md transition-all duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            title="Biểu tượng cảm xúc"
          >
            <Smile size={22} strokeWidth={1.5} />
          </button>

          {text.trim() ? (
            <button type="submit" className="p-2 rounded-md transition-all duration-150"
              style={{ color: '#0068FF' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Gửi"
            >
              <Send size={22} strokeWidth={1.5} />
            </button>
          ) : (
            <button type="button" className="p-2 rounded-md transition-all duration-150"
              style={{ color: '#0068FF' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Gửi lượt thích"
            >
              <ThumbsUp size={22} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
