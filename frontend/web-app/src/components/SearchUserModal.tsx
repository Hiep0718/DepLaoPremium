import { useState } from 'react';
import { Search, UserPlus, X, Phone } from 'lucide-react';
import { searchUsers } from '../services/user.service';
import { contactService, type UserResponse } from '../services/contactService';
import { socket } from '../services/socket';
import { useChatStore } from '../stores/chatStore';
import { useNavigate } from 'react-router-dom';

interface SearchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchUserModal = ({ isOpen, onClose }: SearchUserModalProps) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserResponse[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const isPhoneNumber = /^\d+$/.test(query.trim());
      let finalResults: any[] = [];

      // 1. Luôn tìm trong danh bạ trước (hiển thị bạn bè)
      try {
        const contactRes = await contactService.searchContacts(query.trim());
        const friends = contactRes.content || [];
        finalResults = friends.map((f: any) => ({
          ...f,
          id: f.contactUserId || f.id,
          isFriend: true
        }));
      } catch (err) {
        console.error("Lỗi tìm kiếm danh bạ", err);
      }

      // 2. Nếu tìm số điện thoại, tìm người lạ (đúng 100%)
      if (isPhoneNumber) {
        const userRes = await searchUsers(query.trim());
        const allUsers = userRes.data?.data?.content || [];

        const friendIds = new Set(finalResults.map(f => f.id));
        const exactStrangers = allUsers.filter((u: any) =>
          u.phone === query.trim() && !friendIds.has(u.id)
        ).map((u: any) => ({ ...u, isFriend: false }));

        finalResults = [...finalResults, ...exactStrangers];
      }

      if (finalResults.length === 0) {
        setError('Không tìm thấy kết quả phù hợp.');
      }

      setResults(finalResults as any[]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi tìm kiếm');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userData: UserResponse) => {
    try {
      await contactService.sendFriendRequest(userData.phone, 'Xin chào, mình muốn kết bạn với bạn!');
      setSuccessMsg(`Đã gửi lời mời kết bạn đến ${userData.fullName}!`);

      // Phát tín hiệu Real-time
      if (socket.connected) {
        socket.emit('friend_action', { recipientId: userData.id, action: 'new_request' });
      }

      setTimeout(() => {
        onClose();
        setSuccessMsg('');
        setResults([]);
        setQuery('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Không thể gửi lời mời');
    }
  };

  const handleSelectUser = (user: UserResponse) => {
    // Current user can chat directly by providing a synthetic conversation
    // Node.js will handle mapping this or creating it in the real system
    setActiveConversation({
      conversationId: `1to1_web_${user.id}`,
      participants: [user as any],
      isGroup: false,
      lastMessage: '...',
    });
    onClose();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Thêm liên hệ mới</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleSearch} className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              autoFocus
              className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-10 pr-20 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/30 outline-none"
              placeholder="Nhập tên hoặc số điện thoại..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Tìm
            </button>
          </form>

          {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
          {successMsg && <p className="text-sm text-green-600 mb-3 text-center font-medium bg-green-50 p-2 rounded-lg">{successMsg}</p>}

          <div className="overflow-y-auto flex-1 max-h-[40vh] space-y-2">
            {loading ? (
              <p className="text-center text-slate-500 p-4 animate-pulse">Đang tìm kiếm...</p>
            ) : results.length === 0 && query && !loading ? (
              <p className="text-center text-slate-500 p-4">Không tìm thấy người dùng phù hợp.</p>
            ) : (
              results.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100/50 hover:border-slate-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                      ) : (
                        (u.fullName || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">{u.fullName}</p>
                        {(u as any).isFriend && (
                          <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Bạn bè</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Phone size={12} /> {u.phone}
                      </p>
                    </div>
                  </div>
                  {!(u as any).isFriend && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFriend(u);
                      }}
                      className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors active:scale-95"
                      title="Thêm bạn"
                    >
                      <UserPlus size={18} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchUserModal;
