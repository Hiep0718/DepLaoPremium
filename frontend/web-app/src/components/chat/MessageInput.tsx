import { useState, useRef, useEffect } from 'react';
import {
  Paperclip, Send, Smile, Image as ImageIcon, ThumbsUp, Sticker,
  ScreenShare, Code, Type, Zap, MoreHorizontal, X
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';
import { STICKERS } from '../../constants/stickers';

const MessageInput = () => {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const stickerRef = useRef<HTMLDivElement>(null);
  const { activeConversation, setActiveConversation, addMessage, replyingMessage, setReplyingMessage } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stickerRef.current && !stickerRef.current.contains(event.target as Node)) {
        setShowStickers(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      messageType: 'text',
      fileUrl: undefined,
      replyTo: replyingMessage ? {
        messageId: replyingMessage.id || replyingMessage._id || '',
        content: replyingMessage.content || replyingMessage.text || '',
        senderId: replyingMessage.senderId,
        messageType: replyingMessage.messageType || 'text',
      } : undefined,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: Date.now().toString(), ...messagePayload, createdAt: new Date().toISOString() });
    setReplyingMessage(null);
  };

  const sendSticker = async (stickerUrl: string) => {
    if (!activeConversation || !user) return;
    
    let currentConversation = activeConversation;
    // Handle new conversation logic same as handleSend if needed
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
      text: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      replyTo: replyingMessage ? {
        messageId: replyingMessage.id || replyingMessage._id || '',
        content: replyingMessage.content || replyingMessage.text || '',
        senderId: replyingMessage.senderId,
        messageType: replyingMessage.messageType || 'text',
      } : undefined,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: Date.now().toString(), ...messagePayload, createdAt: new Date().toISOString() });
    setShowStickers(false);
    setReplyingMessage(null);
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
      <div className="flex items-center px-2 py-1 relative" style={{ borderBottom: '1px solid var(--border-light)' }}>
        {toolButtons.map((btn, i) => (
          <button key={i} type="button"
            className="p-2 rounded-md transition-all duration-150 hover:scale-105"
            style={{ color: btn.title === 'Sticker' && showStickers ? '#0068FF' : 'var(--text-secondary)' }}
            onClick={() => {
              if (btn.title === 'Sticker') {
                setShowStickers(!showStickers);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              if (btn.title !== 'Sticker' || !showStickers) e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              if (btn.title !== 'Sticker' || !showStickers) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={btn.title}
          >
            <btn.icon size={19} strokeWidth={1.5} />
          </button>
        ))}

        {/* Sticker Picker Popover */}
        {showStickers && (
          <div ref={stickerRef} className="absolute bottom-full left-0 mb-2 w-80 p-3 rounded-lg shadow-xl animate-fadeIn z-50 border"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-light)' }}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--border-light)]">
              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Nhãn dán</h4>
              <button type="button" onClick={() => setShowStickers(false)}>
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
              {STICKERS.map((sticker, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendSticker(sticker)}
                  className="aspect-square p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center cursor-pointer"
                >
                  <img src={sticker} alt="Sticker" className="w-14 h-14 object-contain drop-shadow-md hover:scale-110 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Replying Preview Banner */}
      {replyingMessage && (
        <div className="flex items-center justify-between px-3 py-2 text-sm border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-light)' }}>
          <div className="flex flex-col pl-2 border-l-2 border-[#0068FF] overflow-hidden">
            <span className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
              Đang trả lời {replyingMessage.senderId === user.id.toString() ? 'chính mình' : 'người khác'}
            </span>
            <span className="truncate text-xs mt-0.5 opacity-80" style={{ color: 'var(--text-secondary)' }}>
              {replyingMessage.messageType === 'sticker' ? '[Nhãn dán]' : (replyingMessage.content || replyingMessage.text)}
            </span>
          </div>
          <button type="button" onClick={() => setReplyingMessage(null)} className="p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors">
             <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      )}

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
