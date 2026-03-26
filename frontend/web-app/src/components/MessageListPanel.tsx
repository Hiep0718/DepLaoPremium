import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { getConversationsList } from '../services/message.service';
import { useChatStore, type Conversation } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';

const MessageListPanel = () => {
  const { conversations, setConversations, setActiveConversation } = useChatStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Fallback contacts just in case user has no conversations
  const [contacts, setContacts] = useState<ContactResponse[]>([]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        if (!user || !user.id) return;
        // Fetch conversations from Node.js server
        const res = await getConversationsList(user.id.toString());
        if (res.data && Array.isArray(res.data.data)) {
          setConversations(res.data.data);
        } else if (res.data && Array.isArray(res.data)) {
          setConversations(res.data);
        }
      } catch (err) {
        console.error("Failed to load conversations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
    
    // Also load contacts as fallback to start new chats
    contactService.getContacts(0, 50).then(res => setContacts(res.content)).catch(console.error);
  }, [user, setConversations]);

  const handleConversationClick = (conv: Conversation) => {
    setActiveConversation(conv);
  };
  
  const handleContactClick = (contact: ContactResponse) => {
    // Determine if conversation exists
    const existing = conversations.find(c => 
      !c.isGroup && c.participants.some((p: any) => 
        p.id == contact.contactUserId || 
        p.userId == contact.contactUserId ||
        p.contactUserId == contact.contactUserId
      )
    );
    if (existing) {
      setActiveConversation(existing);
    } else {
      setActiveConversation({
        conversationId: `new_${contact.contactUserId}`,
        participants: [contact],
        isGroup: false,
      });
    }
  };

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Tin nhắn</h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-100/80 border-transparent rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none placeholder-slate-400"
            placeholder="Tìm kiếm..."
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {loading ? (
            <div className="text-sm text-gray-500 text-center py-4">Đang tải...</div>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => {
              // Find the other participant in 1-1 chat
              const otherUser = conv.isGroup ? null : conv.participants.find((p: any) => 
                p != user?.id && 
                p.id != user?.id && 
                p.userId != user?.id &&
                p.contactUserId != user?.id
              );
              const displayName = conv.isGroup ? 'Nhóm' : (otherUser?.fullName || 'Người dùng');
              const avatar = otherUser?.avatarUrl;
              
              return (
                <div 
                  key={conv.conversationId} 
                  onClick={() => handleConversationClick(conv)}
                  className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex-shrink-0 flex items-center justify-center text-indigo-600 font-bold shadow-sm border border-indigo-100 overflow-hidden">
                    {avatar ? (
                      <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-slate-800 truncate">{displayName}</h3>
                      {conv.lastMessage?.timestamp ? (
                         <span className="text-[11px] font-medium text-slate-400 shrink-0">
                           {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      ) : (
                         <span className="text-xs font-medium text-slate-400">...</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {typeof conv.lastMessage === 'object' && conv.lastMessage !== null 
                        ? (conv.lastMessage as any).content 
                        : (conv.lastMessage as string) || 'Chưa có tin nhắn'}
                    </p>
                  </div>
                </div>
              );
            })
          ) : contacts.length > 0 ? (
            // Fallback suggestions
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 mt-2">Gợi ý bắt đầu trò chuyện</div>
              {contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  onClick={() => handleContactClick(contact)}
                  className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex-shrink-0 flex items-center justify-center text-indigo-600 font-bold shadow-sm border border-indigo-100 overflow-hidden">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} alt={contact.fullName} className="w-full h-full object-cover" />
                    ) : (
                      (contact.nickname || contact.fullName || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-slate-800 truncate">{contact.nickname || contact.fullName}</h3>
                    </div>
                    <p className="text-sm text-slate-500 truncate text-indigo-400">Bắt đầu trò chuyện mới</p>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-sm text-gray-500 text-center py-8">Bạn chưa có trò chuyện và danh bạ trống.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageListPanel;
