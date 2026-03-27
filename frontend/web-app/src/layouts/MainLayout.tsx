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
    <div className="flex h-screen overflow-hidden font-sans theme-transition"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Col 1: Navigation Sidebar */}
      <NavigationSidebar />

      {/* Col 2: Left Panel */}
      {isContacts ? <ContactListPanel /> : <MessageListPanel />}

      {/* Col 3: Chat Area (only when not in contacts full-view) */}
      {!isContacts && (
        <div className="flex-1 flex flex-col relative h-full z-10 theme-transition"
          style={{ borderLeft: '1px solid var(--border-primary)' }}>
          <Outlet />
        </div>
      )}
    </div>
  );
};

export default MainLayout;
