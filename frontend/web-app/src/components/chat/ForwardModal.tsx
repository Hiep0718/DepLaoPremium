import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';
import { contactService, type ContactResponse } from '../../services/contactService';
import api from '../../services/axios';

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
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

  // Load contacts and build name map when modal opens
  useEffect(() => {
    if (!isForwardModalOpen || !user) return;

    const loadData = async () => {
      // 1. Load contacts
      try {
        const res = await contactService.getContacts(0, 100);
        setContacts(res.content || []);
      } catch (err) {
        console.error('Failed to load contacts for forward', err);
      }
    };
    loadData();
  }, [isForwardModalOpen, user]);

  // Build userMap from contacts + resolve unknown participants
  useEffect(() => {
    if (!user || (!contacts.length && !conversations.length)) return;

    const buildMap = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};

      // Add all contacts to the map
      for (const c of contacts) {
        const key = String(c.contactUserId);
        map[key] = { fullName: c.nickname || c.fullName, avatarUrl: c.avatarUrl };
      }

      // Find unknown participant IDs
      const unknownIds: string[] = [];
      for (const conv of conversations) {
        for (const p of conv.participants) {
          const pid = String((p as any).userId || (p as any).id || p);
          if (pid && pid !== String(user.id) && !map[pid]) {
            unknownIds.push(pid);
          }
        }
      }

      // Fetch unknown users from API
      for (const uid of [...new Set(unknownIds)]) {
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName, avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }

      setUserMap(map);
    };

    buildMap();
  }, [contacts, conversations, user]);

  if (!isForwardModalOpen || !forwardingMessage || !user) return null;

  // Helper: get display name & avatar for a conversation
  const getConversationInfo = (conv: any) => {
    if (conv.isGroup) return { name: 'Nhóm', avatar: undefined };
    for (const p of conv.participants) {
      const pid = String((p as any).userId || (p as any).id || p);
      if (pid !== String(user.id)) {
        // First check our resolved userMap
        if (userMap[pid]) {
          return { name: userMap[pid].fullName, avatar: userMap[pid].avatarUrl };
        }
        // Fallback to participant object fields
        if ((p as any).fullName) return { name: (p as any).fullName, avatar: (p as any).avatarUrl };
        if ((p as any).nickname) return { name: (p as any).nickname, avatar: (p as any).avatarUrl };
        return { name: 'Người dùng', avatar: undefined };
      }
    }
    return { name: 'Người dùng', avatar: undefined };
  };

  const handleClose = () => {
    setForwardModalOpen(false);
    setSearchTerm('');
    setTimeout(() => setForwardingMessage(null), 200);
  };

  const handleForward = async (conversation: any) => {
    setSendingTo(conversation.conversationId);
    
    let targetConversationId = conversation.conversationId;
    let recipientId = conversation.participants?.find((p: any) => {
      const pid = String((p as any).userId || (p as any).id || p);
      return pid !== String(user.id);
    });

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
      text: forwardingMessage.messageType === 'sticker' ? '[Nhãn dán]' : forwardingMessage.messageType === 'contact' ? '[Danh thiếp]' : (forwardingMessage.content || forwardingMessage.text),
      messageType: forwardingMessage.messageType || 'text',
      fileUrl: forwardingMessage.fileUrl,
    };

    socket.emit('send_message', messagePayload);
    
    setTimeout(() => {
      setSendingTo(null);
      handleClose();
    }, 500);
  };

  const filteredConversations = conversations.filter(c => {
    const { name } = getConversationInfo(c);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn" onClick={handleClose}>
      <div 
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl bg-[var(--bg-panel)] flex flex-col"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <h3 className="font-semibold text-[var(--text-primary)]">Chuyển tiếp tin nhắn</h3>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-[var(--bg-hover)]">
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>
        
        <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-chat)] flex items-center gap-2">
          <div className="border-l-4 pl-2 opacity-80 text-sm truncate" style={{ borderColor: 'var(--accent-primary)' }}>
            {forwardingMessage.messageType === 'sticker' ? '[Nhãn dán]' : forwardingMessage.messageType === 'contact' ? '[Danh thiếp]' : (forwardingMessage.content || forwardingMessage.text)}
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
              className="w-full pl-10 pr-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none border border-[var(--border-light)] focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar p-2">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-secondary)] text-sm">Không tìm thấy kết quả</div>
          ) : (
            filteredConversations.map(conv => {
              const { name, avatar } = getConversationInfo(conv);

              return (
                <div 
                  key={conv.conversationId} 
                  className="flex items-center justify-between p-2 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer transition-colors"
                  onClick={() => handleForward(conv)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white overflow-hidden font-bold"
                      style={{ background: avatar ? 'transparent' : 'var(--accent-primary)' }}>
                      {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[var(--text-primary)] font-medium truncate max-w-[150px] text-sm">{name}</span>
                  </div>
                  <button 
                    disabled={sendingTo === conv.conversationId}
                    className="px-4 py-1.5 rounded-full text-xs font-medium min-w-[70px] transition-colors"
                    style={{
                      background: sendingTo === conv.conversationId ? 'var(--bg-hover)' : 'var(--accent-light)',
                      color: sendingTo === conv.conversationId ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    }}
                    onMouseEnter={(e) => { if (sendingTo !== conv.conversationId) { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}}
                    onMouseLeave={(e) => { if (sendingTo !== conv.conversationId) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}}
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
