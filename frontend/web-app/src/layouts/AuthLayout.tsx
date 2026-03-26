import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-animated-gradient flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40"></div>

      <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl relative z-10 border border-white/50 ring-1 ring-black/5">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-slate-800 tracking-tight">
            Zalo Clone
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 font-medium">
            Kết nối mọi người, nhanh chóng và bảo mật.
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
