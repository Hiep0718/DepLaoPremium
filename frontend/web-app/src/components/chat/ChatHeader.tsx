import { Phone, Video, Search, MoreHorizontal } from 'lucide-react';

const ChatHeader = () => {
  return (
    <div className="h-16 px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white bg-opacity-70 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center space-x-3 cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg">
          K
        </div>
        <div>
          <h2 className="text-gray-900 font-semibold text-base leading-tight">Khách Hàng</h2>
          <p className="text-sm text-green-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Đang hoạt động
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="text-gray-400 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-full">
          <Phone size={20} />
        </button>
        <button className="text-gray-400 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-full">
          <Video size={20} />
        </button>
        <div className="w-px h-6 bg-gray-200 mx-2"></div>
        <button className="text-gray-400 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full">
          <Search size={20} />
        </button>
        <button className="text-gray-400 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full">
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
