import { Phone, Video, Search, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

const ChatHeader = () => {
  const activeConversation = useChatStore((state) => state.activeConversation);
  const activeContactInfo = useChatStore((state) => state.activeContactInfo);
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const toggleInfoPanel = useChatStore((state) => state.toggleInfoPanel);

  const contact = activeConversation?.participants?.[0];
  // Use resolved contact info from store, with fallbacks
  const displayName = activeContactInfo?.name || contact?.nickname || contact?.fullName || 'Chọn cuộc trò chuyện';
  const contactAvatarUrl = activeContactInfo?.avatarUrl || contact?.avatarUrl;
  const avatarLetter = displayName.charAt(0).toUpperCase();

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
            { Icon: Phone, title: 'Gọi thoại' },
            { Icon: Video, title: 'Gọi video' },
            { Icon: Search, title: 'Tìm kiếm tin nhắn' },
          ].map(({ Icon, title }, i) => (
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
