import { MessageSquare, Users, CloudLightning, ClipboardList, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { contactService } from '../services/contactService';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';

const NavigationSidebar = () => {
  const { user, token, setUser } = useAuthStore();
  const { isDark } = useThemeStore();
  const { openSettings } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

      {/* Settings Button — opens Settings Side Panel */}
      <div className="flex flex-col w-full gap-1 mt-auto">
        <button
          onClick={openSettings}
          className="w-full py-3 flex justify-center items-center transition-all"
          style={{ color: 'var(--text-sidebar-icon)' }}
          title="Cài đặt"
        >
          <Settings size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
      />

      {/* Settings Side Panel */}
      <SettingsModal />
    </div>
  );
};

export default NavigationSidebar;
