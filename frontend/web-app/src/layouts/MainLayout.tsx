import { Outlet, useLocation } from 'react-router-dom';
import NavigationSidebar from '../components/NavigationSidebar';
import MessageListPanel from '../components/MessageListPanel';
import ContactListPanel from '../components/ContactListPanel';
import { useSocketSetup } from '../hooks/useSocket';

const MainLayout = () => {
  useSocketSetup();
  const location = useLocation();
  const isContacts = location.pathname.startsWith('/contacts');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 selection:bg-indigo-500/30">
      {/* Cột 1: Navigation Sidebar (Chỉ chứa icon) */}
      <NavigationSidebar />
      
      {/* Cột 2: Left Panel (Danh sách tin nhắn hoặc danh bạ) */}
      {isContacts ? <ContactListPanel /> : <MessageListPanel />}
      
      {/* Cột 3: Right Panel (Main Content / Chat Desk) */}
      <div className="flex-1 flex flex-col relative h-full bg-[#E4DDD6] border-l border-slate-100 z-10">
        <div className="absolute inset-0 z-0 opacity-[0.08] mix-blend-multiply bg-[url('https://i.pinimg.com/originals/8f/ba/cb/8fbacbd464e996966eb9d4a6b7a9c21e.jpg')] bg-repeat bg-[length:400px]"></div>
        <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
