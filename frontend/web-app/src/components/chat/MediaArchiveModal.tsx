import React, { useState, useEffect, useMemo } from 'react';
import { X, ImageIcon, FileText, Link as LinkIcon, Mic, Search, ChevronDown, Download, Share2, Trash2, ExternalLink } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/axios';
import { format, isYesterday, isToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MediaArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  initialTab?: TabType;
}

type TabType = 'media' | 'file' | 'link' | 'audio';

const MediaArchiveModal: React.FC<MediaArchiveModalProps> = ({ isOpen, onClose, conversationId, initialTab = 'media' }) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [senderFilter, setSenderFilter] = useState<string>('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen, activeTab, conversationId, senderFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchConversationDetails();
    }
  }, [isOpen, conversationId]);

  const fetchConversationDetails = async () => {
    try {
      const res = await api.get(`/messages/conversations/${user?.id}`);
      const list = res.data?.data || res.data || [];
      const conv = list.find((c: any) => c.conversationId === conversationId);
      if (conv?.participants) {
        setParticipants(conv.participants);
        const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
        for (const p of conv.participants) {
          const uid = String(p.userId || p.id);
          const userRes = await api.get(`/users/${uid}`);
          if (userRes.data?.data) {
            map[uid] = userRes.data.data;
          }
        }
        setMemberMap(map);
      }
    } catch (err) {
      console.error('Error fetching conversation details:', err);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let url = `/messages/conversation/${conversationId}/media?type=${activeTab}`;
      if (senderFilter) url += `&senderId=${senderFilter}`;
      
      const res = await api.get(url);
      setMessages(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: Record<string, any[]> = {};
    messages.forEach(msg => {
      const date = parseISO(msg.createdAt);
      let dateStr = '';
      if (isToday(date)) dateStr = 'Hôm nay';
      else if (isYesterday(date)) dateStr = 'Hôm qua';
      else dateStr = format(date, 'dd MMMM, yyyy', { locale: vi });

      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(msg);
    });
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-panel)] w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-primary)]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Kho lưu trữ</h2>
            <div className="flex bg-[var(--bg-search)] rounded-lg p-1">
              {[
                { id: 'media', icon: ImageIcon, label: 'Ảnh/Video' },
                { id: 'file', icon: FileText, label: 'File' },
                { id: 'link', icon: LinkIcon, label: 'Link' },
                { id: 'audio', icon: Mic, label: 'Thoại' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id 
                    ? 'bg-[var(--bg-panel)] text-[#0068FF] shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[var(--text-secondary)]">
            <X size={24} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-[var(--bg-input)] border-b border-[var(--border-primary)] flex items-center gap-4 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-lg text-sm appearance-none outline-none focus:ring-2 focus:ring-[#0068FF]/20"
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value)}
            >
              <option value="">Tất cả người gửi</option>
              {participants.map(p => {
                const uid = String(p.userId || p.id);
                return <option key={uid} value={uid}>{memberMap[uid]?.fullName || uid}</option>;
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" size={14} />
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            {messages.length} mục đã tìm thấy
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-[#0068FF]/20 border-t-[#0068FF] rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <div className="w-20 h-20 bg-[var(--bg-hover)] rounded-full flex items-center justify-center mb-4">
                <ImageIcon size={40} />
              </div>
              <p className="text-lg font-medium">Chưa có nội dung nào</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedMessages.map(group => (
                <div key={group.title}>
                  <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">{group.title}</h3>
                  
                  {activeTab === 'media' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {group.data.map(msg => (
                        <div key={msg._id} className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-hover)] border border-[var(--border-primary)] cursor-pointer">
                          {msg.messageType === 'video' ? (
                            <video src={msg.fileUrl} className="w-full h-full object-cover" />
                          ) : (
                            <img src={msg.fileUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors" title="Tải xuống">
                              <Download size={18} />
                            </button>
                            <button className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors" title="Chia sẻ">
                              <Share2 size={18} />
                            </button>
                          </div>
                          {msg.messageType === 'video' && (
                            <div className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white">VIDEO</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'file' && (
                    <div className="space-y-2">
                      {group.data.map(msg => {
                        const ext = msg.fileUrl?.split('.').pop()?.toUpperCase() || 'FILE';
                        return (
                          <div key={msg._id} className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                              <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{msg.fileName || 'Tài liệu'}</h4>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {ext} • {(msg.fileSize / 1024 / 1024).toFixed(2)} MB • {memberMap[msg.senderId]?.fullName || 'Người dùng'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 hover:bg-[var(--bg-panel)] rounded-lg text-[var(--text-secondary)] hover:text-[#0068FF]" title="Tải xuống">
                                <Download size={18} />
                              </button>
                              <button className="p-2 hover:bg-[var(--bg-panel)] rounded-lg text-[var(--text-secondary)] hover:text-[#ef4444]" title="Xóa">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'link' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.data.map(msg => {
                        const linkRegex = /(https?:\/\/[^\s]+)/g;
                        const links = msg.content.match(linkRegex) || [];
                        return links.map((link: string, lIdx: number) => (
                          <div key={`${msg._id}-${lIdx}`} className="group flex flex-col p-4 rounded-xl border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500 shrink-0">
                                <LinkIcon size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#0068FF] hover:underline truncate block">
                                  {link}
                                </a>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{msg.content}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-[var(--border-primary)] pt-3 mt-auto">
                              <span className="text-[10px] text-[var(--text-secondary)] uppercase">
                                Gửi bởi {memberMap[msg.senderId]?.fullName || 'Người dùng'}
                              </span>
                              <div className="flex items-center gap-2">
                                <button className="p-1.5 hover:bg-[var(--bg-panel)] rounded text-[var(--text-secondary)] hover:text-[#0068FF]">
                                  <Share2 size={14} />
                                </button>
                                <a href={link} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-[var(--bg-panel)] rounded text-[var(--text-secondary)] hover:text-[#0068FF]">
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          </div>
                        ));
                      })}
                    </div>
                  )}

                  {activeTab === 'audio' && (
                    <div className="space-y-2">
                      {group.data.map(msg => (
                        <div key={msg._id} className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                          <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                            <Mic size={20} />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">Tin nhắn thoại</h4>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {format(parseISO(msg.createdAt), 'HH:mm')} • {memberMap[msg.senderId]?.fullName || 'Người dùng'}
                            </p>
                          </div>
                          <button className="px-4 py-1.5 bg-[#0068FF] text-white text-xs font-bold rounded-lg hover:bg-[#005AE0] transition-colors">
                            PHÁT
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaArchiveModal;
