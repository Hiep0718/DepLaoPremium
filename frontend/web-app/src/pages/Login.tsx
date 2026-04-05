import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { contactService } from '../services/contactService';
import { connectQRSocket, disconnectQRSocket } from '../services/socket';
import { QRCodeSVG } from 'qrcode.react';
import { Phone, Lock, RefreshCw, ChevronRight, Smartphone, CheckCircle, Loader2 } from 'lucide-react';
import type { Socket } from 'socket.io-client';

type LoginMode = 'qr' | 'password' | 'forgot_password';
type QRStatus = 'loading' | 'ready' | 'scanned' | 'confirmed' | 'expired' | 'error';

/* ─── QR login panel ─── */
const QRPanel = ({ onSwitchToPassword }: { onSwitchToPassword: () => void }) => {
  const [status, setStatus] = useState<QRStatus>('loading');
  const [qrData, setQrData] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [seconds, setSeconds] = useState(180);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSession = useCallback(() => {
    // Cleanup previous
    if (timerRef.current) clearInterval(timerRef.current);
    if (socketRef.current && sessionId) {
      socketRef.current.emit('qr_login_cancel', { sessionId });
    }

    setStatus('loading');
    setQrData('');
    setSessionId('');
    setSeconds(180);

    const s = connectQRSocket();
    socketRef.current = s;

    // Wait for connection then init
    const initSession = () => {
      s.emit('qr_login_init');
    };

    if (s.connected) {
      initSession();
    } else {
      s.once('connect', initSession);
    }
  }, [sessionId]);

  // Setup socket listeners
  useEffect(() => {
    const s = connectQRSocket();
    socketRef.current = s;

    // Receive new QR session
    s.on('qr_login_session', (data: { sessionId: string; qrData: string }) => {
      setSessionId(data.sessionId);
      setQrData(data.qrData);
      setStatus('ready');
      setSeconds(180);

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // Mobile scanned the QR
    s.on('qr_login_scanned', () => {
      setStatus('scanned');
    });

    // Mobile confirmed login — receive tokens
    s.on('qr_login_confirmed', (data: {
      accessToken: string;
      refreshToken: string;
      user: any;
    }) => {
      setStatus('confirmed');
      if (timerRef.current) clearInterval(timerRef.current);

      // Save tokens and login
      useChatStore.getState().clearChat();
      sessionStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) sessionStorage.setItem('refreshToken', data.refreshToken);
      setAuth(data.user, data.accessToken);

      // Navigate after brief success animation
      setTimeout(() => {
        navigate('/');
      }, 800);
    });

    // Error from server
    s.on('qr_login_error', (data: { message: string }) => {
      console.error('[QR Login]', data.message);
      setStatus('error');
    });

    // Init first session
    const initSession = () => {
      s.emit('qr_login_init');
    };

    if (s.connected) {
      initSession();
    } else {
      s.once('connect', initSession);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      s.off('qr_login_session');
      s.off('qr_login_scanned');
      s.off('qr_login_confirmed');
      s.off('qr_login_error');
      disconnectQRSocket();
    };
  }, [navigate, setAuth]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR code box */}
      <div className="relative w-[180px] h-[180px] rounded-2xl overflow-hidden border border-gray-200 bg-white p-3 shadow-sm flex items-center justify-center">
        {/* Loading state */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-[#0068FF] animate-spin" />
            <p className="text-xs text-gray-400">Đang tạo mã QR...</p>
          </div>
        )}

        {/* QR Code ready */}
        {(status === 'ready' || status === 'scanned' || status === 'confirmed') && qrData && (
          <QRCodeSVG
            value={qrData}
            size={154}
            level="M"
            bgColor="white"
            fgColor="#111111"
            imageSettings={{
              src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%230068FF'/%3E%3Ctext x='20' y='28' text-anchor='middle' fill='white' font-size='22' font-weight='900' font-family='Arial'%3EZ%3C/text%3E%3C/svg%3E",
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
        )}

        {/* Scanned overlay */}
        {status === 'scanned' && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 rounded-2xl animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-green-600 text-xs font-semibold text-center">Đã quét thành công</p>
            <p className="text-gray-400 text-[10px] text-center">Xác nhận đăng nhập trên điện thoại</p>
          </div>
        )}

        {/* Confirmed overlay */}
        {status === 'confirmed' && (
          <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-2 rounded-2xl animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-[#0068FF]/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#0068FF]" />
            </div>
            <p className="text-[#0068FF] text-xs font-bold text-center">Đăng nhập thành công!</p>
            <Loader2 className="w-4 h-4 text-[#0068FF] animate-spin" />
          </div>
        )}

        {/* Expired overlay */}
        {status === 'expired' && (
          <div className="absolute inset-0 bg-white/96 flex flex-col items-center justify-center gap-3 rounded-2xl">
            <p className="text-gray-500 text-xs font-medium text-center">Mã QR đã hết hạn</p>
            <button
              onClick={startSession}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0068FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0057d4] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại mã
            </button>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-white/96 flex flex-col items-center justify-center gap-3 rounded-2xl">
            <p className="text-red-500 text-xs font-medium text-center">Có lỗi xảy ra</p>
            <button
              onClick={startSession}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0068FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0057d4] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
          </div>
        )}

        {/* Countdown timer */}
        {(status === 'ready') && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/55 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">
            {mm}:{ss}
          </div>
        )}
      </div>

      {/* Status message */}
      <div className="text-center">
        {status === 'scanned' ? (
          <>
            <p className="text-sm font-semibold text-green-600 mb-1">Đã quét mã QR</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Xác nhận đăng nhập trên <strong className="text-gray-700">điện thoại</strong> của bạn
            </p>
          </>
        ) : status === 'confirmed' ? (
          <p className="text-sm font-semibold text-[#0068FF] mb-1">Đang đăng nhập...</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-800 mb-1">Đăng nhập bằng mã QR</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Mở <strong className="text-gray-700">DepLao</strong> trên điện thoại, vào<br />
              <strong className="text-gray-700">Tin nhắn → Quét mã QR</strong>
            </p>
          </>
        )}
      </div>

      {/* Steps */}
      {status !== 'scanned' && status !== 'confirmed' && (
        <div className="flex items-stretch gap-0 bg-gray-50/80 border border-gray-100 rounded-xl overflow-hidden w-full">
          {[
            { n: '1', label: 'Mở DepLao', sub: 'trên điện thoại' },
            { n: '2', label: 'Nhấn biểu tượng', sub: 'quét QR' },
            { n: '3', label: 'Quét mã', sub: 'để đăng nhập' },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1.5 flex-1 py-3 px-2">
                <div className="w-6 h-6 rounded-full bg-[#0068FF]/12 text-[#0068FF] text-[11px] font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <p className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{s.label}</p>
                <p className="text-[10px] text-gray-400 text-center leading-tight">{s.sub}</p>
              </div>
              {i < 2 && <div className="w-px bg-gray-200 my-3" />}
            </React.Fragment>
          ))}
        </div>
      )}

      <button
        onClick={onSwitchToPassword}
        className="flex items-center gap-1.5 text-[#0068FF] text-xs font-semibold hover:underline underline-offset-2 transition-all"
      >
        <Phone className="w-3.5 h-3.5" />
        Đăng nhập bằng số điện thoại
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/* ─── Password login panel ─── */
const PasswordPanel = ({ onSwitchToQR, onSwitchToForgot }: { onSwitchToQR: () => void, onSwitchToForgot: () => void }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) { setError('Vui lòng nhập số điện thoại và mật khẩu'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/auth/login', { phone, password });
      if (data.success) {
        useChatStore.getState().clearChat();
        sessionStorage.setItem('accessToken', data.data.accessToken);
        if (data.data.refreshToken) sessionStorage.setItem('refreshToken', data.data.refreshToken);
        try { const profile = await contactService.getUserProfile(); setAuth(profile, data.data.accessToken); }
        catch { setAuth({ phone }, data.data.accessToken); }
        navigate('/');
      } else { setError(data.message || 'Đăng nhập thất bại'); }
    } catch (err: any) { setError(err?.response?.data?.message || 'Có lỗi xảy ra khi đăng nhập'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 px-3.5 py-2.5 rounded-xl text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        <div className="relative group">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
          <input
            type="text" placeholder="Số điện thoại" value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
          />
        </div>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
          <input
            type="password" placeholder="Mật khẩu" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
          />
        </div>
      </div>

      <div className="flex justify-end -mt-1">
        <button type="button" onClick={onSwitchToForgot} className="text-xs text-[#0068FF] hover:underline font-medium underline-offset-2">
          Quên mật khẩu?
        </button>
      </div>

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
            Đang đăng nhập...
          </span>
        ) : 'Đăng nhập'}
      </button>

      <button
        type="button" onClick={onSwitchToQR}
        className="w-full py-2.5 border border-gray-200 hover:border-[#0068FF]/30 hover:bg-blue-50/60 text-gray-600 hover:text-[#0068FF] text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <Smartphone className="w-4 h-4" />
        Đăng nhập bằng mã QR
      </button>

      <p className="text-center text-xs text-gray-500 pt-1">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-[#0068FF] font-bold hover:underline underline-offset-2">
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
};

/* ─── Forgot Password panel ─── */
const ForgotPasswordPanel = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) { setError('Vui lòng nhập số điện thoại'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/auth/forgot-password/send-otp', { phone });
      if (data.success) {
        setStep(2);
        setSuccess('Mã OTP đã được gửi đến số điện thoại của bạn');
        setTimeout(() => setSuccess(''), 3000);
      } else { setError(data.message || 'Không thể gửi mã OTP'); }
    } catch (err: any) { setError(err?.response?.data?.message || 'Số điện thoại không tồn tại'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) { setError('Vui lòng nhập mã OTP và mật khẩu mới'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/auth/forgot-password/reset', { phone, otp, newPassword });
      if (data.success) {
        setSuccess('Đặt lại mật khẩu thành công!');
        setTimeout(() => onBack(), 2000);
      } else { setError(data.message || 'Không thể đổi mật khẩu'); }
    } catch (err: any) { setError(err?.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-gray-900">Quên mật khẩu</h3>
        <p className="text-sm text-gray-500">Khôi phục quyền truy cập tài khoản</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 px-3.5 py-2.5 rounded-xl text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-600 px-3.5 py-2.5 rounded-xl text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          {success}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="relative group">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
            <input
              type="text" placeholder="Số điện thoại đã đăng ký" value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onBack} disabled={loading} className="w-1/3 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm rounded-xl transition-all">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="w-2/3 py-3 bg-[#0068FF] hover:bg-[#0057d4] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2.5">
            <div className="relative group">
              <input
                type="text" placeholder="Mã OTP 6 số" value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all tracking-widest"
                maxLength={6}
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0068FF] transition-colors" />
              <input
                type="password" placeholder="Mật khẩu mới" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#0068FF] focus:ring-2 focus:ring-[#0068FF]/10 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setStep(1); setError(''); setSuccess(''); }} disabled={loading} className="w-1/3 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm rounded-xl transition-all">
              Quay lại
            </button>
            <button type="submit" disabled={loading} className="w-2/3 py-3 bg-[#0068FF] hover:bg-[#0057d4] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

/* ─── Page ─── */
const Login = () => {
  const [mode, setMode] = useState<LoginMode>('qr');

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-transparent"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="w-full max-w-[820px] p-2 sm:p-4">
        <div className="flex bg-white rounded-2xl overflow-hidden shadow-xl shadow-blue-100/50" style={{ minHeight: 520 }}>

          {/* ── Left branding ── */}
          <div className="hidden md:flex w-[42%] flex-shrink-0 flex-col justify-between bg-gradient-to-b from-[#1a6de0] to-[#0052cc] p-9">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-white text-base font-black">Z</span>
              </div>
              <span className="text-white text-lg font-bold">Zalo</span>
            </div>

            {/* Phone illustration */}
            <div className="flex-1 flex items-center justify-center py-6">
              <svg viewBox="0 0 200 240" className="w-[180px] drop-shadow-2xl">
                {/* Phone body */}
                <rect x="30" y="0" width="140" height="240" rx="24" fill="white" opacity="0.18" />
                <rect x="35" y="5" width="130" height="230" rx="20" fill="white" opacity="0.12" />
                {/* Screen */}
                <rect x="42" y="22" width="116" height="196" rx="14" fill="#1457b5" />
                {/* Status bar */}
                <rect x="42" y="22" width="116" height="22" rx="0" fill="#1250a8" />
                <rect x="42" y="32" width="116" height="12" rx="0" fill="#1250a8" />
                {/* Top notch */}
                <rect x="80" y="26" width="40" height="8" rx="4" fill="#0e40820" />
                {/* Avatar top */}
                <circle cx="100" cy="60" r="16" fill="white" opacity="0.3" />
                <circle cx="100" cy="60" r="12" fill="white" opacity="0.5" />
                {/* Chat messages */}
                <rect x="55" y="90" width="55" height="12" rx="6" fill="white" opacity="0.85" />
                <rect x="90" y="108" width="48" height="12" rx="6" fill="#4a9eff" opacity="0.9" />
                <rect x="55" y="126" width="68" height="12" rx="6" fill="white" opacity="0.75" />
                <rect x="84" y="144" width="36" height="12" rx="6" fill="#4a9eff" opacity="0.7" />
                <rect x="55" y="162" width="50" height="12" rx="6" fill="white" opacity="0.65" />
                {/* Bottom bar */}
                <rect x="42" y="198" width="116" height="20" rx="0" fill="#1250a8" />
                <rect x="42" y="206" width="116" height="12" rx="0" fill="#1250a8" />
                <rect x="78" y="212" width="44" height="5" rx="2.5" fill="white" opacity="0.4" />
                {/* Notification badge */}
                <circle cx="155" cy="88" r="13" fill="#FF4D4F" />
                <text x="155" y="93" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">5</text>
              </svg>
            </div>

            {/* Tagline + download */}
            <div className="space-y-4">
              <div>
                <p className="text-white text-base font-bold leading-snug">Kết nối mọi người,</p>
                <p className="text-blue-200 text-sm leading-snug">nhanh chóng và bảo mật.</p>
              </div>
              <div className="flex gap-2">
                {['App Store', 'Google Play'].map(s => (
                  <div key={s} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 cursor-pointer transition-colors rounded-lg px-3 py-2 border border-white/10">
                    <span className="text-white text-[11px] font-semibold">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right form ── */}
          <div className="flex-1 flex flex-col">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100">
              {([
                { id: 'qr', label: 'Mã QR', icon: <Smartphone className="w-4 h-4" /> },
                { id: 'password', label: 'Mật khẩu', icon: <Phone className="w-4 h-4" /> },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 relative transition-colors ${mode === tab.id ? 'text-[#0068FF]' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                  {mode === tab.id && (
                    <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#0068FF] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-center px-8 py-6">
              {mode === 'qr'
                ? <QRPanel onSwitchToPassword={() => setMode('password')} />
                : mode === 'password' 
                ? <PasswordPanel onSwitchToQR={() => setMode('qr')} onSwitchToForgot={() => setMode('forgot_password')} />
                : <ForgotPasswordPanel onBack={() => setMode('password')} />}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                Bằng việc đăng nhập, bạn đồng ý với{' '}
                <span className="text-[#0068FF] cursor-pointer hover:underline">Điều khoản sử dụng</span>
                {' '}và{' '}
                <span className="text-[#0068FF] cursor-pointer hover:underline">Chính sách bảo mật</span>
                {' '}của Zalo
              </p>
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

export default Login;