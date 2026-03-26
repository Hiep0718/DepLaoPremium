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
        <div className="bg-black/15 text-white text-xs py-1 px-3 rounded-full font-medium shadow-sm backdrop-blur-sm">
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
          <div className={clsx("flex items-end gap-2", msg.isMe ? "max-w-[75%]" : "max-w-[70%]")}>
            {!msg.isMe && (
              <div className="w-8 h-8 rounded-full mx-1 bg-indigo-100 shrink-0 flex items-center justify-center font-bold text-indigo-600 text-sm shadow-sm select-none">
                K
              </div>
            )}
            <div
              className={clsx(
                'px-3.5 py-2 shadow-sm text-[15px] leading-relaxed relative flex flex-col',
                msg.isMe
                  ? 'bg-[#EEFFDE] text-slate-800 rounded-2xl rounded-br-none'
                  : 'bg-white text-slate-800 rounded-2xl rounded-bl-none ml-1'
              )}
            >
              {msg.isMe && (
                <svg className="absolute bottom-0 -right-2 w-2.5 h-3 text-[#EEFFDE] fill-current" viewBox="0 0 10 12">
                  <path d="M0 12C5.52285 12 10 7.52285 10 2V0C10 5.52285 5.52285 10 0 10V12Z" />
                </svg>
              )}
              {!msg.isMe && (
                <svg className="absolute bottom-0 -left-2 w-2.5 h-3 text-white fill-current" viewBox="0 0 10 12">
                  <path d="M10 12C4.47715 12 0 7.52285 0 2V0C0 5.52285 4.47715 10 10 10V12Z" />
                </svg>
              )}
              <span className="pr-10">{msg.text}</span>
              <span className={clsx("text-[11px] mt-1 float-right self-end absolute bottom-1.5 right-2 flex items-center gap-0.5 select-none", msg.isMe ? "text-green-700/60" : "text-slate-400")}>
                {format(msg.timestamp, 'HH:mm')}
                {msg.isMe && (
                   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </span>
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
