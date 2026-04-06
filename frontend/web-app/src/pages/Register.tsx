import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import { Phone, Lock, User, Check, Eye, EyeOff } from 'lucide-react';

/* ─── Password strength indicator ─── */
const StrengthBar = ({ password }: { password: string }) => {
  if (!password) return null;
  const rules = [
    { ok: password.length >= 6, label: 'Ít nhất 6 ký tự' },
    { ok: /[0-9]/.test(password), label: 'Có chữ số' },
    { ok: /[a-zA-Z]/.test(password), label: 'Có chữ cái' },
  ];
  const score = rules.filter(r => r.ok).length;
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-green-500'];
  const labels = ['', 'Yếu', 'Trung bình', 'Mạnh'];
  const textColors = ['', 'text-red-500', 'text-amber-500', 'text-green-600'];

  return (
    <div className="space-y-2 px-0.5">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score] : 'bg-gray-200'}`}
          />
        ))}
        <span className={`text-[11px] font-semibold ml-1 w-16 text-right ${textColors[score]}`}>
          {labels[score]}
        </span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {rules.map((r, i) => (
          <span key={i} className={`flex items-center gap-1 text-[11px] transition-colors ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
            <Check className={`w-3 h-3 ${r.ok ? 'opacity-100' : 'opacity-30'}`} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const Register = () => {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password || !fullName) { setError('Vui lòng điền đầy đủ thông tin'); return; }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/auth/register', { phone, password, fullName });
      if (data.success) {
        navigate('/login', { state: { message: 'Đăng ký thành công! Vui lòng đăng nhập.' } });
      } else { setError(data.message || 'Đăng ký thất bại'); }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi đăng ký');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-transparent"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="w-full max-w-[820px] p-2 sm:p-4">
        <div className="flex rounded-2xl overflow-hidden shadow-2xl shadow-black/20" style={{ minHeight: 520 }}>

          {/* ── Left branding ── */}
          <div className="hidden md:flex w-[42%] flex-shrink-0 flex-col justify-between bg-gradient-to-b from-[#1a6de0]/75 to-[#0052cc]/75 backdrop-blur-lg p-9">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-white text-base font-black">Z</span>
              </div>
              <span className="text-white text-lg font-bold">Zalo</span>
            </div>

            {/* Illustration */}
            <div className="flex-1 flex items-center justify-center py-6">
              <svg viewBox="0 0 200 220" className="w-[180px] drop-shadow-2xl">
                {/* Shield base */}
                <path d="M100 20 L170 55 L170 120 C170 165 100 200 100 200 C100 200 30 165 30 120 L30 55 Z"
                  fill="white" opacity="0.15" />
                <path d="M100 30 L160 62 L160 118 C160 158 100 190 100 190 C100 190 40 158 40 118 L40 62 Z"
                  fill="white" opacity="0.12" />
                {/* Shield inner */}
                <path d="M100 42 L150 68 L150 114 C150 148 100 175 100 175 C100 175 50 148 50 114 L50 68 Z"
                  fill="#1250a8" />
                {/* Check mark */}
                <circle cx="100" cy="110" r="28" fill="white" opacity="0.25" />
                <circle cx="100" cy="110" r="22" fill="white" opacity="0.3" />
                <path d="M86 110 L96 120 L116 100" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Stars */}
                <circle cx="60" cy="50" r="3" fill="white" opacity="0.5" />
                <circle cx="145" cy="60" r="2.5" fill="white" opacity="0.4" />
                <circle cx="55" cy="150" r="2" fill="white" opacity="0.35" />
                <circle cx="150" cy="145" r="3" fill="white" opacity="0.45" />
              </svg>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <p className="text-white text-base font-bold leading-snug">Tạo tài khoản Zalo,</p>
              <p className="text-blue-200 text-sm leading-snug">bắt đầu kết nối ngay hôm nay.</p>
            </div>
          </div>

          {/* ── Right form ── */}
          <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-lg">
            {/* Header */}
            <div className="px-8 pt-7 pb-1">
              <h2 className="text-base font-bold text-gray-900">Tạo tài khoản mới</h2>
              <p className="text-xs text-gray-500 mt-0.5">Điền thông tin bên dưới để đăng ký</p>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-0 px-8 pt-4 pb-2">
              {[
                { label: 'Thông tin', active: true, done: false },
                { label: 'Xác minh SĐT', active: false, done: false },
                { label: 'Hoàn tất', active: false, done: false },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-all ${step.active ? 'bg-[#0068FF] text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                      {i + 1}
                    </div>
                    <span className={`text-[11px] font-medium whitespace-nowrap ${step.active ? 'text-[#0068FF]' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className="h-px flex-1 bg-gray-200 mx-2 min-w-[12px]" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Form content */}
            <div className="flex-1 flex flex-col justify-center px-8 py-4">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 px-3.5 py-2.5 rounded-xl text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2.5">
                  {/* Full name */}
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
                    <input
                      type="text" placeholder="Họ và tên" value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
                    />
                  </div>

                  {/* Phone */}
                  <div className="relative group">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
                    <input
                      type="text" placeholder="Số điện thoại" value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
                      <input
                        type={showPw ? 'text' : 'password'} placeholder="Mật khẩu" value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <StrengthBar password={password} />
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Bằng việc đăng ký, bạn đồng ý với{' '}
                  <span className="text-[#0068FF] cursor-pointer hover:underline">Điều khoản sử dụng</span>
                  {' '}và{' '}
                  <span className="text-[#0068FF] cursor-pointer hover:underline">Chính sách bảo mật</span>
                </p>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 bg-[#0068FF] hover:bg-[#0057d4] active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-200/60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : 'Đăng ký tài khoản'}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Đã có tài khoản?{' '}
                  <Link to="/login" className="text-[#0068FF] font-bold hover:underline underline-offset-2">
                    Đăng nhập
                  </Link>
                </p>
              </form>
            </div>
          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} Zalo Clone &nbsp;·&nbsp; Phiên bản 25.04
        </p>
      </div>
    </div>
  );
};

export default Register;