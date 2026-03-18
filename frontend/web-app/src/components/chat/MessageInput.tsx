import { useState } from 'react';
import { Paperclip, Send, Smile, Image as ImageIcon, Mic } from 'lucide-react';

const MessageInput = () => {
  const [text, setText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    // Gửi Message
    setText('');
  };

  return (
    <div className="bg-white p-3 border-t border-gray-100">
      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Actions before input */}
        <div className="flex items-center space-x-1 pb-1">
          <button type="button" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors">
            <Paperclip size={20} />
          </button>
          <button type="button" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors hidden sm:block">
            <ImageIcon size={20} />
          </button>
        </div>

        {/* Input */}
        <div className="flex-1 bg-gray-100 rounded-2xl relative">
          <textarea
            className="w-full bg-transparent border-0 focus:ring-0 resize-none py-3 px-4 outline-none max-h-32 text-[15px]"
            rows={1}
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button type="button" className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600">
            <Smile size={20} />
          </button>
        </div>

        {/* Actions after input */}
        <div className="pb-1">
          {text.trim() ? (
            <button 
              type="submit" 
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-sm active:scale-95"
            >
              <Send size={18} className="translate-x-[1px]" />
            </button>
          ) : (
            <button type="button" className="p-3 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
              <Mic size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
