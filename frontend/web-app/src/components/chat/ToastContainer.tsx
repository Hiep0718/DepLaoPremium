import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { subscribeToasts, removeToast, type Toast } from '../../services/notification.service';

const ICON_MAP = {
  info: MessageCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const COLOR_MAP = {
  info: '#0068FF',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

// --- Component con để quản lý vòng đời từng Toast ---
const ToastItem = ({ toast }: { toast: Toast }) => {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kích hoạt đóng và chạy animation FadeOut
  const handleClose = () => {
    setIsClosing(true);
    // Đợi CSS Animation fadeOut chạy 300ms rồi mới remove khỏi mảng
    setTimeout(() => {
      removeToast(toast.id);
    }, 300);
  };

  const startTimer = () => {
    timerRef.current = setTimeout(() => {
      handleClose();
    }, 4000); // 4 giây tự động tắt
  };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    startTimer();
    return () => clearTimer(); // Clear memory khi unmount
  }, []);

  const IconComp = ICON_MAP[toast.type] || MessageCircle;
  const color = COLOR_MAP[toast.type] || '#0068FF';

  return (
    <div
      onMouseEnter={clearTimer}  // Rê chuột vào -> Dừng hẹn giờ
      onMouseLeave={startTimer}  // Bỏ chuột ra -> Tiếp tục đếm 4s
      onClick={() => {
        toast.onClick?.(); // Gọi hàm nhảy tới đoạn Chat
        handleClose();
      }}
      className="flex items-start gap-3 p-3 rounded-xl shadow-2xl border cursor-pointer relative overflow-hidden"
      style={{
        background: 'var(--bg-panel, #fff)',
        borderColor: 'var(--border-light, #e5e7eb)',
        // Áp dụng animation chuẩn mà index.css đã khai báo
        animation: isClosing ? 'fadeOut 0.3s forwards' : 'slideInRight 0.3s ease-out',
      }}
    >
      {/* Avatar or Icon */}
      {toast.avatarUrl ? (
        <img
          src={toast.avatarUrl}
          alt=""
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15` }}
        >
          <IconComp size={20} style={{ color }} />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary, #1f2937)' }}>
          {toast.title}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary, #6b7280)' }}>
          {toast.message}
        </p>
      </div>

      {/* Nút Close thủ công */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // Ngăn không cho nổi bọt sự kiện onClick của vùng div to
          handleClose();
        }}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
      >
        <X size={14} style={{ color: 'var(--text-secondary, #9ca3af)' }} />
      </button>
    </div>
  );
};

// --- Container chính chứa mảng Toast ---
const ToastContainer = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsub = subscribeToasts(setToasts);
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-4 right-4 flex flex-col gap-2"
      style={{ zIndex: 100000, maxWidth: '380px', width: '100%' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;