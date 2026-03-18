import { Search } from 'lucide-react';

const MessageListPanel = () => {
  return (
    <div className="w-80 h-full bg-white border-r flex flex-col z-20">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Tin nhắn</h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
            placeholder="Tìm kiếm..."
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {/* Placeholder cho conversation list */}
        <div className="flex flex-col">
          {/* Item 1 */}
          <div className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600 font-semibold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-medium text-gray-900 truncate">Alice</h3>
                <span className="text-xs text-gray-500">10:42 PM</span>
              </div>
              <p className="text-sm text-gray-500 truncate">Chào bạn, khỏe không?</p>
            </div>
          </div>
          {/* Item 2 */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 cursor-pointer border-b border-blue-100">
             <div className="w-12 h-12 rounded-full bg-green-100 flex-shrink-0 flex items-center justify-center text-green-600 font-semibold">
              B
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-medium text-gray-900 truncate">Bob</h3>
                <span className="text-xs text-blue-500 font-medium">09:15 AM</span>
              </div>
              <p className="text-sm text-gray-900 font-medium truncate">Dự án tới đâu rồi b?</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageListPanel;
