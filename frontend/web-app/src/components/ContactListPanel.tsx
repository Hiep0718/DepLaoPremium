import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { useChatStore } from '../stores/chatStore';
import SearchUserModal from './SearchUserModal';

const ContactListPanel = () => {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

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

  useEffect(() => {
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
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Danh bạ</h2>
        <button 
          onClick={() => setIsSearchModalOpen(true)}
          className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-colors"
          title="Thêm bạn"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* Menu / List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-slate-100">
          <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl text-left transition-colors font-semibold text-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
              <Users size={20} />
            </div>
            Danh sách nhóm
          </button>
        </div>

        {/* Contacts */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Danh sách bạn bè ({contacts.length})
          </h3>
          
              <div className="flex flex-col gap-1">
                {loading ? (
                  <div className="text-sm text-slate-500 text-center py-4 font-medium animate-pulse">Đang tải...</div>
                ) : contacts.length === 0 ? (
                  <div className="text-sm text-slate-500 text-center py-4 font-medium">Chưa có liên hệ nào</div>
                ) : (
                  contacts.map((contact) => (
                    <div 
                      key={contact.id}
                      onClick={() => handleContactClick(contact)}
                      className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 shadow-sm overflow-hidden">
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt={contact.fullName} className="w-full h-full object-cover" />
                            ) : (
                              (contact.nickname || contact.fullName || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block">{contact.nickname || contact.fullName}</span>
                          {contact.notes && <span className="text-xs font-medium text-slate-500">{contact.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
        </div>
      </div>
      
      <SearchUserModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onUserAdded={() => fetchContacts()}
      />
    </div>
  );
};

export default ContactListPanel;
