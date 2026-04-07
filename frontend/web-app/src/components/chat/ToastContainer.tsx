import { useEffect, useState } from 'react';
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
      {toasts.map((toast) => {
        const IconComp = ICON_MAP[toast.type] || MessageCircle;
        const color = COLOR_MAP[toast.type] || '#0068FF';

        return (
          <div
            key={toast.id}
            className="flex items-start gap-3 p-3 rounded-xl shadow-2xl border cursor-pointer"
            style={{
              background: 'var(--bg-panel, #fff)',
              borderColor: 'var(--border-light, #e5e7eb)',
              animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 3.7s forwards',
            }}
            onClick={() => {
              toast.onClick?.();
              removeToast(toast.id);
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary, #1f2937)' }}>
                {toast.title}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                {toast.message}
              </p>
            </div>

            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
            >
              <X size={14} style={{ color: 'var(--text-secondary, #9ca3af)' }} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default ToastContainer;
