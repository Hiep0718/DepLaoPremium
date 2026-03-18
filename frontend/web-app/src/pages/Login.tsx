import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import { useAuthStore } from '../stores/authStore';
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
        setAuth({ phone }, data.data.accessToken);
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
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Phone className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="phone"
            name="phone"
            type="text"
            required
            className="appearance-none rounded-xl relative block w-full pl-10 px-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="appearance-none rounded-xl relative block w-full pl-10 px-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
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
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          <span className="absolute left-0 inset-y-0 flex items-center pl-3">
            <LogIn className="h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors" />
          </span>
          {loading ? 'Đang xử lý...' : 'Đăng nhập'}
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
