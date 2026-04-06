import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ backgroundImage: "url('/backgroundZalo.jpg')" }}
    >
      {/* Content wrapper without arbitrary width restriction */}
      <div className="w-full flex items-center justify-center relative z-20 animate-fadeIn">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
