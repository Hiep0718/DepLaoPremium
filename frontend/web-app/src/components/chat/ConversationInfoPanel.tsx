import { useState, useMemo } from 'react';
import { X, Bell, Pin, UserPlus, Clock, Users, Image as ImageIcon, FileText, Link, Shield, Eye, AlertTriangle, Trash2, ChevronDown, Sparkles } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { clearAiHistory } from '../../services/aiChat.service';
import { useAuthStore } from '../../stores/authStore';

const ConversationInfoPanel = () => {
  const { activeConversation, activeContactInfo, toggleInfoPanel, messages } = useChatStore();
  const [expandedMedia, setExpandedMedia] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState(true);
  const [expandedLinks, setExpandedLinks] = useState(true);

  const mediaMessages = useMemo(() => {
    return messages.filter(m => !m.isRevoked && (m.messageType === 'image' || m.messageType === 'video') && m.fileUrl);
  }, [messages]);

  const fileMessages = useMemo(() => {
    return messages.filter(m => !m.isRevoked && m.messageType === 'file' && m.fileUrl);
  }, [messages]);

  const linkMessages = useMemo(() => {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    return messages.filter(m => {
      if (m.isRevoked) return false;
      if (m.messageType !== 'text') return false;
      const text = m.content || m.text || '';
      return linkRegex.test(text);
    }).map(m => {
       const text = m.content || m.text || '';
       const links = text.match(linkRegex) || [];
       return { ...m, extractedLinks: links };
    });
  }, [messages]);

  if (!activeConversation) return null;

  const isAiConversation = activeConversation.conversationId.startsWith('ai_');

  // Use resolved contact info from store
  const displayName = activeContactInfo?.name || 'Người dùng';
  const displayAvatar = activeContactInfo?.avatarUrl;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="w-80 h-full flex flex-col border-l theme-transition overflow-hidden shrink-0"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-primary)' }}>

      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          Thông tin hội thoại
        </h3>
        <button onClick={toggleInfoPanel}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isAiConversation ? (
          <div className="flex flex-col">
            {/* AI Profile Section */}
            <div className="flex flex-col items-center py-8 px-4 text-center"
              style={{ borderBottom: '6px solid var(--border-light)' }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-4xl text-white mb-4 shadow-xl ring-4 ring-orange-500/20"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                🍜
              </div>
              <h4 className="font-bold text-xl mb-1.5" style={{ color: 'var(--text-primary)' }}>Bếp AI</h4>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase" 
                style={{ color: '#ea580c', borderColor: 'rgba(234,88,12,0.3)', background: 'rgba(234,88,12,0.1)', border: '1px solid currentColor' }}>
                Trợ lý Ảo
              </span>
              <p className="text-sm mt-4 opacity-90 leading-relaxed max-w-[240px]" style={{ color: 'var(--text-secondary)' }}>
                Trợ lý AI chuyên biệt, hỗ trợ tìm kiếm công thức, gợi ý thực đơn và giải đáp kiến thức ẩm thực chuyên sâu.
              </p>
            </div>

            {/* Quick Suggestions */}
            <div className="py-4" style={{ borderBottom: '6px solid var(--border-light)' }}>
              <div className="px-4 mb-3">
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles size={16} style={{ color: '#f97316' }} /> Gợi ý nhanh
                </span>
              </div>
              <div className="flex flex-col gap-2 px-4">
                {[
                  'Cách nấu phở bò chuẩn vị',
                  'Gợi ý thực đơn chay cả tuần',
                  'Mẹo bảo quản rau củ tươi lâu',
                  'Cách làm món tráng miệng đơn giản'
                ].map((prompt, idx) => (
                  <button key={idx} className="text-left text-sm py-2.5 px-3 mb-1 rounded-xl transition-all group shadow-sm hover:shadow"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#ea580c'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onClick={() => {
                        const evt = new CustomEvent('ai_prompt_selected', { detail: prompt });
                        window.dispatchEvent(evt);
                    }}
                  >
                    <span className="line-clamp-2">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="py-2">
              <div className="px-4 py-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Cài đặt cuộc trò chuyện
                </span>
              </div>
              <button className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={async () => {
                  if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ và lịch sử của AI không?")) {
                    const userId = useAuthStore.getState().user?.id?.toString();
                    if (userId) {
                      try {
                        await clearAiHistory(userId);
                        useChatStore.getState().setMessages([]);
                      } catch { /* ignore */ }
                    }
                  }
                }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <div className="flex-1">
                  <span className="text-sm font-medium" style={{ color: '#ef4444' }}>Xóa lịch sử & làm mới AI</span>
                  <p className="text-[11px] mt-0.5 opacity-80" style={{ color: 'var(--text-secondary)' }}>Làm mới phiên trò chuyện từ đầu</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
        <div className="flex flex-col items-center py-5 px-4"
          style={{ borderBottom: '6px solid var(--border-light)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white overflow-hidden mb-3"
            style={{ background: displayAvatar ? 'transparent' : '#0068FF' }}>
            {displayAvatar ? (
              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              avatarLetter
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </span>
            <button className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-6 py-4 px-4"
          style={{ borderBottom: '6px solid var(--border-light)' }}>
          {[
            { icon: Bell, label: 'Tắt thông\nbáo' },
            { icon: Pin, label: 'Ghim hội\nthoại' },
            { icon: UserPlus, label: 'Tạo nhóm\ntrò chuyện' },
          ].map(({ icon: Icon, label }, i) => (
            <button key={i} className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-hover)' }}>
                <Icon size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <span className="text-[11px] text-center leading-tight whitespace-pre-line"
                style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Info Items */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Danh sách nhắc hẹn</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>1 nhóm chung</span>
          </button>
        </div>

        {/* Ảnh/Video Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onClick={() => setExpandedMedia(!expandedMedia)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ảnh/Video</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: expandedMedia ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {expandedMedia && (
            <div className="px-4 py-2 transition-all">
              {mediaMessages.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {mediaMessages.slice(0, 8).map((msg, idx) => (
                      <div key={idx} className="aspect-square rounded-md overflow-hidden relative cursor-pointer group"
                        onClick={() => window.open(msg.fileUrl, '_blank')}
                        style={{ background: 'var(--bg-hover)' }}>
                        {msg.messageType === 'video' ? (
                          <>
                            <video src={msg.fileUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-white text-[10px] translate-x-[1px]">▶</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={msg.fileUrl} alt="media" className="w-full h-full object-cover group-hover:brightness-75 transition-all" />
                        )}
                      </div>
                    ))}
                  </div>
                  {mediaMessages.length > 8 && (
                    <button className="w-full py-2 mt-2 rounded-lg text-sm font-medium transition-colors text-center"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                      Xem tất cả ({mediaMessages.length})
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Chưa có Ảnh/Video được chia sẻ trong hội thoại này
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onClick={() => setExpandedFiles(!expandedFiles)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>File</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: expandedFiles ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {expandedFiles && (
            <div className="px-4 py-2">
              {fileMessages.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {fileMessages.slice(0, 5).map((msg, idx) => {
                    const ext = msg.fileUrl ? msg.fileUrl.split('.').pop()?.toUpperCase() : 'FILE';
                    const fileName = msg.fileName || (msg.content && msg.content.replace('[Tệp] ', '')) || 'Tài liệu vô danh';
                    return (
                      <a key={idx} href={msg.fileUrl} target="_blank" rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)] group">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(0,104,255,0.1)' }}>
                          <FileText size={20} style={{ color: '#0068FF' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                            {fileName}
                          </p>
                          <p className="text-[11px] mt-0.5 uppercase" style={{ color: 'var(--text-secondary)' }}>
                            {ext && ext.length <= 5 ? ext : 'FILE'} {msg.fileSize ? `• ${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                  {fileMessages.length > 5 && (
                    <button className="w-full py-2 mt-1 rounded-lg text-sm font-medium transition-colors text-center"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                      Xem tất cả ({fileMessages.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Chưa có File được chia sẻ trong hội thoại này
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Link Section */}
        <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            onClick={() => setExpandedLinks(!expandedLinks)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Link</span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: expandedLinks ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {expandedLinks && (
            <div className="px-4 py-2">
              {linkMessages.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {linkMessages.slice(0, 5).map((msg, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: 'var(--border-light)' }}>
                      {msg.extractedLinks.map((link: string, linkIdx: number) => (
                        <a key={linkIdx} href={link} target="_blank" rel="noopener noreferrer" 
                          className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)] group">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(0,104,255,0.1)' }}>
                            <Link size={18} style={{ color: '#0068FF' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-[#0068FF] group-hover:underline">
                              {link}
                            </p>
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                              {msg.content || msg.text}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ))}
                  {linkMessages.length > 5 && (
                    <button className="w-full py-2 mt-1 rounded-lg text-sm font-medium transition-colors text-center"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                      Xem tất cả ({linkMessages.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Chưa có Link được chia sẻ trong hội thoại này
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thiết lập bảo mật */}
        <div className="py-2">
          <div className="px-4 py-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Thiết lập bảo mật
            </span>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Shield size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="flex-1">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Tin nhắn tự xóa</span>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Không bao giờ</p>
            </div>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="flex items-center gap-3">
              <Eye size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Ẩn trò chuyện</span>
            </div>
            <div className="w-9 h-5 rounded-full relative transition-colors" style={{ background: 'var(--bg-hover)' }}>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" />
            </div>
          </button>

          <div className="mt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <AlertTriangle size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Báo xấu</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={async () => {
                if (window.confirm("Bạn có chắc chắn muốn xóa lịch sử trò chuyện này? Thao tác này sẽ xóa toàn bộ tin nhắn đối với bạn.")) {
                   const { useAuthStore } = await import('../../stores/authStore');
                   const userId = useAuthStore.getState().user?.id?.toString();
                   if (userId) {
                     useChatStore.getState().deleteActiveConversationHistory(userId);
                   }
                }
              }}>
              <Trash2 size={18} style={{ color: '#ef4444' }} />
              <span className="text-sm" style={{ color: '#ef4444' }}>Xoá lịch sử trò chuyện</span>
            </button>
          </div>
        </div>
      </div>
      )}
      </div>
    </div>
  );
};

export default ConversationInfoPanel;
