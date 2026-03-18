import { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';

// Mock data
const messages = [
  { id: 1, text: 'Chào bạn!', isMe: false, timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: 2, text: 'Chào shop, mình muốn hỏi về sản phẩm này', isMe: true, timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: 3, text: 'Dạ, bạn muốn hỏi về tính năng hay giá cả ạ?', isMe: false, timestamp: new Date(Date.now() - 1000 * 60 * 2) },
  { id: 4, text: 'Cả hai nhé, tư vấn giúp mình', isMe: true, timestamp: new Date() },
];

const MessageList = () => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Date separator */}
      <div className="flex justify-center mb-6 mt-2">
        <div className="bg-gray-200/60 text-gray-600 text-xs py-1 px-3 rounded-full font-medium shadow-sm backdrop-blur-sm">
          Hôm nay
        </div>
      </div>

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={clsx(
            'flex flex-col',
            msg.isMe ? 'items-end' : 'items-start'
          )}
        >
          <div className="flex items-end gap-2 max-w-[70%]">
            {!msg.isMe && (
              <div className="w-8 h-8 rounded-full bg-blue-100 shrink-0 flex items-center justify-center font-bold text-blue-600 text-sm">
                K
              </div>
            )}
            <div
              className={clsx(
                'px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed',
                msg.isMe
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
              )}
            >
              {msg.text}
            </div>
          </div>
          <span className="text-[11px] text-gray-400 mt-1.5 px-10">
            {format(msg.timestamp, 'HH:mm')}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
