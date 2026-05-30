import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Phone, Fingerprint, Pencil, Camera, Calendar, Users, Lock, AlertCircle, Trash } from 'lucide-react';
import { contactService, type UserResponse } from '../services/contactService';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const currentUser = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  
  const isCurrentUser = Boolean(user && currentUser && user.id === currentUser.id);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setAvatarUrl(user.avatarUrl || '');
      setCoverUrl(user.coverUrl || '');
      setGender(user.gender || '');
      setBirthday(user.birthday || '');
    }
  }, [user]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const url = await contactService.uploadFile(file, 'avatar');
      setAvatarUrl(url);
      // Auto-save avatar
      const updated = await contactService.updateUserProfile({
        fullName: fullName || user?.fullName || '',
        avatarUrl: url,
        coverUrl: coverUrl || undefined,
        gender: gender || undefined,
        birthday: birthday || undefined,
      });
      setUser(updated);
      setSuccess('Cập nhật avatar thành công!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload avatar thất bại');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const url = await contactService.uploadFile(file, 'cover');
      setCoverUrl(url);
      // Auto-save cover
      const updated = await contactService.updateUserProfile({
        fullName: fullName || user?.fullName || '',
        avatarUrl: avatarUrl || undefined,
        coverUrl: url,
        gender: gender || undefined,
        birthday: birthday || undefined,
      });
      setUser(updated);
      setSuccess('Cập nhật ảnh bìa thành công!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload ảnh bìa thất bại');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const updated = await contactService.updateUserProfile({
        fullName,
        avatarUrl: avatarUrl || undefined,
        coverUrl: coverUrl || undefined,
        gender: gender || undefined,
        birthday: birthday || undefined,
      });
      setUser(updated);
      setSuccess('Cập nhật thành công!');
      setIsEditing(false);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const avatarLetter = (fullName || user?.fullName || 'U').charAt(0).toUpperCase();

  const formatBirthday = (date: string) => {
    if (!date) return 'Chưa cập nhật';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return date;
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleOverlayClick}>
      <div className="w-full max-w-md rounded-lg overflow-hidden theme-transition"
        style={{ background: 'var(--bg-panel)', boxShadow: 'var(--shadow-popup)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Thông tin tài khoản</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <X size={18} />
          </button>
        </div>

        {/* Cấu trúc đổi luồng Update Password hoặc Edit Profile */}
        <div className="overflow-y-auto max-h-[80vh]">
          {/* Cover Photo */}
          <div className="h-44 relative cursor-pointer group"
            style={{
              background: coverUrl
                ? `url(${coverUrl}) center/cover no-repeat`
                : 'linear-gradient(135deg, #0068FF 0%, #00C6FB 100%)',
            }}
            onClick={() => isCurrentUser && coverInputRef.current?.click()}>
            {isCurrentUser && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-medium">
                  <Camera size={18} />
                  {uploadingCover ? 'Đang tải...' : 'Đổi ảnh bìa'}
                </div>
              </div>
            )}
            {isCurrentUser && <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
              onChange={handleCoverUpload} />}
          </div>

          {/* Avatar + Name */}
          <div className="px-4 -mt-12 relative z-10">
            <div className="flex items-end gap-3">
              {/* Avatar with upload button */}
              <div className="relative group cursor-pointer" onClick={() => isCurrentUser && avatarInputRef.current?.click()}>
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl text-white border-4"
                  style={{
                    borderColor: 'var(--bg-panel)',
                    background: avatarUrl ? 'transparent' : '#0050CC',
                  }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    avatarLetter
                  )}
                </div>
                {isCurrentUser && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white border-2"
                    style={{ background: '#0068FF', borderColor: 'var(--bg-panel)' }}>
                    <Camera size={12} />
                  </div>
                )}
                {isCurrentUser && uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {isCurrentUser && <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={handleAvatarUpload} />}
              </div>

              <div className="pb-2 flex items-center gap-2">
                <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {user?.fullName || 'Người dùng'}
                </span>
                {isCurrentUser && (
                  <button onClick={() => setIsEditing(!isEditing)}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {!isCurrentUser && (
            <div className="px-4 py-3 flex gap-3 mt-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <button 
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-colors border"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                onClick={() => {
                  alert('Tính năng gọi điện đang được thực hiện qua phòng trò chuyện!');
                }}
              >
                Gọi điện
              </button>
              <button 
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm text-white transition-colors"
                style={{ background: '#0068FF' }}
                onClick={async () => {
                  if (!currentUser || !user) return;
                  const targetUserId = user.id;
                  const ids = [currentUser.id.toString(), targetUserId.toString()].sort();
                  const convId = `1to1_${ids[0]}_${ids[1]}`;
                  try {
                    const { default: api } = await import('../services/axios');
                    await api.post('/conversation', {
                      conversationId: convId,
                      participants: [currentUser.id.toString(), targetUserId.toString()],
                      isGroup: false
                    });
                    onClose();
                    const { setActiveConversation, setActiveContactInfo } = useChatStore.getState();
                    setActiveConversation({
                      conversationId: convId,
                      isGroup: false,
                      participants: [
                        { userId: currentUser.id, role: 'member' },
                        { userId: user.id, role: 'member' }
                      ]
                    });
                    setActiveContactInfo({
                      name: user.fullName,
                      avatarUrl: user.avatarUrl
                    });
                  } catch (error) {
                    console.error("Failed to start direct message conversation", error);
                    alert("Không thể bắt đầu nhắn tin với người dùng này.");
                  }
                }}
              >
                Nhắn tin
              </button>
            </div>
          )}

          {/* Status messages */}
          {error && (
            <div className="mx-4 mt-3 text-sm text-red-500 p-2.5 rounded-lg"
              style={{ background: 'var(--bg-hover)' }}>{error}</div>
          )}
          {success && (
            <div className="mx-4 mt-3 text-sm text-green-500 p-2.5 rounded-lg"
              style={{ background: 'var(--bg-hover)' }}>{success}</div>
          )}

          {/* Personal Info */}
          <div className="px-4 py-4">
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Thông tin cá nhân</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Users size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <div className="flex-1">
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Giới tính</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{gender || 'Chưa cập nhật'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <div className="flex-1">
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Ngày sinh</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatBirthday(birthday)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <div className="flex-1">
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Điện thoại</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{user?.phone || 'Chưa cập nhật'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Fingerprint size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <div className="flex-1">
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>ID</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>#{user?.id || '---'}</div>
                </div>
              </div>
            </div>

            <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này
            </p>
          </div>

          {!isCurrentUser && (
            <>
              {/* Hình ảnh */}
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Hình ảnh</h4>
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Chưa có ảnh nào được chia sẻ
                </div>
              </div>

              {/* Options */}
              <div className="px-4 py-2 space-y-1" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <button className="w-full flex items-center justify-between py-3 text-sm text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg px-2" style={{ color: 'var(--text-primary)' }}>
                  <div className="flex items-center gap-3">
                    <Users size={16} style={{ color: 'var(--text-secondary)' }} />
                    <span>Nhóm chung (0)</span>
                  </div>
                </button>
                <button className="w-full flex items-center justify-between py-3 text-sm text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg px-2" style={{ color: 'var(--text-primary)' }}>
                  <div className="flex items-center gap-3">
                    <Fingerprint size={16} style={{ color: 'var(--text-secondary)' }} />
                    <span>Chia sẻ danh thiếp</span>
                  </div>
                </button>
                <button 
                  className="w-full flex items-center justify-between py-3 text-sm text-left hover:bg-red-500/10 rounded-lg px-2 text-red-500"
                  onClick={() => {
                    alert('Đã chặn tin nhắn và cuộc gọi của người dùng này!');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Lock size={16} />
                    <span>Chặn tin nhắn và cuộc gọi</span>
                  </div>
                </button>
                <button 
                  className="w-full flex items-center justify-between py-3 text-sm text-left hover:bg-red-500/10 rounded-lg px-2 text-red-500"
                  onClick={() => {
                    alert('Đã báo xấu tài khoản này đến ban quản trị!');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle size={16} />
                    <span>Báo xấu</span>
                  </div>
                </button>
                <button 
                  className="w-full flex items-center justify-between py-3 text-sm text-left hover:bg-red-500/10 rounded-lg px-2 text-red-500"
                  onClick={() => {
                    alert('Đã xóa người dùng khỏi danh sách bạn bè!');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Trash size={16} />
                    <span>Xóa khỏi danh sách bạn bè</span>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Edit Profile Form */}
          {isEditing && !isEditingPassword && (
            <form onSubmit={handleSave} className="px-4 pb-4 space-y-3"
              style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Họ và tên</label>
                <input type="text" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Giới tính</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
                  <option value="">Chọn giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ngày sinh</label>
                <input type="date" value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 mt-2"
                style={{ background: '#0068FF' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0055D4'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0068FF'}>
                <Save size={16} />
                {loading ? 'Đang lưu...' : 'Cập nhật'}
              </button>
              <button type="button" onClick={() => setIsEditing(false)}
                className="w-full text-xs font-semibold py-2 transition-colors mt-1 hover:underline"
                style={{ color: 'var(--text-secondary)' }}>
                Hủy
              </button>
            </form>
          )}

          {/* Edit Password Form */}
          {isEditingPassword && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (newPassword !== confirmPassword) {
                setError('Xác nhận mật khẩu mới không khớp!');
                return;
              }
              if (!oldPassword || !newPassword) {
                setError('Vui lòng nhập đủ các trường mật khẩu!');
                return;
              }
              setLoading(true); setError(''); setSuccess('');
              try {
                const { data } = await import('../services/axios').then(m => m.default).then(axios => axios.put('/users/password', { oldPassword, newPassword }));
                if (data.success) {
                  setSuccess('Cập nhật mật khẩu thành công!');
                  setIsEditingPassword(false);
                  setOldPassword(''); setNewPassword(''); setConfirmPassword('');
                  setTimeout(() => setSuccess(''), 2000);
                } else {
                  setError(data.message || 'Có lỗi xảy ra');
                }
              } catch (err: any) {
                setError(err?.response?.data?.message || 'Có lỗi xảy ra');
              } finally {
                setLoading(false);
              }
            }} className="px-4 pb-4 space-y-3"
              style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Mật khẩu hiện tại</label>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Mật khẩu mới</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Xác nhận mật khẩu mới</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-search)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 mt-2"
                style={{ background: '#0068FF' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0055D4'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0068FF'}>
                <Lock size={16} />
                {loading ? 'Đang đổi mật khẩu...' : 'Xác nhận Đổi mật khẩu'}
              </button>
              <button type="button" onClick={() => { setIsEditingPassword(false); setError(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="w-full text-xs font-semibold py-2 transition-colors mt-1 hover:underline"
                style={{ color: 'var(--text-secondary)' }}>
                Hủy
              </button>
            </form>
          )}

          {/* Bottom: edit button if not editing */}
          {isCurrentUser && !isEditing && !isEditingPassword && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <button onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Pencil size={14} />
                Cập nhật Hồ sơ
              </button>
              <button onClick={() => { setIsEditingPassword(true); setError(''); setSuccess(''); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border-primary)', color: '#FF4D4F' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Lock size={14} />
                Đổi mật khẩu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ProfileModal;
