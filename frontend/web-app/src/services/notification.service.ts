/**
 * Browser Notification Service for DepLao Chat
 * 
 * Handles:
 * - Browser desktop notifications for incoming messages
 * - In-app toast notifications
 * - Sound alerts
 */

// — Notification permission —
let permissionGranted = false;

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('[NotifyService] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[NotifyService] Notifications denied by user');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    permissionGranted = permission === 'granted';
    return permissionGranted;
  } catch {
    return false;
  }
};

// — Desktop notification for incoming message —
export const showMessageNotification = (
  senderName: string,
  messageText: string,
  messageType: string = 'text',
  avatarUrl?: string,
  onClick?: () => void
) => {
  // Don't show if tab is focused
  if (document.hasFocus()) return;

  if (!permissionGranted || Notification.permission !== 'granted') return;

  // Build notification body based on message type
  let body = messageText;
  if (messageType === 'image') body = '📷 Đã gửi một hình ảnh';
  else if (messageType === 'video') body = '🎬 Đã gửi một video';
  else if (messageType === 'file') body = '📎 Đã gửi một tệp';
  else if (messageType === 'sticker') body = '😊 Đã gửi một nhãn dán';

  try {
    const notification = new Notification(senderName, {
      body,
      icon: avatarUrl || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `msg-${Date.now()}`, // unique tag to stack
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch (err) {
    console.error('[NotifyService] Failed to show notification:', err);
  }
};

// — In-app toast notifications —
type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  avatarUrl?: string;
  timestamp: number;
  onClick?: () => void;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let activeToasts: Toast[] = [];

const notifyListeners = () => {
  toastListeners.forEach(fn => fn([...activeToasts]));
};

export const subscribeToasts = (listener: (toasts: Toast[]) => void) => {
  toastListeners.push(listener);
  listener([...activeToasts]); // Emit current state
  return () => {
    toastListeners = toastListeners.filter(fn => fn !== listener);
  };
};

export const showToast = (
  title: string,
  message: string,
  type: ToastType = 'info',
  avatarUrl?: string,
  onClick?: () => void
) => {
  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const toast: Toast = { id, title, message, type, avatarUrl, timestamp: Date.now(), onClick };

  activeToasts = [...activeToasts, toast];
  notifyListeners();

  // Auto-remove after 4 seconds
  setTimeout(() => {
    removeToast(id);
  }, 4000);

  return id;
};

export const removeToast = (id: string) => {
  activeToasts = activeToasts.filter(t => t.id !== id);
  notifyListeners();
};

// — Notification sound —
let notificationSound: HTMLAudioElement | null = null;

const getNotificationSound = (): HTMLAudioElement => {
  if (!notificationSound) {
    // Use a small base64 encoded notification sound
    notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+JkpuTi4J5cG5weIGLk5mWko2Hg4OGiIuOkZOSj42LiYmLi42OkJCQjo2NjIuLi4yMjI2NjIyLi4uLi4uLi4yMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjYyMjIyMjI2NjY2NjY2NjY2NjI2NjY6Oj4+Pj4+Pjo6Ojo6Pj4+QkJCRkZGRkZGRkZGRkZCQkJCQkJCQj4+Pj46Ojo2NjYyMjIuLi4qKiomJiYiIiIeHh4aGhoaGhoaGh4eHiIiJiYqKi4uMjI2Ojo+QkJGRkpKTk5SUlJSUlJOTk5KSkZGQkI+Pjo6NjYyLi4qKiYmIiIeHhoaFhYWEhISEhISFhYaGh4eIiImKiouMjI2Oj5CQkZKSk5OUlJWVlZWVlZSUlJOTkpKRkZCQj46OjY2MjIuLioqJiYmIiIiHh4eHh4eHh4iIiImJiYqKi4uMjI2Njo6Pj5CQkZGSkpKTk5OTk5OTk5KSkpGRkZCQj4+OjlA=');
    notificationSound.volume = 0.3;
  }
  return notificationSound;
};

export const playNotificationSound = () => {
  try {
    const sound = getNotificationSound();
    sound.currentTime = 0;
    sound.play().catch(() => {
      // Autoplay might be blocked, this is fine
    });
  } catch {
    // Ignore sound errors
  }
};

export type { Toast, ToastType };
