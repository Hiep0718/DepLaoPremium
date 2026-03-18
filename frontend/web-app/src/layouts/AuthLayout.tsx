import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[url('https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=3000')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      <div className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl relative z-10 border border-white/20">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-blue-600 tracking-tight">
            Zalo Clone
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Kết nối mọi người, nhanh chóng và bảo mật.
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
