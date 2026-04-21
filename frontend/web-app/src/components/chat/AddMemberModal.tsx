import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Users, Check } from 'lucide-react';
import { contactService, type ContactResponse } from '../../services/contactService';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userIds: string[]) => void;
  existingMemberIds: string[];
}

const AddMemberModal = ({ isOpen, onClose, onConfirm, existingMemberIds }: AddMemberModalProps) => {
  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    contactService
      .getContacts(0, 100)
      .then((res) => setContacts(res.content || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Reset khi đóng
  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lọc contact chưa có trong nhóm và khớp từ khóa
  const filtered = contacts.filter((c) => {
    const uid = String(c.contactUserId || c.id);
    if (existingMemberIds.includes(uid)) return false;

    return (c.fullName || '').toLowerCase().includes(searchText.toLowerCase()) || c.phone?.includes(searchText);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 animate-fadeIn" onClick={onClose}>
      <div
        className="w-[400px] h-[550px] bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[var(--text-primary)]" />
            <span className="font-semibold text-lg text-[var(--text-primary)]">Thêm thành viên</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--border-light)] relative">
          <Search size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Tìm kiếm danh bạ..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-full py-2 pl-10 pr-4 outline-none border border-transparent focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>

        {/* Chú ý: Đã chọn */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2 border-b border-[var(--border-light)] text-sm font-medium text-[var(--accent-primary)]">
            Đã chọn: {selectedIds.size}
          </div>
        )}

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="text-center mt-10 text-[var(--text-secondary)]">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-10 text-[var(--text-secondary)]">Không tìm thấy hoặc tất cả đã ở trong nhóm.</div>
          ) : (
            filtered.map((c) => {
              const uid = String(c.contactUserId || c.id);
              const isSelected = selectedIds.has(uid);
              const name = c.fullName || '';
              const avatar = c.avatarUrl;

              return (
                <div
                  key={uid}
                  className={`flex items-center px-4 py-2 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors ${isSelected ? 'bg-[rgba(0,104,255,0.05)]' : ''
                    }`}
                  onClick={() => toggleSelect(uid)}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'border-[#d1d5db]'
                    }`}>
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden"
                    style={{ background: avatar ? 'transparent' : 'var(--accent-primary)' }}
                  >
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name ? name.charAt(0).toUpperCase() : '?'
                    )}
                  </div>
                  <span className="ml-3 text-[var(--text-primary)] font-medium flex-1 truncate">{name}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={`px-5 py-2 rounded-lg font-medium text-white transition-opacity ${selectedIds.size === 0 ? 'bg-[var(--text-tertiary)] opacity-50 cursor-not-allowed' : 'bg-[var(--accent-primary)] hover:opacity-90'
              }`}
          >
            Thêm
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AddMemberModal;