import { useState, useEffect } from 'react';
import { X, Search, ChevronDown, FileText } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { searchMessages } from '../../services/message.service';


const ConversationSearchPanel = () => {
  const isSearchPanelOpen = useChatStore((state) => state.isSearchPanelOpen);
  const toggleSearchPanel = useChatStore((state) => state.toggleSearchPanel);
  const activeConversation = useChatStore((state) => state.activeConversation);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isSearchPanelOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isSearchPanelOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim() && activeConversation?.conversationId) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, activeConversation?.conversationId]);

  const handleSearch = async () => {
    if (!activeConversation?.conversationId || !query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await searchMessages(activeConversation.conversationId, query.trim());
      if (response.data && response.data.success) {
        setResults(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search messages:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} style={{ backgroundColor: 'yellow', color: 'black' }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optional: Add a highlight animation class temporarily
      element.classList.add('bg-yellow-100', 'transition-colors', 'duration-500');
      setTimeout(() => {
        element.classList.remove('bg-yellow-100');
      }, 2000);
    }
  };

  if (!isSearchPanelOpen) return null;

  return (
    <div className="w-[340px] flex flex-col theme-transition shrink-0" 
         style={{ background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-primary)' }}>
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between border-b"
           style={{ borderColor: 'var(--border-primary)' }}>
        <h2 className="font-semibold text-[16px]" style={{ color: 'var(--text-primary)' }}>
          Tìm kiếm trong trò chuyện
        </h2>
        <button 
          onClick={toggleSearchPanel}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search Input & Filters */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:border-blue-500 transition-colors"
            placeholder="Nhập từ khóa để tìm kiếm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ 
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-gray-500">Lọc theo:</span>
          <button className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-gray-700 hover:bg-gray-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Người gửi
            <ChevronDown size={14} />
          </button>
          <button className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-gray-700 hover:bg-gray-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Ngày gửi
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Results or Empty State */}
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mb-4 relative">
              <FileText size={48} className="text-blue-100" />
              <Search size={64} className="text-blue-400 absolute" style={{ bottom: '10px', right: '10px', transform: 'rotate(10deg)' }} />
            </div>
            <p className="text-gray-500 text-sm">
              Hãy nhập từ khóa để bắt đầu tìm kiếm<br/>tin nhắn và file trong trò chuyện
            </p>
          </div>
        ) : isSearching ? (
          <div className="flex justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : results.length > 0 ? (
          <div className="p-2">
            {results.map((msg) => (
              <div 
                key={msg._id} 
                className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border-b last:border-b-0"
                style={{ borderColor: 'var(--border-primary)' }}
                onClick={() => scrollToMessage(msg._id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-[13px] truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                    {/* Ideally we map senderId to a name here, but for now we just show a generic label or senderId if possible */}
                    Người gửi
                  </span>
                  <span className="text-[11px] text-gray-400 ml-2 whitespace-nowrap">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
                <p className="text-[13px] text-gray-600 line-clamp-2 break-words">
                  {highlightText(msg.content || '', query)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <p className="text-gray-500 text-sm">Không tìm thấy kết quả nào cho "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationSearchPanel;
