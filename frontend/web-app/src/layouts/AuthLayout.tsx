import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-animated-gradient flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-30"></div>

      <div className="max-w-md w-full space-y-8 p-10 rounded-2xl relative z-10 border theme-transition animate-fadeIn"
        style={{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-popup)',
        }}>
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold tracking-tight animate-title-reveal" style={{ color: 'var(--text-primary)' }}>
            Zalo Clone
          </h2>
          <p className="mt-3 text-center text-sm font-medium animate-subtitle-reveal" style={{ color: 'var(--text-secondary)' }}>
            Kết nối mọi người, nhanh chóng và bảo mật.
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
