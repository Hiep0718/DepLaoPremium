import { Search, MessageSquare, Users, Settings, LogOut, MoreVertical } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';

const Sidebar = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    markAsRead
  } = useChatStore();
  
  const getChatName = (participants: any[]) => {
    if (!participants || participants.length === 0) return 'Cuộc trò chuyện';
    const otherParticipant = participants.find(p => p.userId !== user?.id && p._id !== user?.id);
    return otherParticipant?.fullName || 'Người dùng ẩn danh';
  };

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col relative z-20">
      {/* User Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
            U
          </div>
          <div>
            <h3 className="font-medium text-gray-900 leading-tight">User Account</h3>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="Tìm kiếm..."
          />
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b bg-gray-50/50">
        <button className="flex-1 py-3 flex justify-center text-blue-600 border-b-2 border-blue-600">
          <MessageSquare size={20} />
        </button>
        <button className="flex-1 py-3 flex justify-center text-gray-400 hover:text-gray-600 transition-colors">
          <Users size={20} />
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex justify-center items-center h-32 text-gray-400 text-sm">
            Chưa có cuộc trò chuyện nào
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeConversation?.conversationId === conv.conversationId;
            const hasUnread = (conv.unreadCount || 0) > 0;
            const chatName = getChatName(conv.participants);

            return (
              <div
                key={conv.conversationId}
                onClick={() => {
                  setActiveConversation(conv);
                  if (hasUnread) {
                    markAsRead(conv.conversationId);
                  }
                }}
                className={`p-3 flex items-center gap-3 cursor-pointer border-b transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
              >
                {/* Avatar (Có thể thay thế bằng img url nếu có) */}
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                  {chatName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                      }`}>
                      {chatName}
                    </h4>
                  </div>
                  <p className={`text-xs truncate mt-1 ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-500'
                    }`}>
                    {conv.lastMessage || 'Chưa có tin nhắn'}
                  </p>
                </div>

                {/* Badge số lượng tin nhắn chưa đọc */}
                {hasUnread && (
                  <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {conv.unreadCount! > 9 ? '9+' : conv.unreadCount}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t flex justify-around">
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
          <Settings size={20} />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Đăng xuất"
        >
          <LogOut size={20} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
