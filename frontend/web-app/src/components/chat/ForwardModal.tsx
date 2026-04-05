import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';

const ForwardModal = () => {
  const { 
    isForwardModalOpen, 
    setForwardModalOpen, 
    forwardingMessage, 
    setForwardingMessage,
    conversations 
  } = useChatStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  if (!isForwardModalOpen || !forwardingMessage || !user) return null;

  const handleClose = () => {
    setForwardModalOpen(false);
    setTimeout(() => setForwardingMessage(null), 200);
  };

  const handleForward = async (conversation: any) => {
    setSendingTo(conversation.conversationId);
    
    let targetConversationId = conversation.conversationId;
    let recipientId = conversation.participants?.find((p: any) => 
      p !== user.id && p !== user.id.toString() &&
      p.id !== user.id && p.id?.toString() !== user.id.toString() &&
      p.userId !== user.id && p.userId !== user.id.toString() &&
      p.contactUserId !== user.id && p.contactUserId?.toString() !== user.id.toString()
    );

    // If it's a new contact without conversation yet
    if (targetConversationId.startsWith('new_') || targetConversationId.startsWith('contact_')) {
      try {
        const friendId = recipientId?.userId || recipientId?.contactUserId || recipientId?.id || recipientId;
        const res = await createConversation([user.id.toString(), friendId.toString()], false);
        if (res.data?.data) {
          targetConversationId = res.data.data.conversationId;
          recipientId = friendId;
        } else if (res.data) {
          targetConversationId = res.data.conversationId;
          recipientId = friendId;
        }
      } catch (err) {
        console.error('Failed to create conversation for forwarding', err);
        setSendingTo(null);
        return;
      }
    } else {
      recipientId = recipientId?.userId || recipientId?.contactUserId || recipientId?.id || recipientId;
    }

    const messagePayload = {
      conversationId: targetConversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: forwardingMessage.messageType === 'sticker' ? '[Nhãn dán]' : (forwardingMessage.content || forwardingMessage.text),
      messageType: forwardingMessage.messageType || 'text',
      fileUrl: forwardingMessage.fileUrl,
    };

    socket.emit('send_message', messagePayload);
    
    // Simulate slight delay for better UX
    setTimeout(() => {
      setSendingTo(null);
      handleClose();
    }, 500);
  };

  const filteredConversations = conversations.filter(c => {
    const contact = c.participants?.find((p: any) => p?.id !== user.id && p?.userId !== user.id);
    const name = contact?.nickname || contact?.fullName || 'Nhóm';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn" onClick={handleClose}>
      <div 
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-scaleIn bg-[var(--bg-panel)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <h3 className="font-semibold text-[var(--text-primary)]">Chuyển tiếp tin nhắn</h3>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-[var(--bg-hover)]">
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>
        
        <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-chat)] flex items-center gap-2">
          <div className="border-l-4 border-[#0068FF] pl-2 opacity-80 text-sm truncate">
            {forwardingMessage.messageType === 'sticker' ? '[Nhãn dán]' : (forwardingMessage.content || forwardingMessage.text)}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Tìm kiếm trò chuyện..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none border border-[var(--border-light)] focus:border-[#0068FF]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar p-2">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-secondary)] text-sm">Không tìm thấy kết quả</div>
          ) : (
            filteredConversations.map(conv => {
              const contact = conv.participants?.find((p: any) => p?.id !== user.id && p?.userId !== user.id);
              const name = contact?.nickname || contact?.fullName || 'Người dùng Zalo';
              const avatarUrl = contact?.avatarUrl;

              return (
                <div 
                  key={conv.conversationId} 
                  className="flex items-center justify-between p-2 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer transition-colors"
                  onClick={() => handleForward(conv)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-[#0068FF] flex-shrink-0 flex items-center justify-center text-white overflow-hidden font-bold">
                      {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[var(--text-primary)] font-medium truncate max-w-[150px] text-sm">{name}</span>
                  </div>
                  <button 
                    disabled={sendingTo === conv.conversationId}
                    className="px-4 py-1.5 rounded-full text-xs font-medium min-w-[70px] bg-[#0068FF]/10 text-[#0068FF] hover:bg-[#0068FF] hover:text-white transition-colors"
                  >
                    {sendingTo === conv.conversationId ? 'Đang gửi...' : 'Gửi'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
