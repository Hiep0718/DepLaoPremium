import { MessageSquare, Users, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

const NavigationSidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentTab = location.pathname.startsWith('/contacts') ? 'contacts' : 'messages';

  return (
    <div className="w-16 md:w-20 h-full bg-blue-600 flex flex-col items-center py-4 relative z-30 shadow-lg">
      {/* User Avatar */}
      <div className="mb-6 relative group cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-xl shadow-md border-2 border-transparent group-hover:border-blue-300 transition-all">
          U
        </div>
        <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-blue-600 rounded-full"></div>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col w-full gap-2">
        <button 
          onClick={() => navigate('/')}
          className={`w-full py-4 flex justify-center items-center transition-colors relative group ${currentTab === 'messages' ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-500 hover:text-white'}`}
          title="Tin nhắn"
        >
          {currentTab === 'messages' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white"></div>}
          <MessageSquare size={24} />
        </button>

        <button 
          onClick={() => navigate('/contacts')}
          className={`w-full py-4 flex justify-center items-center transition-colors relative group ${currentTab === 'contacts' ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-500 hover:text-white'}`}
          title="Danh bạ"
        >
          {currentTab === 'contacts' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white"></div>}
          <Users size={24} />
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col w-full gap-2 mt-auto">
        <button 
          className="w-full py-4 flex justify-center items-center text-blue-200 hover:bg-blue-500 hover:text-white transition-colors"
          title="Cài đặt"
        >
          <Settings size={24} />
        </button>

        <button 
          onClick={handleLogout}
          className="w-full py-4 flex justify-center items-center text-blue-200 hover:bg-red-500 hover:text-white transition-colors"
          title="Đăng xuất"
        >
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
};

export default NavigationSidebar;
