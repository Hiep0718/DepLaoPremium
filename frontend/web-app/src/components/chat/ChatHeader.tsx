import { Phone, Video, Search, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useCallStore } from '../../stores/callStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';

const ChatHeader = () => {
  const activeConversation = useChatStore((state) => state.activeConversation);
  const activeContactInfo = useChatStore((state) => state.activeContactInfo);
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const toggleInfoPanel = useChatStore((state) => state.toggleInfoPanel);

  const user = useAuthStore((state) => state.user);
  const currentUserId = String(user?.id || user?._id);

  // 2. Fallback to activeConversation participants (filter out self)
  const conversationContact = activeConversation?.participants?.find(
    (p: any) => {
      const pId = typeof p === 'string' ? p : String(p?.userId || p?._id || p?.id);
      return pId !== currentUserId;
    }
  );

  const contact = activeContactInfo || conversationContact || activeConversation?.participants?.[0];
  // Use resolved contact info from store, with fallbacks
  const displayName = activeContactInfo?.name || contact?.nickname || contact?.fullName || 'Chọn cuộc trò chuyện';
  const contactAvatarUrl = activeContactInfo?.avatarUrl || contact?.avatarUrl;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);

  const startCall = (isVideo: boolean) => {
    let recipientId = null;
    
    // activeContactInfo doesn't contain an id, so we should always look in conversationContact first.
    const targetContact = conversationContact || activeConversation?.participants?.[0];
    
    if (typeof targetContact === 'string') {
       recipientId = targetContact;
    } else if (targetContact) {
       recipientId = targetContact.userId || targetContact._id || targetContact.id;
    }
    
    // Final fallback in case activeContactInfo somehow had it, or we fell back to 'contact'
    if (!recipientId && contact) {
      if (typeof contact === 'string') recipientId = contact;
      else recipientId = contact.userId || contact._id || contact.id;
    }
    
    if (!recipientId) {
       console.warn('[startCall] Cannot determine recipient ID from contact:', contact, 'or conversationContact:', conversationContact);
       return;
    }
    
    const conversationId = activeConversation?.conversationId || activeConversation?._id || (activeConversation as any)?.id;
    
    // Store my basic info
    const currentUser = useAuthStore.getState().user;
    const callerInfo = {
      id: currentUser?.id?.toString() || 'me',
      fullName: currentUser?.fullName || 'Người dùng',
      avatarUrl: currentUser?.avatarUrl || ''
    };
    
    setOutgoingCall(recipientId, { id: recipientId, fullName: displayName, avatarUrl: contactAvatarUrl }, isVideo, conversationId);
    socket.emit('call_request', { recipientId, callerInfo, isVideo, conversationId });
  };

  return (
    <div className="h-[60px] px-4 flex items-center justify-between sticky top-0 z-10 theme-transition shrink-0"
      style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-3 cursor-pointer group">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
          style={{ background: contactAvatarUrl ? 'transparent' : '#0068FF' }}>
          {contactAvatarUrl ? (
            <img src={contactAvatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">{avatarLetter}</span>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-[15px] leading-tight group-hover:underline" style={{ color: 'var(--text-primary)' }}>
            {displayName}
          </h2>
          {contact && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Truy cập gần đây
              </span>
              <span className="text-xs opacity-40" style={{ color: 'var(--text-secondary)' }}>▶</span>
            </div>
          )}
        </div>
      </div>

      {contact && (
        <div className="flex items-center gap-0.5">
          {[
            { Icon: Phone, title: 'Gọi thoại', onClick: () => startCall(false) },
            { Icon: Video, title: 'Gọi video', onClick: () => startCall(true) },
            { Icon: Search, title: 'Tìm kiếm tin nhắn' },
          ].map(({ Icon, title, onClick }, i) => (
            <button key={i} className="p-2.5 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onClick={onClick}
              title={title}
            >
              <Icon size={20} strokeWidth={1.5} />
            </button>
          ))}

          {/* Info Panel Toggle */}
          <button
            onClick={toggleInfoPanel}
            className="p-2.5 rounded-lg transition-all duration-150"
            style={{
              color: isInfoPanelOpen ? 'var(--text-accent)' : 'var(--text-secondary)',
              background: isInfoPanelOpen ? 'var(--bg-active)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isInfoPanelOpen) e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              if (!isInfoPanelOpen) e.currentTarget.style.background = 'transparent';
              if (!isInfoPanelOpen) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Thông tin hội thoại"
          >
            {isInfoPanelOpen ? <PanelRightClose size={20} strokeWidth={1.5} /> : <PanelRightOpen size={20} strokeWidth={1.5} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
