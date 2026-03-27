import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, UserCheck, Mail, MoreHorizontal } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { useChatStore } from '../stores/chatStore';
import SearchUserModal from './SearchUserModal';

const ContactListPanel = () => {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'friends' | 'groups' | 'invites'>('friends');
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const navigate = useNavigate();

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

  useEffect(() => { fetchContacts(); }, []);

  const handleContactClick = (contact: ContactResponse) => {
    setActiveConversation({
      conversationId: `contact_${contact.id}`,
      participants: [contact],
      isGroup: false,
      lastMessage: '...',
    });
    navigate('/');
  };

  // Group contacts alphabetically
  const grouped = contacts.reduce((acc, contact) => {
    const name = contact.nickname || contact.fullName || '?';
    const letter = name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, ContactResponse[]>);

  const sortedLetters = Object.keys(grouped).sort();

  const menuItems = [
    { key: 'friends' as const, icon: Users, label: 'Danh sách bạn bè' },
    { key: 'groups' as const, icon: UserCheck, label: 'Danh sách nhóm và cộng đồng' },
    { key: 'invites' as const, icon: Mail, label: 'Lời mời kết bạn' },
  ];

  return (
    <div className="flex h-full z-20" style={{ borderRight: '1px solid var(--border-primary)' }}>
      {/* Left Menu */}
      <div className="w-60 h-full flex flex-col theme-transition"
        style={{ background: 'var(--bg-panel)', borderRight: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full pl-3 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg-search)', color: 'var(--text-primary)' }}
              placeholder="Tìm bạn..."
            />
          </div>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="ml-2 p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Thêm bạn"
          >
            <UserPlus size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex flex-col py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveMenu(item.key)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left"
                style={{
                  background: isActive ? 'var(--bg-active)' : 'transparent',
                  color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--bg-active)' : 'transparent'; }}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Contact List Content */}
      <div className="flex-1 h-full flex flex-col theme-transition" style={{ background: 'var(--bg-panel)' }}>
        {/* Content Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <Users size={20} style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {activeMenu === 'friends' ? 'Danh sách bạn bè' : activeMenu === 'groups' ? 'Danh sách nhóm' : 'Lời mời kết bạn'}
          </h2>
        </div>

        {/* Friends count */}
        {activeMenu === 'friends' && (
          <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Bạn bè ({contacts.length})
            </span>
          </div>
        )}

        {/* Scrollable Contact List - Alphabetical */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>Đang tải...</div>
          ) : activeMenu === 'friends' ? (
            contacts.length === 0 ? (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>Chưa có liên hệ nào</div>
            ) : (
              sortedLetters.map((letter) => (
                <div key={letter}>
                  <div className="px-6 py-2 text-xs font-bold uppercase sticky top-0"
                    style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)' }}>
                    {letter}
                  </div>
                  {grouped[letter].map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => handleContactClick(contact)}
                      className="flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors group"
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden"
                        style={{ background: contact.avatarUrl ? 'transparent' : '#0068FF' }}>
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt={contact.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(contact.nickname || contact.fullName || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {contact.nickname || contact.fullName}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full transition-all"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )
          ) : (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              {activeMenu === 'groups' ? 'Chưa có nhóm nào' : 'Không có lời mời'}
            </div>
          )}
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
