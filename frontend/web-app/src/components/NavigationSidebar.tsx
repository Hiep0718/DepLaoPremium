import { MessageSquare, Users, CloudLightning, ClipboardList, Settings, LogOut, User, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { contactService } from '../services/contactService';
import ProfileModal from './ProfileModal';

const NavigationSidebar = () => {
  const { user, token, setUser, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (token && (!user || !user.id)) {
        try {
          const profile = await contactService.getUserProfile();
          if (!cancelled) setUser(profile);
        } catch (error) {
          console.error("Failed to fetch profile", error);
        }
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Close settings menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentTab = location.pathname.startsWith('/contacts') ? 'contacts' : 'messages';
  const avatarLetter = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';

  const navItems = [
    { key: 'messages', icon: MessageSquare, path: '/', title: 'Tin nhắn' },
    { key: 'contacts', icon: Users, path: '/contacts', title: 'Danh bạ' },
    { key: 'cloud', icon: CloudLightning, path: '#', title: 'Cloud' },
    { key: 'tools', icon: ClipboardList, path: '#', title: 'Công cụ' },
  ];

  return (
    <div
      className="w-16 h-full flex flex-col items-center py-3 relative z-30 theme-transition"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* User Avatar */}
      <div
        className="mb-4 relative cursor-pointer group"
        title={user?.fullName || 'Hồ sơ'}
        onClick={() => setIsProfileModalOpen(true)}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden border-2 border-white/20 group-hover:border-white/50 transition-all"
          style={{ background: isDark ? '#283548' : 'rgba(255,255,255,0.2)' }}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xl">{avatarLetter}</span>
          )}
        </div>
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 rounded-full"
          style={{ borderColor: 'var(--bg-sidebar)' }}
        />
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col w-full gap-1">
        {navItems.map((item) => {
          const isActive = currentTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => item.path !== '#' && navigate(item.path)}
              className="w-full py-3 flex justify-center items-center transition-all relative group"
              title={item.title}
              style={{
                color: isActive ? 'var(--text-sidebar-icon-active)' : 'var(--text-sidebar-icon)',
                background: isActive ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)') : 'transparent',
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full"
                  style={{ background: isDark ? '#60a5fa' : '#ffffff' }}
                />
              )}
              <Icon size={24} strokeWidth={1.5} />
            </button>
          );
        })}
      </nav>

      {/* Settings Button */}
      <div className="flex flex-col w-full gap-1 mt-auto relative" ref={settingsRef}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-full py-3 flex justify-center items-center transition-all"
          style={{ color: 'var(--text-sidebar-icon)' }}
          title="Cài đặt"
        >
          <Settings size={24} strokeWidth={1.5} />
        </button>

        {/* Settings Popup Menu */}
        {isSettingsOpen && (
          <div
            className="absolute bottom-14 left-2 w-56 rounded-lg overflow-hidden z-50 theme-transition"
            style={{
              background: 'var(--bg-panel)',
              boxShadow: 'var(--shadow-popup)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <button
              onClick={() => { setIsProfileModalOpen(true); setIsSettingsOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <User size={18} style={{ color: 'var(--text-secondary)' }} />
              Thông tin tài khoản
            </button>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {isDark ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} style={{ color: 'var(--text-secondary)' }} />}
              {isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            </button>

            <div style={{ borderTop: '1px solid var(--border-primary)' }} />

            <button
              onClick={() => { handleLogout(); setIsSettingsOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
      />
    </div>
  );
};

export default NavigationSidebar;
