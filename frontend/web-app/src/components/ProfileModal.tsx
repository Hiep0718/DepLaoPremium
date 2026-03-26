import React, { useState, useEffect } from 'react';
import { X, Save, LogOut, Phone, Shield, Fingerprint } from 'lucide-react';
import { contactService, type UserResponse } from '../services/contactService';
import { useAuthStore } from '../stores/authStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const setUser = useAuthStore(state => state.setUser);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await contactService.updateUserProfile({
        fullName,
        avatarUrl
      });
      setUser(updatedUser);
      setSuccess('Cập nhật hồ sơ thành công!');
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative">
        {/* Cover Background */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full transition-colors z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-6 relative -mt-16 flex justify-between items-end mb-4">
          <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-md relative group z-10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl font-bold text-indigo-500">
                {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
              </span>
            )}
          </div>
          
          {user?.role && (
            <div className="mb-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold flex items-center gap-1 border border-blue-100 shadow-sm relative z-10">
              <Shield size={14} />
              {user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
            </div>
          )}
        </div>

        {/* User Info (Read-only) & Form */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div className="mb-6 space-y-3">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{user?.fullName || 'Người dùng'}</h2>
            
            <div className="space-y-2 mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <Phone size={16} className="text-indigo-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-0.5">Số điện thoại</div>
                  <div className="font-semibold text-slate-700">{user?.phone || 'Chưa cập nhật'}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <Fingerprint size={16} className="text-indigo-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-0.5">ID Tài khoản</div>
                  <div className="font-semibold text-slate-700">#{user?.id || '---'}</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">
                {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Nhập họ và tên"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ảnh đại diện (URL)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-70 font-semibold shadow-md active:scale-[0.98]"
              >
                <Save size={18} />
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Footer actions */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/80">
          <button 
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors font-medium active:scale-[0.98]"
          >
            <LogOut size={18} />
            Đăng xuất khỏi thiết bị này
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
