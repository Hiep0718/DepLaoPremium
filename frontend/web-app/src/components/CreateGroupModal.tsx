import { useState, useEffect, useRef } from 'react';
import { X, Search, Users, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { contactService, type ContactResponse } from '../services/contactService';
import { createConversation } from '../services/message.service';
import { useAuthStore } from '../stores/authStore';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (conversationId: string) => void;
}

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    contactService
      .getContacts(0, 100)
      .then((res) => setContacts(res.content))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Reset khi đóng
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setGroupName('');
      setSearchText('');
      setSelectedIds(new Set());
      setError('');
      setAvatarUrl('');
      setUploadingAvatar(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = contacts.filter((c) =>
    (c.nickname || c.fullName || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    if (selectedIds.size < 2) {
      setError('Vui lòng chọn ít nhất 2 thành viên');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Lỗi tải ảnh. Dung lượng phải < 5MB');
      return;
    }

    setUploadingAvatar(true);
    setError('');
    try {
      const url = await contactService.uploadFile(file, 'avatar');
      setAvatarUrl(url);
    } catch (err: any) {
      console.error('Lỗi upload avatar group:', err);
      setError('Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Vui lòng nhập tên nhóm');
      return;
    }
    if (!user?.id) return;

    setCreating(true);
    setError('');
    try {
      const participantIds = [String(user.id), ...Array.from(selectedIds).map(String)];
      const res = await createConversation(participantIds, true, groupName.trim(), String(user.id), avatarUrl || undefined);

      const newConv = res.data?.data || res.data;
      const conversationId = newConv?.conversationId || newConv?._id || '';

      // Gọi callback để parent reload dữ liệu từ backend và active nhóm mới
      onGroupCreated?.(conversationId);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tạo nhóm. Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.contactUserId));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-panel, #fff)',
          maxHeight: '85vh',
          border: '1px solid var(--border-primary, #e5e7eb)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border-primary, #e5e7eb)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)' }}
            >
              <Users size={18} color="#fff" />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary, #111)' }}>
                Tạo nhóm mới
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                {step === 1 ? 'Bước 1: Chọn thành viên' : 'Bước 2: Đặt tên nhóm'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--text-secondary, #6b7280)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-3 pb-2 gap-2 shrink-0">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                background: step >= s
                  ? 'linear-gradient(90deg, #0068FF, #00C6FF)'
                  : 'var(--border-primary, #e5e7eb)',
              }}
            />
          ))}
        </div>

        {/* Step 1: Chọn thành viên */}
        {step === 1 && (
          <>
            <div className="px-4 pt-2 pb-3 shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--text-secondary, #6b7280)' }}
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--bg-search, #f3f4f6)',
                    color: 'var(--text-primary, #111)',
                    border: '1px solid var(--border-primary, #e5e7eb)',
                  }}
                  placeholder="Tìm kiếm bạn bè..."
                />
              </div>

              {/* Selected badges */}
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedContacts.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ background: '#EBF2FF', color: '#0068FF' }}
                    >
                      {c.nickname || c.fullName}
                      <button
                        onClick={() => toggleSelect(c.contactUserId)}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div
                    className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#0068FF', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                  Không tìm thấy bạn bè
                </p>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedIds.has(c.contactUserId);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelect(c.contactUserId)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                      style={{
                        background: isSelected ? '#EBF2FF' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? '#EBF2FF' : 'transparent';
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
                        style={{ background: c.avatarUrl ? 'transparent' : '#0068FF' }}
                      >
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(c.nickname || c.fullName || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Name */}
                      <span
                        className="flex-1 text-sm font-medium truncate"
                        style={{ color: 'var(--text-primary, #111)' }}
                      >
                        {c.nickname || c.fullName}
                      </span>

                      {/* Checkbox */}
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                        style={{
                          borderColor: isSelected ? '#0068FF' : 'var(--border-primary, #d1d5db)',
                          background: isSelected ? '#0068FF' : 'transparent',
                        }}
                      >
                        {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Step 2: Đặt tên nhóm */}
        {step === 2 && (
          <div className="flex-1 px-5 pt-3 pb-4 flex flex-col gap-5">
            {/* Avatar nhóm placeholder */}
            <div className="flex flex-col items-center gap-3 py-4">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 overflow-hidden relative shadow-sm"
                style={{ background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)' }}
                onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} color="rgba(255,255,255,0.85)" />
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                {uploadingAvatar ? 'Đang tải lên...' : 'Ảnh nhóm (tuỳ chọn)'}
              </p>
            </div>

            {/* Tên nhóm */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: 'var(--text-primary, #111)' }}
              >
                Tên nhóm
              </label>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-search, #f3f4f6)',
                  color: 'var(--text-primary, #111)',
                  border: '2px solid var(--border-primary, #e5e7eb)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#0068FF')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary, #e5e7eb)')}
                placeholder="Nhập tên nhóm..."
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-secondary, #9ca3af)' }}>
                {groupName.length}/50
              </p>
            </div>

            {/* Danh sách thành viên đã chọn */}
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary, #111)' }}>
                Thành viên ({selectedContacts.length + 1})
              </p>
              <div className="flex gap-2 flex-wrap">
                {/* Current user */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm overflow-hidden"
                    style={{ background: user?.avatarUrl ? 'transparent' : '#10b981' }}
                  >
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Bạn" className="w-full h-full object-cover" />
                    ) : (
                      (user as any)?.fullName?.charAt(0)?.toUpperCase() || 'B'
                    )}
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary, #6b7280)' }}>Bạn</span>
                </div>
                {selectedContacts.map((c) => (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm overflow-hidden"
                      style={{ background: c.avatarUrl ? 'transparent' : '#0068FF' }}
                    >
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.fullName} className="w-full h-full object-cover" />
                      ) : (
                        (c.nickname || c.fullName || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <span
                      className="text-[10px] max-w-[44px] truncate text-center"
                      style={{ color: 'var(--text-secondary, #6b7280)' }}
                    >
                      {c.nickname || c.fullName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="px-5 pb-2 text-sm text-red-500 text-center shrink-0">{error}</p>
        )}

        {/* Footer Buttons */}
        <div
          className="px-5 py-4 flex gap-3 shrink-0"
          style={{ borderTop: '1px solid var(--border-primary, #e5e7eb)' }}
        >
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setError(''); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: 'var(--bg-hover, #f3f4f6)',
                color: 'var(--text-secondary, #6b7280)',
              }}
            >
              Quay lại
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={handleNext}
              disabled={selectedIds.size < 2}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: selectedIds.size >= 2
                  ? 'linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)'
                  : 'var(--bg-hover, #d1d5db)',
                cursor: selectedIds.size >= 2 ? 'pointer' : 'not-allowed',
                opacity: selectedIds.size >= 2 ? 1 : 0.6,
              }}
            >
              Tiếp theo ({selectedIds.size} đã chọn)
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !groupName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: groupName.trim()
                  ? 'linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)'
                  : 'var(--bg-hover, #d1d5db)',
                cursor: groupName.trim() ? 'pointer' : 'not-allowed',
                opacity: groupName.trim() ? 1 : 0.6,
              }}
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Users size={16} />
                  Tạo nhóm
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
