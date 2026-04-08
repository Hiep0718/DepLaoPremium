import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { contactService, type ContactResponse } from '../../services/contactService';

interface ContactSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: ContactResponse) => void;
}

const ContactSelectionModal = ({ isOpen, onClose, onSelect }: ContactSelectionModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchContacts = async () => {
        setLoading(true);
        try {
          const res = await contactService.getContacts(0, 100);
          setContacts(res.content || []);
        } catch (error) {
          console.error('Failed to load contacts for forwarding', error);
        } finally {
          setLoading(false);
        }
      };
      fetchContacts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(c => {
    const name = c.nickname || c.fullName;
    return name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           c.phone?.includes(searchTerm);
  });

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 animate-fadeIn" onClick={onClose}>
      <div 
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl bg-[var(--bg-panel)] flex flex-col h-[500px]"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <h3 className="font-semibold text-[var(--text-primary)]">Gửi danh thiếp</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--bg-hover)]">
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>
        
        <div className="px-4 py-3 border-b border-[var(--border-light)]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Tìm kiếm bạn bè..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none border border-[var(--border-light)] focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading ? (
            <div className="p-4 text-center text-[var(--text-secondary)] text-sm">Đang tải...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-secondary)] text-sm">Không tìm thấy kết quả</div>
          ) : (
            filteredContacts.map(contact => {
              const name = contact.nickname || contact.fullName;
              const avatar = contact.avatarUrl;

              return (
                <div 
                  key={contact.contactUserId || contact.id} 
                  className="flex items-center justify-between p-2 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer transition-colors"
                  onClick={() => {
                    onSelect(contact);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white overflow-hidden font-bold"
                      style={{ background: avatar ? 'transparent' : 'var(--accent-primary)' }}>
                      {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[150px] text-sm">{name}</span>
                    </div>
                  </div>
                  <button 
                    className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white"
                  >
                    Gửi
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ContactSelectionModal;
