import { create } from 'zustand';
import { useChatStore } from './chatStore';

const getSavedUser = (): any | null => {
  try {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

interface AuthState {
  user: any | null;
  token: string | null;
  setAuth: (user: any, token: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getSavedUser(),
  token: sessionStorage.getItem('accessToken'),
  setAuth: (user, token) => {
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  setUser: (user) => {
    sessionStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    set({ user: null, token: null });
    useChatStore.getState().clearChat();
  },
}));
