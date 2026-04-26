import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatDesk from './pages/ChatDesk';
import JoinGroup from './pages/JoinGroup';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/chat/ToastContainer';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';

import CallManager from './components/call/CallManager';
import GroupCallManager from './components/call/GroupCallManager';
import { useFaviconBadge } from './hooks/useFaviconBadge';

function App() {
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const { loadSettings } = useSettingsStore();

  // Dynamic favicon badge with unread count
  useFaviconBadge();

  // Apply dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Load user-specific settings when user changes (login/logout)
  useEffect(() => {
    if (user?.id) {
      loadSettings(String(user.id));
    }
  }, [user?.id, loadSettings]);

  return (
    <>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<ChatDesk />} />
              <Route path="/chat" element={<ChatDesk />} />
              <Route path="/contacts" element={<ChatDesk />} />
              <Route path="/join/:inviteCode" element={<JoinGroup />} />
            </Route>
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      {/* Global Toast Notifications */}
      <ToastContainer />
      
      {/* Global WebRTC Calling UI */}
      {user && (
        <>
          <CallManager />
          <GroupCallManager />
        </>
      )}
    </>
  );
}

export default App;

