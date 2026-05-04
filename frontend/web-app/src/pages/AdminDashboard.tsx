import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  adminService,
  type AdminStats,
  type MessagingStats,
  type UserItem,
  type PageData,
} from '../services/adminService';
import {
  Users, MessageCircle, UserPlus, ShieldCheck, Search, ChevronLeft, ChevronRight,
  Lock, Unlock, Trash2, LogOut, ArrowLeft, TrendingUp, MessagesSquare, UsersRound, BarChart3, RefreshCw,
} from 'lucide-react';

/* ────────────────────────── Mini Bar Chart (SVG) ────────────────────────── */
const MiniBarChart = ({ data, color = '#6366f1' }: { data: { label: string; value: number }[]; color?: string }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox="0 0 400 120" className="w-full h-28" preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.value / max) * 90;
        return (
          <g key={i}>
            <rect
              x={i * (400 / data.length) + 8}
              y={100 - h}
              width={400 / data.length - 16}
              height={h}
              rx={4}
              fill={color}
              opacity={0.85}
            >
              <animate attributeName="height" from="0" to={h} dur="0.6s" fill="freeze" />
              <animate attributeName="y" from="100" to={100 - h} dur="0.6s" fill="freeze" />
            </rect>
            <text
              x={i * (400 / data.length) + (400 / data.length) / 2}
              y={115}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
              fontFamily="Inter, sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ───────────────────────── Stat Card ───────────────────────── */
const StatCard = ({
  icon: Icon, label, value, sub, gradient,
}: {
  icon: any; label: string; value: string | number; sub?: string; gradient: string;
}) => (
  <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg group hover:scale-[1.02] transition-transform duration-200"
    style={{ background: gradient }}>
    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 group-hover:bg-white/15 transition-colors" />
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
      </div>
      <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [msgStats, setMsgStats] = useState<MessagingStats | null>(null);
  const [users, setUsers] = useState<PageData<UserItem> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Check admin
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Fetch all data
  const fetchAll = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true); else setLoading(true);
      const [s, m, u] = await Promise.all([
        adminService.getAdminStats(),
        adminService.getMessagingStats().catch(() => null),
        adminService.getUsers(page, 10, search),
      ]);
      setStats(s);
      if (m) setMsgStats(m);
      setUsers(u);
    } catch (err: any) {
      console.error(err);
      showToast('Không thể tải dữ liệu', 'err');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Search debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchAll(), 400);
  };

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Actions
  const handleLock = async (u: UserItem) => {
    if (!confirm(`${u.isLocked ? 'Mở khóa' : 'Khóa'} tài khoản "${u.fullName}"?`)) return;
    setActionLoading(u.id);
    try {
      await adminService.lockUser(u.id, !u.isLocked);
      showToast(u.isLocked ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', 'ok');
      fetchAll();
    } catch { showToast('Thao tác thất bại', 'err'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Xóa vĩnh viễn tài khoản "${u.fullName}" (${u.phone})?\n\nHành động này không thể hoàn tác!`)) return;
    setActionLoading(u.id);
    try {
      await adminService.deleteUser(u.id);
      showToast('Đã xóa tài khoản', 'ok');
      fetchAll();
    } catch { showToast('Xóa thất bại', 'err'); }
    finally { setActionLoading(null); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Chart helpers
  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/30 flex items-center justify-center">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Đang tải Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5"
        style={{ background: 'rgba(15,23,42,0.85)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4.5 h-4.5 text-slate-400" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white text-sm font-bold leading-tight">Admin Dashboard</h1>
                <p className="text-slate-500 text-[11px]">Quản lý hệ thống DepLao</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchAll(true)}
              className={`w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors ${refreshing ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <span className="text-slate-300 text-xs font-medium hidden sm:block">{user?.fullName || 'Admin'}</span>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors group">
              <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users} label="Tổng người dùng" value={stats?.totalUsers ?? 0}
            sub={`+${stats?.newUsersThisMonth ?? 0} tháng này`}
            gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
          />
          <StatCard
            icon={UserPlus} label="User mới hôm nay" value={stats?.newUsersToday ?? 0}
            sub={`${stats?.newUsersThisWeek ?? 0} tuần này`}
            gradient="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"
          />
          <StatCard
            icon={MessageCircle} label="Tổng tin nhắn" value={msgStats?.totalMessages?.toLocaleString() ?? '—'}
            sub={`${msgStats?.totalConversations ?? 0} cuộc trò chuyện`}
            gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          />
          <StatCard
            icon={UsersRound} label="Nhóm chat" value={msgStats?.totalGroups ?? '—'}
            sub={`${msgStats?.totalDirectChats ?? 0} chat riêng`}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1e293b' }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4.5 h-4.5 text-indigo-400" />
              <h3 className="text-white text-sm font-semibold">Tăng trưởng User (7 ngày)</h3>
            </div>
            {stats?.userGrowthChart && stats.userGrowthChart.length > 0 ? (
              <MiniBarChart
                data={stats.userGrowthChart.map(d => ({ label: getDayLabel(d.date), value: d.count }))}
                color="#6366f1"
              />
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-500 text-xs">Chưa có dữ liệu</div>
            )}
          </div>

          {/* Messages Chart */}
          <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1e293b' }}>
            <div className="flex items-center gap-2 mb-4">
              <MessagesSquare className="w-4.5 h-4.5 text-amber-400" />
              <h3 className="text-white text-sm font-semibold">Tin nhắn (7 ngày)</h3>
            </div>
            {msgStats?.messagesPerDay && msgStats.messagesPerDay.length > 0 ? (
              <MiniBarChart
                data={msgStats.messagesPerDay.map(d => ({ label: getDayLabel(d.date), value: d.count }))}
                color="#f59e0b"
              />
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-500 text-xs">Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* Message Type Distribution */}
        {msgStats?.messageTypes && msgStats.messageTypes.length > 0 && (
          <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1e293b' }}>
            <h3 className="text-white text-sm font-semibold mb-4">Phân bố loại tin nhắn</h3>
            <div className="flex flex-wrap gap-3">
              {msgStats.messageTypes.map(t => {
                const typeLabels: Record<string, string> = {
                  text: '💬 Văn bản', image: '🖼️ Hình ảnh', video: '🎬 Video', audio: '🎵 Âm thanh',
                  file: '📎 Tệp', sticker: '😀 Sticker', system: '⚙️ Hệ thống', location: '📍 Vị trí',
                  contact: '👤 Liên hệ', reminder: '⏰ Nhắc hẹn', poll: '📊 Bình chọn', group_call: '📞 Cuộc gọi',
                };
                return (
                  <div key={t.type} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-xs text-slate-300">{typeLabels[t.type] || t.type}</span>
                    <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">{t.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Users Table ── */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#1e293b' }}>
          {/* Table Header */}
          <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-white text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Quản lý người dùng
              <span className="text-slate-500 text-xs font-normal ml-1">
                ({users?.totalElements ?? 0} tài khoản)
              </span>
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, SĐT..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SĐT</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày tạo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users?.content.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                          style={{ background: u.avatarUrl ? 'transparent' : `hsl(${(u.id * 47) % 360}, 65%, 55%)` }}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.fullName?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </div>
                        <div>
                          <p className="text-slate-200 font-medium leading-tight">{u.fullName}</p>
                          <p className="text-slate-500 text-xs">ID: {u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-300 font-mono text-xs">{u.phone}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                          : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                      }`}>
                        {u.role === 'ADMIN' && <ShieldCheck className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                          <Lock className="w-3 h-3" /> Đã khóa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          Hoạt động
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role !== 'ADMIN' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleLock(u)}
                            disabled={actionLoading === u.id}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              u.isLocked
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                            } disabled:opacity-40`}
                            title={u.isLocked ? 'Mở khóa' : 'Khóa'}
                          >
                            {u.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionLoading === u.id}
                            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-colors disabled:opacity-40"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(!users?.content || users.content.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500 text-sm">
                      {search ? 'Không tìm thấy kết quả' : 'Chưa có người dùng nào'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {users && users.totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-white/5 flex items-center justify-between">
              <p className="text-slate-500 text-xs">
                Trang {page + 1} / {users.totalPages} · {users.totalElements} tài khoản
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={!users.hasPrevious}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(users.totalPages, 5) }, (_, i) => {
                  let p = i;
                  if (users.totalPages > 5) {
                    p = Math.max(0, Math.min(page - 2, users.totalPages - 5)) + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                        page === p
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {p + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(users.totalPages - 1, p + 1))}
                  disabled={!users.hasNext}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${
          toast.type === 'ok'
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
