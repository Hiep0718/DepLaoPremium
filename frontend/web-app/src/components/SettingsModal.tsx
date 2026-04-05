import { useState, useEffect, useRef } from 'react';
import {
  X, Palette, MessageCircle, Bell, UserCircle, ChevronRight, RotateCcw,
  Sun, Moon, Monitor, Check, Type, Image, CircleDot, Clock, Volume2, Eye, LogOut
} from 'lucide-react';
import {
  useSettingsStore,
  ACCENT_COLORS,
  FONT_SIZE_MAP,
  CHAT_WALLPAPERS,
  type AccentColor,
  type FontSize,
  type ThemeMode,
  type ChatWallpaper,
  type BubbleStyle,
} from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useNavigate } from 'react-router-dom';
import ProfileModal from './ProfileModal';

type TabKey = 'appearance' | 'chat' | 'notifications' | 'account';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<any>;
}

const TABS: TabDef[] = [
  { key: 'appearance', label: 'Giao diện', icon: Palette },
  { key: 'chat', label: 'Trò chuyện', icon: MessageCircle },
  { key: 'notifications', label: 'Thông báo', icon: Bell },
  { key: 'account', label: 'Tài khoản', icon: UserCircle },
];

// ===== Toggle Switch =====
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
    style={{ background: checked ? 'var(--accent-primary)' : 'var(--border-primary)' }}
  >
    <span
      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200"
      style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
    />
  </button>
);

// ===== Section Header =====
const SectionHeader = ({ title, onReset }: { title: string; onReset?: () => void }) => (
  <div className="flex items-center justify-between mb-4 mt-2">
    <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
      {title}
    </h3>
    {onReset && (
      <button
        onClick={onReset}
        className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <RotateCcw size={12} />
        Mặc định
      </button>
    )}
  </div>
);

// ===== Setting Row =====
const SettingRow = ({ icon: Icon, label, description, children }: {
  icon: React.ComponentType<any>; label: string; description?: string; children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3 px-1 gap-4">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--bg-hover)' }}>
        <Icon size={16} style={{ color: 'var(--accent-primary)' }} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        {description && (
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{description}</div>
        )}
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

// ===== APPEARANCE TAB =====
const AppearanceTab = () => {
  const { settings, updateSettings, resetSection } = useSettingsStore();

  const themeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<any> }[] = [
    { value: 'light', label: 'Sáng', icon: Sun },
    { value: 'dark', label: 'Tối', icon: Moon },
    { value: 'system', label: 'Hệ thống', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Chế độ giao diện" onReset={() => resetSection('appearance')} />

      {/* Theme Mode */}
      <div className="space-y-2 px-1">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Chủ đề</div>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const isActive = settings.themeMode === value;
            return (
              <button
                key={value}
                onClick={() => updateSettings({ themeMode: value })}
                className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all duration-200 border-2"
                style={{
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-primary)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <Icon size={20} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                <span className="text-xs font-medium" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-2 px-1">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Màu chủ đạo</div>
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(ACCENT_COLORS) as [AccentColor, typeof ACCENT_COLORS[AccentColor]][]).map(([key, color]) => {
            const isActive = settings.accentColor === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ accentColor: key })}
                className="flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all duration-200"
                style={{ background: isActive ? color.light : 'transparent' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200"
                  style={{
                    background: color.primary,
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: isActive ? `0 0 0 3px ${color.light}, 0 0 0 5px ${color.primary}` : 'none',
                  }}
                >
                  {isActive && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-[10px] font-medium" style={{ color: isActive ? color.primary : 'var(--text-secondary)' }}>
                  {color.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-2 px-1">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Cỡ chữ</div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(FONT_SIZE_MAP) as [FontSize, typeof FONT_SIZE_MAP[FontSize]][]).map(([key, font]) => {
            const isActive = settings.fontSize === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ fontSize: key })}
                className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all duration-200 border-2"
                style={{
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-primary)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <Type size={key === 'small' ? 14 : key === 'medium' ? 18 : 22}
                  style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                <span className="text-xs font-medium" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {font.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Preview */}
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
          <p style={{ fontSize: FONT_SIZE_MAP[settings.fontSize].base, color: 'var(--text-primary)' }}>
            Xin chào! Đây là bản xem trước cỡ chữ.
          </p>
          <p className="mt-1" style={{ fontSize: FONT_SIZE_MAP[settings.fontSize].sm, color: 'var(--text-secondary)' }}>
            Nội dung phụ sẽ hiển thị như thế này.
          </p>
        </div>
      </div>
    </div>
  );
};

// ===== CHAT TAB =====
const ChatTab = () => {
  const { settings, updateSettings, resetSection, isDark } = useSettingsStore();

  const bubbleOptions: { value: BubbleStyle; label: string; borderRadius: string }[] = [
    { value: 'modern', label: 'Hiện đại', borderRadius: '18px' },
    { value: 'classic', label: 'Cổ điển', borderRadius: '8px' },
    { value: 'minimal', label: 'Tối giản', borderRadius: '4px' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Tùy chỉnh trò chuyện" onReset={() => resetSection('chat')} />

      {/* Chat Wallpaper */}
      <div className="space-y-2 px-1">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          <div className="flex items-center gap-2">
            <Image size={16} style={{ color: 'var(--accent-primary)' }} />
            Hình nền trò chuyện
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(CHAT_WALLPAPERS) as [ChatWallpaper, typeof CHAT_WALLPAPERS[ChatWallpaper]][]).map(([key, wp]) => {
            const isActive = settings.chatWallpaper === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ chatWallpaper: key })}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className="w-full aspect-[3/4] rounded-lg transition-all duration-200 border-2 relative overflow-hidden"
                  style={{
                    background: wp.preview,
                    borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-primary)',
                    boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : 'none',
                  }}
                >
                  {/* Mini message bubbles preview */}
                  <div className="absolute inset-2 flex flex-col justify-end gap-1">
                    <div className="self-start w-3/4 h-2 rounded-full opacity-40" style={{ background: isDark ? '#334155' : '#ffffff' }} />
                    <div className="self-end w-2/3 h-2 rounded-full opacity-50" style={{ background: 'var(--accent-primary)' }} />
                  </div>
                  {isActive && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent-primary)' }}>
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {wp.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bubble Style */}
      <div className="space-y-2 px-1">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          <div className="flex items-center gap-2">
            <CircleDot size={16} style={{ color: 'var(--accent-primary)' }} />
            Kiểu bong bóng tin nhắn
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {bubbleOptions.map(({ value, label, borderRadius }) => {
            const isActive = settings.bubbleStyle === value;
            return (
              <button
                key={value}
                onClick={() => updateSettings({ bubbleStyle: value })}
                className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-200 border-2"
                style={{
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-primary)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                }}
              >
                {/* Mini preview bubbles */}
                <div className="flex flex-col gap-1 items-center w-full px-3">
                  <div className="self-start px-2 py-1 text-[8px]"
                    style={{
                      borderRadius,
                      background: isDark ? '#334155' : '#ffffff',
                      color: 'var(--text-primary)',
                      border: value === 'minimal' ? '1px solid var(--border-primary)' : 'none',
                      backgroundColor: value === 'minimal' ? 'transparent' : undefined,
                    }}>
                    Xin chào
                  </div>
                  <div className="self-end px-2 py-1 text-[8px] text-white"
                    style={{
                      borderRadius,
                      background: value === 'minimal' ? 'transparent' : 'var(--accent-primary)',
                      color: value === 'minimal' ? 'var(--accent-primary)' : '#fff',
                      border: value === 'minimal' ? '1px solid var(--accent-primary)' : 'none',
                    }}>
                    Hi!
                  </div>
                </div>
                <span className="text-xs font-medium" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Show Message Time */}
      <SettingRow icon={Clock} label="Hiện thời gian tin nhắn" description="Hiển thị thời gian dưới mỗi tin nhắn">
        <Toggle checked={settings.showMessageTime} onChange={(v) => updateSettings({ showMessageTime: v })} />
      </SettingRow>
    </div>
  );
};

// ===== NOTIFICATIONS TAB =====
const NotificationsTab = () => {
  const { settings, updateSettings, resetSection } = useSettingsStore();

  return (
    <div className="space-y-6">
      <SectionHeader title="Cài đặt thông báo" onReset={() => resetSection('notifications')} />

      <div className="space-y-1">
        <SettingRow icon={Bell} label="Thông báo tin nhắn" description="Nhận thông báo khi có tin nhắn mới">
          <Toggle checked={settings.notifyMessages} onChange={(v) => updateSettings({ notifyMessages: v })} />
        </SettingRow>

        <div style={{ borderTop: '1px solid var(--border-light)' }} />

        <SettingRow icon={Volume2} label="Âm thanh thông báo" description="Phát âm thanh khi nhận thông báo">
          <Toggle checked={settings.notifySound} onChange={(v) => updateSettings({ notifySound: v })} />
        </SettingRow>

        <div style={{ borderTop: '1px solid var(--border-light)' }} />

        <SettingRow icon={Eye} label="Xem trước tin nhắn" description="Hiện nội dung tin nhắn trong thông báo">
          <Toggle checked={settings.notifyPreview} onChange={(v) => updateSettings({ notifyPreview: v })} />
        </SettingRow>
      </div>

      {/* Notification Status */}
      <div className="mx-1 p-3 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Bell size={14} />
          <span>
            {settings.notifyMessages
              ? 'Bạn sẽ nhận được thông báo cho tin nhắn mới'
              : 'Thông báo đã tắt — bạn sẽ không nhận được thông báo'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ===== ACCOUNT TAB =====
const AccountTab = ({ onOpenProfile, onLogout }: { onOpenProfile: () => void; onLogout: () => void }) => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <SectionHeader title="Tài khoản" />

      {/* User Info Card */}
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl overflow-hidden flex-shrink-0"
          style={{ background: user?.avatarUrl ? 'transparent' : 'var(--accent-primary)' }}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white">{user?.fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {user?.fullName || 'Người dùng'}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {user?.email || user?.phone || ''}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1">
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center justify-between py-3 px-3 rounded-xl transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
              <UserCircle size={16} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <span className="text-sm font-medium">Thông tin tài khoản</span>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div style={{ borderTop: '1px solid var(--border-light)' }} />

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 py-3 px-3 rounded-xl transition-colors"
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <LogOut size={16} style={{ color: '#ef4444' }} />
          </div>
          <span className="text-sm font-medium">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};

// ===== MAIN SETTINGS MODAL =====
const SettingsModal = () => {
  const { isSettingsOpen, closeSettings } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      setIsAnimating(true);
    }
  }, [isSettingsOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(closeSettings, 250);
  };

  const handleLogout = () => {
    useChatStore.getState().clearChat();
    logout();
    closeSettings();
    navigate('/login');
  };

  // Outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'appearance': return <AppearanceTab />;
      case 'chat': return <ChatTab />;
      case 'notifications': return <NotificationsTab />;
      case 'account': return (
        <AccountTab
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
        />
      );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] transition-opacity duration-250"
        style={{
          background: 'rgba(0,0,0,0.3)',
          opacity: isAnimating ? 1 : 0,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Side Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-[101] flex flex-col theme-transition"
        style={{
          width: '420px',
          maxWidth: '90vw',
          background: 'var(--bg-panel)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Cài đặt</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-3 py-2 gap-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200"
                style={{
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--accent-light)' : 'transparent'; }}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {renderTab()}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-center text-xs flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
        >
          Zalo clone v1.0 • Cài đặt lưu tự động theo tài khoản
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
      />
    </>
  );
};

export default SettingsModal;
