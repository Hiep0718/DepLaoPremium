import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import { useAuthStore } from '../stores/authStore';
import { contactService } from '../services/contactService';
import { LogIn, Phone, Lock } from 'lucide-react';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Vui lòng nhập số điện thoại và mật khẩu');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post('/auth/login', { phone, password });
      if (data.success) {
        // Save both tokens so auto-refresh works
        sessionStorage.setItem('accessToken', data.data.accessToken);
        if (data.data.refreshToken) {
          sessionStorage.setItem('refreshToken', data.data.refreshToken);
        }
        
        // Fetch full user profile (id, fullName, avatarUrl) from MariaDB
        try {
          const profile = await contactService.getUserProfile();
          setAuth(profile, data.data.accessToken);
        } catch {
          // Fallback: save minimal user info if profile fetch fails
          setAuth({ phone }, data.data.accessToken);
        }
        
        navigate('/');
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center font-medium border border-red-100">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            id="phone"
            name="phone"
            type="text"
            required
            className="appearance-none bg-white/50 rounded-2xl relative block w-full pl-11 px-4 py-3.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all shadow-sm"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="appearance-none bg-white/50 rounded-2xl relative block w-full pl-11 px-4 py-3.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all shadow-sm"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-md overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out"></div>
          <span className="absolute left-0 inset-y-0 flex items-center pl-4">
            <LogIn className="h-5 w-5 text-indigo-200 group-hover:text-white transition-colors" />
          </span>
          <span className="relative z-10">{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
        </button>
      </div>
      
      <div className="flex items-center justify-between text-sm mt-4">
        <span className="text-gray-600">Chưa có tài khoản?</span>
        <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
          Đăng ký ngay
        </Link>
      </div>
    </form>
  );
};

export default Login;
