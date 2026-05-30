import { Phone, Video, Search, PanelRightOpen, PanelRightClose, Loader2, Users, MoreHorizontal, Cloud } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useCallStore } from '../../stores/callStore';
import { useAuthStore } from '../../stores/authStore';

import { socket } from '../../services/socket';

const ChatHeader = () => {
  const activeConversation = useChatStore((state) => state.activeConversation);
  const activeContactInfo = useChatStore((state) => state.activeContactInfo);
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const toggleInfoPanel = useChatStore((state) => state.toggleInfoPanel);
  const toggleSearchPanel = useChatStore((state) => state.toggleSearchPanel);

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

  // Detect AI conversation
  const isAiConversation = activeConversation?.conversationId?.startsWith('ai_');
  // Detect Cloud conversation
  const isCloudConversation = activeConversation?.conversationId?.startsWith('cloud_');
  const isAiStreaming = useChatStore((s) => s.isAiStreaming);

  // Use resolved contact info from store, with fallbacks

  const displayName = isCloudConversation
    ? 'My Documents'
    : isAiConversation 
      ? 'Bếp AI 🍜' 
      : (activeConversation?.isGroup 
          ? (activeConversation.groupName || 'Nhóm trò chuyện') 
          : (activeContactInfo?.name || contact?.nickname || contact?.fullName || 'Chọn cuộc trò chuyện'));

  const contactAvatarUrl = isAiConversation 
    ? undefined 
    : (activeConversation?.isGroup 
        ? activeConversation.groupAvatar 
        : (activeContactInfo?.avatarUrl || contact?.avatarUrl));

  const avatarLetter = displayName.charAt(0).toUpperCase();

  // imports will be patched next
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);

  const startCall = async (isVideo: boolean) => {
    const conversationId = activeConversation?.conversationId || activeConversation?._id || (activeConversation as any)?.id;
    const currentUser = useAuthStore.getState().user;
    const callerInfo = {
      id: currentUser?.id?.toString() || 'me',
      fullName: currentUser?.fullName || 'Người dùng',
      avatarUrl: currentUser?.avatarUrl || ''
    };

    if (activeConversation?.isGroup) {
      // Logic gọi nhóm
      const { setOutgoingCall: setGroupOutgoingCall } = await import('../../stores/groupCallStore').then(m => m.useGroupCallStore.getState());
      setGroupOutgoingCall(conversationId, String(user?.id || user?._id), isVideo);
      socket.emit('group_call_start', { conversationId, callerInfo, isVideo });
      socket.emit('group_call_join', { conversationId });
      return;
    }

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

    setOutgoingCall(recipientId, { id: recipientId, fullName: displayName, avatarUrl: contactAvatarUrl }, isVideo, conversationId);
    socket.emit('call_request', { recipientId, callerInfo, isVideo, conversationId });
  };


  return (
    <div className="h-[60px] px-4 flex items-center justify-between sticky top-0 z-10 theme-transition shrink-0"
      style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-3 cursor-pointer group">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
          style={{
            background: isCloudConversation
              ? 'linear-gradient(135deg, #0068FF, #00A2FF)'
              : isAiConversation
                ? 'linear-gradient(135deg, #f97316, #ea580c)'
                : (contactAvatarUrl ? 'transparent' : '#0068FF'),
            boxShadow: isAiConversation ? '0 2px 8px rgba(249,115,22,0.4)' : undefined,
          }}>
          {isCloudConversation ? (
            <Cloud size={20} className="text-white" />
          ) : isAiConversation ? (
            <span className="text-xl">🍜</span>
          ) : contactAvatarUrl ? (
            <img src={contactAvatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">{avatarLetter}</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[15px] leading-tight group-hover:underline flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </h2>
            {isAiConversation && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>AI</span>
            )}
          </div>
          {isAiConversation ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              {isAiStreaming ? (
                <span className="text-xs flex items-center gap-1" style={{ color: '#f97316' }}>
                  <Loader2 size={10} className="animate-spin" /> Đang trả lời...
                </span>
              ) : (
                <span className="text-xs" style={{ color: '#f97316' }}>Trợ lý ẩm thực • Online</span>
              )}
            </div>
          ) : isCloudConversation ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lưu và đồng bộ dữ liệu giữa các thiết bị | 📂</span>
            </div>
          ) : activeConversation?.isGroup ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Users size={12} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {activeConversation.participants?.length || 0} thành viên
              </span>
            </div>
          ) : contact && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Truy cập gần đây
              </span>
              <span className="text-xs opacity-40" style={{ color: 'var(--text-secondary)' }}>▶</span>
            </div>
          )}
        </div>
      </div>

      {isAiConversation ? (
        <div className="flex items-center gap-0.5">
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
            title="Thông tin hội thoại AI"
          >
            {isInfoPanelOpen ? <PanelRightClose size={20} strokeWidth={1.5} /> : <PanelRightOpen size={20} strokeWidth={1.5} />}
          </button>
        </div>
      ) : isCloudConversation ? (
        /* Cloud: chỉ hiện nút Search & Info panel, không gọi thoại/video */
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => alert("Tìm kiếm tin nhắn trong My Documents")}
            className="p-2.5 rounded-lg transition-all duration-150 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Tìm kiếm tin nhắn"
          >
            <Search size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={toggleInfoPanel}
            className="p-2.5 rounded-lg transition-all duration-150 cursor-pointer"
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
            title="Thông tin My Documents"
          >
            {isInfoPanelOpen ? <PanelRightClose size={20} strokeWidth={1.5} /> : <PanelRightOpen size={20} strokeWidth={1.5} />}
          </button>
        </div>
      ) : contact && (
        <div className="flex items-center gap-0.5">
          {[
            { Icon: Phone, title: 'Gọi thoại', onClick: () => startCall(false) },
            { Icon: Video, title: 'Gọi video', onClick: () => startCall(true) },
            { Icon: Search, title: 'Tìm kiếm tin nhắn', onClick: toggleSearchPanel },
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

          {/* More menu button (Zalo style) */}
          <button className="p-2.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Thêm"
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
