import { useEffect, useState } from 'react';
import { Search, UserPlus, Users as UsersIcon } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { getConversationsList } from '../services/message.service';
import { fetchAiLastMessage } from '../services/aiChat.service';
import { useChatStore, type Conversation } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/axios';
import SearchUserModal from './SearchUserModal';

const userNameCache: Record<string, { fullName: string; avatarUrl?: string }> = {};

const MessageListPanel = () => {
  const { conversations, setConversations, activeConversation, setActiveConversation } = useChatStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchText, setSearchText] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Build userId→name map
  useEffect(() => {
    const buildUserMap = async () => {
      if (!contacts.length && !conversations.length) return;
      const map: Record<string, { fullName: string; avatarUrl?: string }> = { ...userNameCache };
      for (const c of contacts) {
        const key = String(c.contactUserId);
        if (!map[key]) map[key] = { fullName: c.fullName, avatarUrl: c.avatarUrl };
      }
      const unknownIds: string[] = [];
      for (const conv of conversations) {
        for (const p of conv.participants) {
          const pid = String((p as any).userId || (p as any).id || p);
          if (pid && pid !== String(user?.id) && !map[pid]) unknownIds.push(pid);
        }
      }
      for (const uid of [...new Set(unknownIds)]) {
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName, avatarUrl: res.data.data.avatarUrl };
            userNameCache[uid] = map[uid];
          }
        } catch { /* skip */ }
      }
      Object.assign(userNameCache, map);
      setUserMap(map);
    };
    buildUserMap();
  }, [contacts, conversations, user?.id]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        if (!user || !user.id) return;
        const res = await getConversationsList(user.id.toString());
        let convs: Conversation[] = [];
        if (res.data && Array.isArray(res.data.data)) convs = res.data.data;
        else if (res.data && Array.isArray(res.data)) convs = res.data;

        // Merge AI conversation if user has chat history
        try {
          const aiLast = await fetchAiLastMessage(user.id.toString());
          if (aiLast && aiLast.exists) {
            const aiConv: Conversation = {
              conversationId: `ai_food_bot_${user.id}`,
              participants: [{ userId: 'ai_food_bot', fullName: 'Bếp AI 🍜', avatarUrl: null }],
              isGroup: false,
              isAiBot: true,
              lastMessage: {
                content: aiLast.role === 'assistant'
                  ? (aiLast.content && aiLast.content.length > 50 ? aiLast.content.substring(0, 50) + '...' : aiLast.content)
                  : aiLast.content,
                timestamp: aiLast.timestamp,
              },
            };
            // Remove old AI conversation if exists, then add new one
            convs = convs.filter(c => !c.conversationId.startsWith('ai_food_bot_'));
            convs.push(aiConv);
            // Sort by lastMessage timestamp (newest first)
            convs.sort((a, b) => {
              const tA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
              const tB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
              return tB - tA;
            });
          }
        } catch { /* AI service not available, skip */ }

        setConversations(convs);
      } catch (err) {
        console.error("Failed to load conversations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
    contactService.getContacts(0, 50).then(res => setContacts(res.content)).catch(console.error);
  }, [user, setConversations]);

  const getOtherParticipant = (conv: Conversation) => {
    if (conv.isGroup) return { name: 'Nhóm', avatar: undefined };
    for (const p of conv.participants) {
      const pid = String((p as any).userId || (p as any).id || p);
      if (pid !== String(user?.id)) {
        const resolved = userMap[pid];
        if (resolved) return { name: resolved.fullName, avatar: resolved.avatarUrl };
        if ((p as any).fullName) return { name: (p as any).fullName, avatar: (p as any).avatarUrl };
        return { name: 'Người dùng', avatar: undefined };
      }
    }
    return { name: 'Người dùng', avatar: undefined };
  };

  const handleConversationClick = (conv: Conversation) => {
    setActiveConversation(conv);
    if (conv.isAiBot) {
      useChatStore.getState().setActiveContactInfo({ name: 'Bếp AI 🍜', avatarUrl: undefined });
    } else {
      const { name, avatar } = getOtherParticipant(conv);
      useChatStore.getState().setActiveContactInfo({ name, avatarUrl: avatar });
    }
  };

  const handleContactClick = (contact: ContactResponse) => {
    const existing = conversations.find(c =>
      !c.isGroup && c.participants.some((p: any) =>
        p.id == contact.contactUserId || p.userId == contact.contactUserId || p.contactUserId == contact.contactUserId
      )
    );
    const contactInfo = { name: contact.fullName, avatarUrl: contact.avatarUrl };
    if (existing) {
      setActiveConversation(existing);
    } else {
      setActiveConversation({ conversationId: `new_${contact.contactUserId}`, participants: [contact], isGroup: false });
    }
    useChatStore.getState().setActiveContactInfo(contactInfo);
  };

  const filteredConversations = conversations.filter(conv => {
    if (filter === 'unread' && (!conv.unreadCount || conv.unreadCount === 0)) return false;
    if (searchText) {
      const { name } = getOtherParticipant(conv);
      return name.toLowerCase().includes(searchText.toLowerCase());
    }
    return true;
  });

  return (
    <div className="w-80 h-full flex flex-col z-20 theme-transition"
      style={{ background: 'var(--bg-panel)', borderRight: '1px solid var(--border-primary)' }}>

      {/* Search Header */}
      <div className="p-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: 'none' }}
            placeholder="Tìm kiếm..."
          />
        </div>
        <button
          onClick={() => setIsSearchModalOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Thêm bạn"
        >
          <UserPlus size={20} />
        </button>
        <button
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Tạo nhóm"
        >
          <UsersIcon size={20} />
        </button>
      </div>

      {/* Filter Tabs — Zalo exact */}
      <div className="flex items-center px-3 py-2 text-sm" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-1 flex-1">
          {[
            { key: 'all' as const, label: 'Tất cả' },
            { key: 'unread' as const, label: 'Chưa đọc' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: filter === tab.key ? 'var(--bg-active)' : 'transparent',
                color: filter === tab.key ? 'var(--text-accent)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}

          {/* Phân loại dropdown */}
          <button className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            Phân loại
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1L5 5L9 1" />
            </svg>
          </button>
        </div>

        {/* More options */}
        <button className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Thêm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="19" cy="12" r="2"/>
          </svg>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>Đang tải...</div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => {
            const { name: displayName, avatar } = getOtherParticipant(conv);
            const isActive = activeConversation?.conversationId === conv.conversationId;
            const hasUnread = (conv.unreadCount || 0) > 0;

            const handleItemClick = () => {
              handleConversationClick(conv);
              if (hasUnread) {
                useChatStore.getState().markAsRead(conv.conversationId);
              }
            };

            return (
              <div
                key={conv.conversationId}
                onClick={handleItemClick}
                className="flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors"
                style={{ background: isActive ? 'var(--bg-active)' : 'transparent' }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden"
                  style={{
                    background: conv.isAiBot
                      ? 'linear-gradient(135deg, #f97316, #ea580c)'
                      : (avatar ? 'transparent' : '#0068FF')
                  }}>
                  {conv.isAiBot ? (
                    <span className="text-2xl">🍜</span>
                  ) : avatar ? (
                    <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-semibold'}`} style={{ color: 'var(--text-primary)' }}>{displayName}</h3>
                      {conv.isAiBot && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>AI</span>
                      )}
                    </div>
                    <span className={`text-[11px] shrink-0 ml-2 ${hasUnread ? 'font-bold text-blue-500' : ''}`} style={{ color: hasUnread ? '' : 'var(--text-secondary)' }}>
                      {conv.lastMessage?.timestamp
                        ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                  <p className={`text-[13px] truncate ${hasUnread ? 'font-semibold' : ''}`} style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {typeof conv.lastMessage === 'object' && conv.lastMessage !== null
                      ? (conv.lastMessage as any).content
                      : (conv.lastMessage as string) || 'Chưa có tin nhắn'}
                  </p>
                </div>
                {hasUnread && (
                  <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {conv.unreadCount! > 9 ? '9+' : conv.unreadCount}
                  </div>
                )}
              </div>
            );
          })
        ) : contacts.length > 0 && !searchText ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wider px-4 py-3 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Gợi ý bắt đầu trò chuyện
            </div>
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden"
                  style={{ background: contact.avatarUrl ? 'transparent' : '#0068FF' }}>
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{(contact.fullName || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{contact.fullName}</h3>
                  <p className="text-[13px] truncate" style={{ color: 'var(--text-accent)' }}>Bắt đầu trò chuyện</p>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            {searchText ? 'Không tìm thấy kết quả' : 'Chưa có cuộc trò chuyện nào'}
          </div>
        )}
      </div>

      <SearchUserModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onUserAdded={() => contactService.getContacts(0, 50).then(res => setContacts(res.content)).catch(console.error)}
      />
    </div>
  );
};

export default MessageListPanel;
