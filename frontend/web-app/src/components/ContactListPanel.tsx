import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, UserCheck, Mail, MoreHorizontal } from 'lucide-react';
import { contactService, type ContactResponse, type FriendRequestResponse } from '../services/contactService';
import { useChatStore } from '../stores/chatStore';
import { socket } from '../services/socket';
import SearchUserModal from './SearchUserModal';

const ContactListPanel = () => {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestResponse[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'friends' | 'groups' | 'invites'>('friends');
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const navigate = useNavigate();

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const pageResponse = await contactService.getContacts(0, 50);
      setContacts(pageResponse.content);
    } catch (err) {
      console.error("Failed to load contacts", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    setInvitesLoading(true);
    try {
      const [pendingRes, sentRes] = await Promise.all([
        contactService.getPendingRequests(0, 50),
        contactService.getSentRequests(0, 50)
      ]);
      setPendingRequests(pendingRes.content);
      setSentRequests(sentRes.content);
    } catch (err) {
      console.error("Failed to load friend requests", err);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  useEffect(() => {
    if (activeMenu === 'invites') {
      fetchFriendRequests();
    }
  }, [activeMenu]);

  useEffect(() => {
    if (!socket.connected) return;
    
    const handleFriendAction = () => {
      fetchContacts();
      if (activeMenu === 'invites') {
        fetchFriendRequests();
      }
    };
    
    socket.on('friend_action_received', handleFriendAction);
    
    return () => {
      socket.off('friend_action_received', handleFriendAction);
    };
  }, [activeMenu]);

  const handleAcceptRequest = async (id: number) => {
    try {
      await contactService.acceptFriendRequest(id);

      const req = pendingRequests.find(r => r.id === id);
      if (req && socket.connected) {
        socket.emit('friend_action', { recipientId: req.sender.id, action: 'accept' });
      }

      fetchFriendRequests();
      fetchContacts();
    } catch(err) { console.error(err); }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await contactService.rejectFriendRequest(id);

      const req = pendingRequests.find(r => r.id === id);
      if (req && socket.connected) {
        socket.emit('friend_action', { recipientId: req.sender.id, action: 'reject' });
      }

      fetchFriendRequests();
    } catch(err) { console.error(err); }
  };

  const handleCancelRequest = async (id: number) => {
    try {
      await contactService.cancelFriendRequest(id);

      const req = sentRequests.find(r => r.id === id);
      if (req && socket.connected) {
        socket.emit('friend_action', { recipientId: req.receiver.id, action: 'cancel' });
      }

      fetchFriendRequests();
    } catch(err) { console.error(err); }
  };

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
          ) : activeMenu === 'invites' ? (
            <div className="p-6">
              {invitesLoading ? (
                <div className="text-sm text-center py-4 text-gray-500">Đang tải...</div>
              ) : (
                <div className="space-y-8">
                  {/* Lời mời đã nhận */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                      Lời mời đã nhận ({pendingRequests.length})
                    </h3>
                    {pendingRequests.length === 0 ? (
                      <div className="text-sm text-gray-500">Bạn không có lời mời nào.</div>
                    ) : (
                      <div className="space-y-3">
                        {pendingRequests.map(req => (
                          <div key={req.id} className="p-4 rounded-xl flex items-start gap-4" style={{ background: 'var(--bg-search)' }}>
                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 text-white flex items-center justify-center font-bold">
                              {req.sender.avatarUrl ? (
                                <img src={req.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : req.sender.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{req.sender.fullName}</h4>
                              <p className="text-xs text-gray-500 mt-1">{req.sender.phone}</p>
                              {req.message && <p className="text-sm mt-2 italic" style={{ color: 'var(--text-secondary)' }}>"{req.message}"</p>}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleAcceptRequest(req.id)}
                                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  Chấp nhận
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                                >
                                  Từ chối
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lời mời đã gửi */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 border-t pt-6 border-gray-200" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}>
                      Lời mời đã gửi ({sentRequests.length})
                    </h3>
                    {sentRequests.length === 0 ? (
                      <div className="text-sm text-gray-500">Bạn chưa gửi lời mời nào.</div>
                    ) : (
                      <div className="space-y-3">
                        {sentRequests.map(req => (
                          <div key={req.id} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'var(--bg-search)' }}>
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 text-white flex items-center justify-center font-bold">
                              {req.receiver.avatarUrl ? (
                                <img src={req.receiver.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : req.receiver.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{req.receiver.fullName}</h4>
                              <p className="text-xs text-gray-500 mt-1">{req.receiver.phone}</p>
                            </div>
                            <button
                              onClick={() => handleCancelRequest(req.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              Chưa có nhóm nào
            </div>
          )}
        </div>
      </div>

      <SearchUserModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default ContactListPanel;
