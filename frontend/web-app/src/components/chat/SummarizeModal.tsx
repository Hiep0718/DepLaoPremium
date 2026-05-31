import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Loader2, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../services/axios';
import { Message } from '../../stores/chatStore';

interface SummarizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  memberMap: Record<string, any>;
  unreadCount: number;
}

const SummarizeModal: React.FC<SummarizeModalProps> = ({ isOpen, onClose, messages, memberMap, unreadCount }) => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      handleSummarize();
    } else {
      setSummary('');
      setError('');
    }
  }, [isOpen]);

  const handleSummarize = async () => {
    try {
      setLoading(true);
      setError('');
      setSummary('');

      // Lấy max(unreadCount, 10) tin nhắn gần nhất
      const summarizeCount = Math.max(unreadCount, 10);
      const recentMessages = [...messages].slice(-summarizeCount); // Lấy N tin nhắn cuối mảng (mới nhất)

      // Lọc tin rác
      const validMessages = recentMessages.filter(m => {
        if (m.isRevoked) return false;
        if (m.messageType === 'system') return false;
        if (m.messageType === 'text') {
          const text = (m.content || m.text || '').trim();
          if (text.length < 2) return false; // Lọc tin siêu ngắn
        }
        return true;
      });

      if (validMessages.length === 0) {
        setSummary('Không có đủ dữ liệu hội thoại để tóm tắt.');
        setLoading(false);
        return;
      }

      // Format thành transcript
      const transcript = validMessages.map(m => {
        const name = memberMap[m.senderId]?.fullName || m.senderId;
        const typeStr = m.messageType !== 'text' ? `[Gửi ${m.messageType}]` : '';
        const content = m.content || m.text || '';
        return `${name}: ${typeStr} ${content}`;
      }).join('\n');

      const res = await api.post('/ai-chat/summarize', { transcript });
      
      if (res.data?.success) {
        setSummary(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Có lỗi xảy ra');
      }
    } catch (err: any) {
      console.error('Lỗi tóm tắt:', err);
      setError(err.message || 'Không thể kết nối đến Bếp AI.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999]">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI Tóm Tắt</h2>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 
                  ? `Đang tóm tắt ${Math.max(unreadCount, 10)} tin nhắn chưa đọc` 
                  : `Đang tóm tắt 10 tin nhắn gần nhất`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={40} className="text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500 font-medium animate-pulse">Bếp AI đang phân tích hội thoại...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3">
              <Bot size={24} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <div className="ai-markdown-content text-[15px] leading-relaxed">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4 marker:text-orange-500" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 mb-4 marker:text-orange-500" {...props} />,
                  li: ({node, ...props}) => <li className="pl-1" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-orange-600" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-active)' }}>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SummarizeModal;
