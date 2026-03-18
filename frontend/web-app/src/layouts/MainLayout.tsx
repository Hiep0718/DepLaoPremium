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
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-800">
      {/* Cột 1: Navigation Sidebar (Chỉ chứa icon) */}
      <NavigationSidebar />
      
      {/* Cột 2: Left Panel (Danh sách tin nhắn hoặc danh bạ) */}
      {isContacts ? <ContactListPanel /> : <MessageListPanel />}
      
      {/* Cột 3: Right Panel (Main Content / Chat Desk) */}
      <div className="flex-1 flex flex-col relative h-full bg-white z-10">
        <div className="absolute inset-0 z-0 bg-[url('https://cdn.pixabay.com/photo/2021/11/04/19/39/jigsaw-6769265_1280.png')] opacity-5 bg-repeat size-full bg-[length:400px]"></div>
        <div className="relative z-10 flex-1 flex flex-col h-full bg-slate-50/90 backdrop-blur-sm shadow-inner overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
