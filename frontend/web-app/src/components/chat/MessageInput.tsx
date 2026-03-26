import { useState } from 'react';
import { Paperclip, Send, Smile, Image as ImageIcon, Mic } from 'lucide-react';
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
    setText(''); // clear optimistic
    
    // If it's a new conversation from contact, create it first
    if (currentConversation.conversationId.startsWith('new_')) {
       try {
         // Get the friend ID
         const friendPart = currentConversation.participants[0];
         const friendId = friendPart.contactUserId || friendPart.id || friendPart.userId;
         
         const res = await createConversation([user.id.toString(), friendId.toString()], false);
         if (res.data) {
           currentConversation = res.data;
           setActiveConversation(res.data);
         }
       } catch (err) {
         console.error('Failed to create conversation', err);
         setText(activeText); // revert
         return;
       }
    }
    
    const recipientPart = currentConversation.isGroup 
      ? null 
      : currentConversation.participants.find((p: any) => 
          p !== user.id && 
          p !== user.id.toString() && 
          p.id !== user.id && 
          p.id?.toString() !== user.id.toString() &&
          p.userId !== user.id && 
          p.userId !== user.id.toString() &&
          p.contactUserId !== user.id &&
          p.contactUserId?.toString() !== user.id.toString()
        );
      
    // Safely extract the ID string
    const recipientId = recipientPart?.userId || recipientPart?.contactUserId || recipientPart?.id || recipientPart;
      
    const messagePayload = {
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: activeText,
    };

    // Gửi Message qua Socket
    socket.emit('send_message', messagePayload);
    
    // Add locally for instant UI update
    addMessage({
      id: Date.now().toString(),
      ...messagePayload,
      createdAt: new Date().toISOString(),
    });
  };

  if (!activeConversation) return null;

  return (
    <div className="bg-white p-2 sm:p-3 flex justify-center z-10 w-full relative">
      <form onSubmit={handleSend} className="flex items-end gap-2 w-full max-w-5xl mx-auto">
        {/* Actions before input */}
        <div className="flex items-center space-x-1 pb-0.5">
          <button type="button" className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 rounded-full transition-colors">
            <Paperclip size={22} strokeWidth={1.5} />
          </button>
          <button type="button" className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
            <ImageIcon size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Input */}
        <div className="flex-1 bg-slate-100/80 hover:bg-slate-100 transition-colors rounded-3xl relative">
          <textarea
            className="w-full bg-transparent border-0 focus:ring-0 resize-none py-3 pl-5 pr-12 outline-none max-h-32 text-[15px] text-slate-800 placeholder-slate-400"
            rows={1}
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button type="button" className="absolute right-2 bottom-2 text-slate-400 hover:text-indigo-500 transition-colors p-1.5 rounded-full hover:bg-slate-200/50">
            <Smile size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Actions after input */}
        <div className="pb-0.5">
          {text.trim() ? (
            <button 
              type="submit" 
              className="p-3 bg-[#3390EC] text-white rounded-full hover:bg-[#2A82D6] transition-all shadow-md active:scale-95"
            >
              <Send size={20} className="translate-x-[2px] -translate-y-[1px]" strokeWidth={1.5} />
            </button>
          ) : (
            <button type="button" className="p-3.5 text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-all">
              <Mic size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
