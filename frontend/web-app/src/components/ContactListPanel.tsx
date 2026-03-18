import { UserPlus, Users } from 'lucide-react';

const ContactListPanel = () => {
  return (
    <div className="w-80 h-full bg-white border-r flex flex-col z-20">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Danh bạ</h2>
        <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors">
          <UserPlus size={20} />
        </button>
      </div>

      {/* Menu / List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 border-b">
          <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg text-left transition-colors font-medium text-gray-800">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users size={20} />
            </div>
            Danh sách nhóm
          </button>
        </div>

        {/* Contacts */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Bạn bè trực tuyến (2)</h3>
          
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                    A
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <span className="font-medium text-gray-900">Alice</span>
              </div>
            </div>

            <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-600">
                    B
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <span className="font-medium text-gray-900">Bob</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactListPanel;
