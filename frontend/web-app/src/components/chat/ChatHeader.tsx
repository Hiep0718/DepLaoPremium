import { Phone, Video, Search, MoreHorizontal } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

const ChatHeader = () => {
  const activeConversation = useChatStore((state) => state.activeConversation);
  
  // Get contact from activeConversation participants
  const contact = activeConversation?.participants?.[0];
  const displayName = contact ? (contact.nickname || contact.fullName) : 'Vui lòng chọn một cuộc trò chuyện';
  const displayAvatar = contact ? (contact.nickname || contact.fullName || '?').charAt(0).toUpperCase() : '?';

  return (
    <div className="h-16 px-4 py-2 border-b border-gray-200/60 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-3 cursor-pointer group">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg overflow-hidden">
          {contact?.avatarUrl ? (
             <img src={contact.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
             displayAvatar
          )}
        </div>
        <div>
          <h2 className="text-slate-800 font-bold text-base leading-tight group-hover:text-indigo-600 transition-colors">{displayName}</h2>
          {contact ? (
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              đang hoạt động
            </p>
          ) : (
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Chưa kết nối
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button className="text-slate-400 hover:text-slate-600 transition-colors p-2.5 hover:bg-slate-100 rounded-full">
          <Phone size={20} />
        </button>
        <button className="text-slate-400 hover:text-slate-600 transition-colors p-2.5 hover:bg-slate-100 rounded-full">
          <Video size={20} />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors p-2.5 hover:bg-slate-100 rounded-full">
          <Search size={20} />
        </button>
        <button className="text-slate-400 hover:text-slate-600 transition-colors p-2.5 hover:bg-slate-100 rounded-full">
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
