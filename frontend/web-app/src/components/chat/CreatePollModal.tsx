import React from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import { socket } from '../../services/socket';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  initialData?: { question: string, options: any[] };
  messageId?: string;
}

const CreatePollModal: React.FC<CreatePollModalProps> = ({ isOpen, onClose, conversationId, initialData, messageId }) => {
  const [question, setQuestion] = React.useState('');
  const [options, setOptions] = React.useState(['', '']);

  React.useEffect(() => {
    if (initialData) {
      setQuestion(initialData.question);
      setOptions(initialData.options.map(o => o.text));
    } else {
      setQuestion('');
      setOptions(['', '']);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const filteredOptions = options.filter(opt => opt.trim() !== '');
    if (!question.trim()) {
      alert('Vui lòng nhập câu hỏi');
      return;
    }
    if (filteredOptions.length < 2) {
      alert('Vui lòng nhập ít nhất 2 phương án');
      return;
    }

    if (messageId) {
       socket.emit('update_poll', {
         messageId,
         conversationId,
         question: question.trim(),
         options: filteredOptions
       });
    } else {
      socket.emit('create_poll', {
        conversationId,
        question: question.trim(),
        options: filteredOptions
      });
    }

    // Reset and close
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--bg-panel)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-bounce-in border border-[var(--border-light)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-hover)]">
          <div className="flex items-center gap-2 text-[#0068FF]">
            <BarChart2 size={24} />
            <h3 className="text-lg font-bold">{messageId ? 'Chỉnh sửa bình chọn' : 'Tạo bình chọn'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Câu hỏi</label>
            <input
              type="text"
              placeholder="Nhập câu hỏi bình chọn..."
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-[#0068FF]/50 focus:border-[#0068FF] transition-all"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold mb-1 text-[var(--text-secondary)] uppercase tracking-wider">Các phương án</label>
            {options.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={`Phương án ${idx + 1}`}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-[#0068FF]/50 focus:border-[#0068FF] transition-all pr-10"
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-xs font-bold opacity-50">
                    {idx + 1}
                  </div>
                </div>
                {options.length > 2 && (
                  <button 
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 10 && (
              <button
                onClick={handleAddOption}
                className="flex items-center gap-2 text-[#0068FF] font-medium px-4 py-2 rounded-xl hover:bg-[#0068FF]/10 transition-colors w-full justify-center border border-dashed border-[#0068FF]/30 mt-2"
              >
                <Plus size={18} />
                <span>Thêm phương án</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleSubmit}
            className="w-full bg-[#0068FF] text-white font-bold py-3.5 rounded-xl hover:bg-[#0055D4] transition-all shadow-lg shadow-[#0068FF]/20 active:scale-[0.98]"
          >
            {messageId ? 'Cập nhật bình chọn' : 'Tạo bình chọn'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePollModal;
