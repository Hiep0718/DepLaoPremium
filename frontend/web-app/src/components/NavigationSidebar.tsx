import { MessageSquare, Users, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { contactService } from '../services/contactService';
import ProfileModal from './ProfileModal';

const NavigationSidebar = () => {
  const { user, token, setUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (token && (!user || !user.id)) {
        try {
          const profile = await contactService.getUserProfile();
          setUser(profile);
        } catch (error) {
          console.error("Failed to fetch profile", error);
        }
      }
    };
    fetchProfile();
  }, [token, user, setUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentTab = location.pathname.startsWith('/contacts') ? 'contacts' : 'messages';

  // Get first letter of full name for avatar fallback
  const avatarLetter = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';

  return (
    <div className="w-16 md:w-20 h-full bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 relative z-30 shadow-2xl">
      {/* User Avatar */}
      <div 
        className="mb-6 relative group cursor-pointer" 
        title={user?.fullName || 'User Profile'}
        onClick={() => setIsProfileModalOpen(true)}
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-indigo-400 flex items-center justify-center font-bold text-xl shadow-lg shadow-black/20 border border-slate-700 group-hover:border-indigo-400 transition-all overflow-hidden">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            avatarLetter
          )}
        </div>
        <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-blue-600 rounded-full"></div>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col w-full gap-2">
        <button 
          onClick={() => navigate('/')}
          className={`w-full py-4 flex justify-center items-center transition-all relative group ${currentTab === 'messages' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
          title="Tin nhắn"
        >
          {currentTab === 'messages' && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
          <MessageSquare size={24} />
        </button>

        <button 
          onClick={() => navigate('/contacts')}
          className={`w-full py-4 flex justify-center items-center transition-all relative group ${currentTab === 'contacts' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
          title="Danh bạ"
        >
          {currentTab === 'contacts' && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
          <Users size={24} />
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col w-full gap-2 mt-auto">
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="w-full py-4 flex justify-center items-center text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all"
          title="Hồ sơ cá nhân"
        >
          <Settings size={24} />
        </button>

        <button 
          onClick={handleLogout}
          className="w-full py-4 flex justify-center items-center text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="Đăng xuất"
        >
          <LogOut size={24} />
        </button>
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
