import { X, Bell, Pin, UserPlus, Clock, Users, Image as ImageIcon, FileText, Link, Shield, Eye, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

const ConversationInfoPanel = () => {
  const { activeConversation, activeContactInfo, toggleInfoPanel } = useChatStore();

  if (!activeConversation) return null;

  // Use resolved contact info from store
  const displayName = activeContactInfo?.name || 'Người dùng';
  const displayAvatar = activeContactInfo?.avatarUrl;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="w-80 h-full flex flex-col border-l theme-transition overflow-hidden shrink-0"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-primary)' }}>

      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          Thông tin hội thoại
        </h3>
        <button onClick={toggleInfoPanel}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Section */}
        <div className="flex flex-col items-center py-5 px-4"
          style={{ borderBottom: '6px solid var(--border-light)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white overflow-hidden mb-3"
            style={{ background: displayAvatar ? 'transparent' : '#0068FF' }}>
            {displayAvatar ? (
              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              avatarLetter
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </span>
            <button className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-6 py-4 px-4"
          style={{ borderBottom: '6px solid var(--border-light)' }}>
          {[
            { icon: Bell, label: 'Tắt thông\nbáo' },
            { icon: Pin, label: 'Ghim hội\nthoại' },
            { icon: UserPlus, label: 'Tạo nhóm\ntrò chuyện' },
          ].map(({ icon: Icon, label }, i) => (
            <button key={i} className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-hover)' }}>
                <Icon size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <span className="text-[11px] text-center leading-tight whitespace-pre-line"
                style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Info Items */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Danh sách nhắc hẹn</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>1 nhóm chung</span>
          </button>
        </div>

        {/* Ảnh/Video Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ảnh/Video</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="px-4 py-2">
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded-md overflow-hidden"
                  style={{ background: 'var(--bg-hover)' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={16} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full py-2 mt-2 rounded-lg text-sm font-medium transition-colors text-center"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
              Xem tất cả
            </button>
          </div>
        </div>

        {/* File Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>File</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="px-4 py-2 text-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Chưa có File được chia sẻ trong hội thoại này
            </p>
          </div>
        </div>

        {/* Link Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Link</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="px-4 py-2 text-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Chưa có Link được chia sẻ trong hội thoại này
            </p>
          </div>
        </div>

        {/* Thiết lập bảo mật */}
        <div className="py-2">
          <div className="px-4 py-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Thiết lập bảo mật
            </span>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Shield size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="flex-1">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Tin nhắn tự xóa</span>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Không bao giờ</p>
            </div>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="flex items-center gap-3">
              <Eye size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Ẩn trò chuyện</span>
            </div>
            <div className="w-9 h-5 rounded-full relative transition-colors" style={{ background: 'var(--bg-hover)' }}>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" />
            </div>
          </button>

          <div className="mt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <AlertTriangle size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Báo xấu</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Trash2 size={18} style={{ color: '#ef4444' }} />
              <span className="text-sm" style={{ color: '#ef4444' }}>Xoá lịch sử trò chuyện</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationInfoPanel;
