import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { useChatStore } from '../stores/chatStore';

const MessageListPanel = () => {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const pageResponse = await contactService.getContacts(0, 50);
        setContacts(pageResponse.content);
      } catch (err) {
        console.error("Failed to load contacts", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  const handleContactClick = (contact: ContactResponse) => {
    setActiveConversation({
      conversationId: `contact_${contact.id}`,
      participants: [contact],
      isGroup: false,
      lastMessage: '...',
    });
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
          ) : contacts.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">Chưa có tin nhắn nào</div>
          ) : (
            contacts.map((contact) => (
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
                    <span className="text-xs font-medium text-slate-400">Bây giờ</span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">Chưa có tin nhắn (Tạm thời)</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageListPanel;
