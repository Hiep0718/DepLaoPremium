import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-animated-gradient flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-30"></div>

      {/* Content wrapper without arbitrary width restriction */}
      <div className="w-full flex items-center justify-center relative z-20 animate-fadeIn">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
