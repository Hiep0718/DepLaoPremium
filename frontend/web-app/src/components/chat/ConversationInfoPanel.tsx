import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Bell, Pin, UserPlus, Clock, Users, Image as ImageIcon, FileText, Link, Shield, Eye, AlertTriangle, Trash2, ChevronDown, MoreHorizontal, Crown, UserCheck, UserMinus, Settings, LogOut, Sparkles } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { clearAiHistory } from '../../services/aiChat.service';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/axios';
import { contactService } from '../../services/contactService';
import { updateMemberRole, getConversationsList, removeMemberFromGroup, addMembersToGroup, disbandGroup, updateGroupInfo, toggleRequireApproval, approvePendingMember, rejectPendingMember } from '../../services/message.service';
import AddMemberModal from './AddMemberModal';


const ConversationInfoPanel = () => {
  const { activeConversation, activeContactInfo, toggleInfoPanel, messages, setActiveConversation, setConversations } = useChatStore();
  const { user } = useAuthStore();
  const [expandedMedia, setExpandedMedia] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState(true);
  const [expandedLinks, setExpandedLinks] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState(false);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const [menuOpenUid, setMenuOpenUid] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [expandedPending, setExpandedPending] = useState(false);
  const [pendingMemberMap, setPendingMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenUid(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xác định user hiện tại có phải leader không
  const myRole = useMemo(() => {
    if (!activeConversation?.isGroup || !user?.id) return 'member';
    const me = activeConversation.participants?.find(
      (p: any) => String(p.userId || p.id || p) === String(user.id)
    );
    return (me as any)?.role || 'member';
  }, [activeConversation, user?.id]);

  const handleRoleChange = async (targetUserId: string, newRole: 'leader' | 'deputy' | 'member') => {
    if (!activeConversation?.conversationId || !user?.id) return;

    const roleLabels: Record<string, string> = { leader: 'Trưởng nhóm', deputy: 'Phó nhóm', member: 'Thành viên' };
    const confirmMsg = newRole === 'leader'
      ? `Bạn có chắc muốn trao quyền Trưởng nhóm? Bạn sẽ trở thành Thành viên.`
      : `Đổi vai trò thành ${roleLabels[newRole]}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateMemberRole(
        activeConversation.conversationId,
        String(user.id),
        targetUserId,
        newRole
      );

      // Reload conversation data từ backend
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thay đổi vai trò');
    } finally {
      setMenuOpenUid(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeConversation?.conversationId || !user?.id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?')) return;

    try {
      await removeMemberFromGroup(
        activeConversation.conversationId,
        String(user.id),
        targetUserId
      );

      // Reload conversation data từ backend
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa thành viên');
    } finally {
      setMenuOpenUid(null);
    }
  };

  // Fetch thông tin các thành viên nhóm
  useEffect(() => {
    if (!activeConversation?.isGroup || !activeConversation.participants?.length) return;
    const fetchMembers = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      for (const p of activeConversation.participants) {
        const uid = String((p as any).userId || (p as any).id || p);
        if (!uid) continue;
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName, avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }
      setMemberMap(map);
    };
    fetchMembers();
  }, [activeConversation?.conversationId, activeConversation?.isGroup, activeConversation?.participants?.length]);

  // Fetch thông tin các thành viên đang chờ duyệt
  useEffect(() => {
    if (!activeConversation?.isGroup || !activeConversation.pendingMembers?.length) {
      setPendingMemberMap({});
      return;
    }
    const fetchPending = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      for (const pm of activeConversation.pendingMembers!) {
        const uid = String(pm.userId);
        if (!uid || pendingMemberMap[uid]) continue;
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName, avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }
      setPendingMemberMap(prev => ({ ...prev, ...map }));
    };
    fetchPending();
  }, [activeConversation?.pendingMembers?.length]);

  const handleToggleApproval = async () => {
    if (!activeConversation?.conversationId || !user?.id) return;
    const newValue = !activeConversation.requireApproval;
    try {
      await toggleRequireApproval(activeConversation.conversationId, String(user.id), newValue);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thay đổi cài đặt');
    }
  };

  const handleApproveMember = async (userId: string) => {
    if (!activeConversation?.conversationId || !user?.id) return;
    try {
      await approvePendingMember(activeConversation.conversationId, String(user.id), [userId]);
      // Reload conversation
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể duyệt thành viên');
    }
  };

  const handleRejectMember = async (userId: string) => {
    if (!activeConversation?.conversationId || !user?.id) return;
    try {
      await rejectPendingMember(activeConversation.conversationId, String(user.id), [userId]);
      // Reload conversation
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể từ chối thành viên');
    }
  };

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

  const handleAddMembersConfirm = async (userIds: string[]) => {
    if (!activeConversation?.conversationId || !user?.id) return;
    try {
      await addMembersToGroup(activeConversation.conversationId, String(user.id), userIds);

      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thêm thành viên. Vui lòng thử lại.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation?.conversationId || !user?.id) return;
    if (!window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này không?")) return;

    try {
      await removeMemberFromGroup(
        activeConversation.conversationId,
        String(user.id),
        String(user.id)
      );

      // Cập nhật sau khi rời nhóm
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        setActiveConversation(null); // Đóng nhóm hiện tại
        toggleInfoPanel(); // Đóng panel
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi rời nhóm.');
    }
  };

  const handleDisbandGroup = async () => {
    if (!activeConversation?.conversationId || !user?.id) return;
    if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn giải tán nhóm này? Toàn bộ thành viên sẽ bị xóa và không thể khôi phục lại nhóm.")) return;

    try {
      await disbandGroup(activeConversation.conversationId, String(user.id));
      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        setActiveConversation(null);
        toggleInfoPanel();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi giải tán nhóm.');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation?.conversationId || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh phải < 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const url = await contactService.uploadFile(file, 'avatar');
      await updateGroupInfo(
        activeConversation.conversationId,
        String(user.id),
        undefined,
        url
      );

      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (error) {
      console.error('Error changing group avatar:', error);
      alert('Không thể đổi ảnh nhóm. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!activeConversation?.conversationId || !user?.id || !newGroupName.trim()) return;

    try {
      await updateGroupInfo(
        activeConversation.conversationId,
        String(user.id),
        newGroupName.trim()
      );

      const res = await getConversationsList(String(user.id));
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setConversations(list);
        const updated = list.find((c: any) => c.conversationId === activeConversation.conversationId);
        if (updated) setActiveConversation(updated);
      }
      setIsRenameModalOpen(false);
      setNewGroupName('');
    } catch (error) {
      console.error('Error renaming group:', error);
      alert('Không thể đổi tên nhóm. Vui lòng thử lại.');
    }
  };

  if (!activeConversation) return null;

  const isAiConversation = activeConversation.conversationId.startsWith('ai_');

  // Use resolved contact info from store
  const displayName = activeConversation.isGroup ? (activeConversation.groupName || 'Nhóm trò chuyện') : (activeContactInfo?.name || 'Người dùng');
  const displayAvatar = activeConversation.isGroup ? activeConversation.groupAvatar : activeContactInfo?.avatarUrl;
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
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center py-5 px-4"
            style={{ borderBottom: '6px solid var(--border-light)' }}>
            {activeConversation.isGroup && (
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            )}
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white mb-3 relative overflow-hidden shadow-sm ${(activeConversation.isGroup && !uploadingAvatar) ? 'cursor-pointer group' : ''}`}
              style={{ background: displayAvatar ? 'transparent' : '#0068FF' }}
              onClick={() => {
                if (activeConversation.isGroup && !uploadingAvatar) {
                  fileInputRef.current?.click();
                }
              }}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                avatarLetter
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
              {activeConversation.isGroup && !uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                  <ImageIcon size={20} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </span>
              {activeConversation.isGroup && (
                <button className="p-1 rounded-md transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    setNewGroupName(activeConversation.groupName || '');
                    setIsRenameModalOpen(true);
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center gap-6 py-4 px-4"
            style={{ borderBottom: '6px solid var(--border-light)' }}>
            {(activeConversation.isGroup ? [
              { icon: Bell, label: 'Tắt thông\nbáo' },
              { icon: Pin, label: 'Ghim hội\nthoại' },
              { icon: UserPlus, label: 'Thêm thành\nviên', action: () => setIsAddMemberOpen(true) },
              { icon: Settings, label: 'Quản lý\nnhóm' },
            ] : [
              { icon: Bell, label: 'Tắt thông\nbáo' },
              { icon: Pin, label: 'Ghim hội\nthoại' },
              { icon: UserPlus, label: 'Tạo nhóm\ntrò chuyện' },
            ]).map(({ icon: Icon, label, action }, i) => (
              <button key={i} className="flex flex-col items-center gap-1.5 group cursor-pointer" onClick={action}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'var(--bg-hover)' }}>
                  <Icon size={18} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <span className="text-[11px] text-center leading-tight whitespace-pre-line"
                  style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Info Items / Thành viên nhóm */}
          <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
            {activeConversation.isGroup ? (
              <>
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                  onClick={() => setExpandedMembers(!expandedMembers)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Thành viên nhóm ({activeConversation.participants?.length || 0})
                    </span>
                  </div>
                  <ChevronDown size={16} style={{
                    color: 'var(--text-secondary)',
                    transform: expandedMembers ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }} />
                </button>
                {expandedMembers && (
                  <div className="px-2 pb-2" ref={menuRef}>
                    {[...(activeConversation.participants || [])]
                      .sort((a: any, b: any) => {
                        const order: Record<string, number> = { leader: 0, deputy: 1, member: 2 };
                        return (order[a.role] ?? 2) - (order[b.role] ?? 2);
                      })
                      .map((p: any, idx: number) => {
                        const uid = String(p.userId || p.id || p);
                        const info = memberMap[uid];
                        const isMe = uid === String(user?.id);
                        const name = isMe ? 'Bạn' : (info?.fullName || `Thành viên ${idx + 1}`);
                        const avatar = info?.avatarUrl;
                        const role = p.role || 'member';

                        const roleBadge: Record<string, { label: string; bg: string; color: string }> = {
                          leader: { label: 'Trưởng nhóm', bg: '#fff7ed', color: '#f59e0b' },
                          deputy: { label: 'Phó nhóm', bg: '#f0fdf4', color: '#10b981' },
                          member: { label: 'Thành viên', bg: 'transparent', color: 'var(--text-secondary)' },
                        };

                        // Xây dựng menu items cho quyền quản lý
                        const menuItems: { label: string; icon: any; action: () => void; color?: string }[] = [];

                        if (myRole === 'leader' && !isMe) {
                          menuItems.push({
                            label: 'Chuyển quyền trưởng nhóm',
                            icon: Crown,
                            action: () => handleRoleChange(uid, 'leader'),
                            color: '#f59e0b',
                          });
                          if (role !== 'deputy') {
                            menuItems.push({
                              label: 'Bổ nhiệm phó nhóm',
                              icon: UserCheck,
                              action: () => handleRoleChange(uid, 'deputy'),
                              color: '#10b981',
                            });
                          }
                          if (role === 'deputy') {
                            menuItems.push({
                              label: 'Gỡ phó nhóm',
                              icon: UserMinus,
                              action: () => handleRoleChange(uid, 'member'),
                              color: '#ef4444',
                            });
                          }
                        }

                        // Quyền xóa thành viên: leader xóa auth, deputy xóa member
                        if (!isMe && (myRole === 'leader' || (myRole === 'deputy' && role === 'member'))) {
                          menuItems.push({
                            label: 'Xóa khỏi nhóm', // <--- MỚI THÊM
                            icon: Trash2,
                            action: () => handleRemoveMember(uid),
                            color: '#ef4444',
                          });
                        }

                        return (
                          <div
                            key={uid}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors relative"
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden"
                              style={{ background: avatar ? 'transparent' : (isMe ? '#10b981' : '#0068FF') }}
                            >
                              {avatar ? (
                                <img src={avatar} alt={name} className="w-full h-full object-cover" />
                              ) : (
                                name.charAt(0).toUpperCase()
                              )}
                            </div>
                            {/* Name + role */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {name}
                              </p>
                              {roleBadge[role] && (
                                <div className="mt-0.5">
                                  {role === 'member' ? (
                                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                      {roleBadge[role].label}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase inline-block"
                                      style={{
                                        background: roleBadge[role].bg,
                                        color: roleBadge[role].color,
                                        border: `1px solid ${roleBadge[role].color}40`
                                      }}>
                                      {roleBadge[role].label}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 3-dot menu */}
                            {menuItems.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenUid(menuOpenUid === uid ? null : uid);
                                  }}
                                  className="p-1 rounded-md transition-colors"
                                  style={{ color: 'var(--text-secondary)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-search, #e5e7eb)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {menuOpenUid === uid && (
                                  <div
                                    className="absolute right-0 top-8 z-50 min-w-[200px] py-1.5 rounded-xl shadow-lg border"
                                    style={{
                                      background: 'var(--bg-panel, #fff)',
                                      borderColor: 'var(--border-primary, #e5e7eb)',
                                      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                    }}
                                  >
                                    {menuItems.map((item, mIdx) => (
                                      <button
                                        key={mIdx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          item.action();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                      >
                                        <item.icon size={15} style={{ color: item.color || 'var(--text-secondary)' }} />
                                        <span style={{ color: 'var(--text-primary, #111)' }}>{item.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Cài đặt duyệt thành viên - Chỉ hiện cho leader/deputy */}
          {activeConversation.isGroup && (myRole === 'leader' || myRole === 'deputy') && (
            <div className="py-2" style={{ borderBottom: '6px solid var(--border-light)' }}>
              <div className="px-4 py-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Quản lý thành viên
                </span>
              </div>
              {/* Toggle duyệt thành viên */}
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={handleToggleApproval}
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} style={{ color: '#0068FF' }} />
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Duyệt thành viên mới</span>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {activeConversation.requireApproval ? 'Thành viên thêm người cần được Admin duyệt' : 'Mọi thành viên đều có thể thêm người'}
                    </p>
                  </div>
                </div>
                <div className="w-10 h-[22px] rounded-full relative transition-colors cursor-pointer flex-shrink-0"
                  style={{ background: activeConversation.requireApproval ? '#0068FF' : 'var(--bg-hover)' }}>
                  <div className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                    style={{ left: activeConversation.requireApproval ? '21px' : '3px' }} />
                </div>
              </button>

              {/* Danh sách chờ duyệt */}
              {activeConversation.pendingMembers && activeConversation.pendingMembers.length > 0 && (
                <>
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                    onClick={() => setExpandedPending(!expandedPending)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus size={18} style={{ color: '#f59e0b' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chờ duyệt ({activeConversation.pendingMembers.length})
                      </span>
                    </div>
                    <ChevronDown size={16} style={{
                      color: 'var(--text-secondary)',
                      transform: expandedPending ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }} />
                  </button>
                  {expandedPending && (
                    <div className="px-2 pb-2">
                      {activeConversation.pendingMembers.map((pm: any) => {
                        const uid = String(pm.userId);
                        const info = pendingMemberMap[uid];
                        const name = info?.fullName || `User ${uid}`;
                        const avatar = info?.avatarUrl;
                        const addedByInfo = memberMap[String(pm.addedBy)];
                        const addedByName = addedByInfo?.fullName || `User ${pm.addedBy}`;

                        return (
                          <div
                            key={uid}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden"
                              style={{ background: avatar ? 'transparent' : '#f59e0b' }}
                            >
                              {avatar ? (
                                <img src={avatar} alt={name} className="w-full h-full object-cover" />
                              ) : (
                                name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {name}
                              </p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                Được mời bởi {addedByName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleApproveMember(uid)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all hover:scale-110"
                                style={{ background: '#10b981' }}
                                title="Duyệt"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleRejectMember(uid)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all hover:scale-110"
                                style={{ background: '#ef4444' }}
                                title="Từ chối"
                              >
                                ✗
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
              {activeConversation.isGroup && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={handleLeaveGroup}>
                  <LogOut size={18} style={{ color: '#ef4444' }} />
                  <span className="text-sm" style={{ color: '#ef4444' }}>Rời nhóm</span>
                </button>
              )}
              {activeConversation.isGroup && myRole === 'leader' && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={handleDisbandGroup}>
                  <Trash2 size={18} style={{ color: '#ef4444' }} />
                  <span className="text-sm" style={{ color: '#ef4444' }}>Giải tán nhóm</span>
                </button>
              )}
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


      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onConfirm={handleAddMembersConfirm}
        existingMemberIds={activeConversation?.participants?.map((p: any) => String(p.userId || p.id)) || []}
      />

      {/* Rename Group Modal */}
        {isRenameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[400px] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
              style={{ background: 'var(--bg-panel)' }}>
              <div className="h-14 px-4 flex items-center justify-between border-b"
                style={{ borderColor: 'var(--border-primary)' }}>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Đổi tên nhóm</h2>
                <button
                  onClick={() => setIsRenameModalOpen(false)}
                  className="p-1.5 rounded-xl transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4">
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm mới..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none border focus:ring-2 focus:ring-blue-500/20"
                  style={{
                    background: 'var(--bg-search)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameGroup();
                  }}
                />
              </div>

              <div className="p-4 pt-2 flex justify-end gap-2 border-t"
                style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-6 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleRenameGroup}
                  disabled={!newGroupName.trim() || newGroupName.trim() === activeConversation.groupName}
                  className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#0068FF' }}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
};

      export default ConversationInfoPanel;
