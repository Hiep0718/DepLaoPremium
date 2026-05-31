import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  isDanger: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  showConfirm: (
    message: string,
    options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }
  ) => Promise<boolean>;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  message: '',
  title: 'Xác nhận',
  confirmText: 'Đồng ý',
  cancelText: 'Hủy',
  isDanger: false,
  onConfirm: () => {},
  onCancel: () => {},
  showConfirm: (message, options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        message,
        title: options?.title || 'Xác nhận',
        confirmText: options?.confirmText || 'Đồng ý',
        cancelText: options?.cancelText || 'Hủy',
        isDanger: options?.isDanger || false,
        onConfirm: () => {
          set({ isOpen: false });
          resolve(true);
        },
        onCancel: () => {
          set({ isOpen: false });
          resolve(false);
        },
      });
    });
  },
}));

export const confirmAlert = useConfirmStore.getState().showConfirm;
