import { create } from 'zustand';

interface AuthState {
  user: any | null;
  token: string | null;
  setAuth: (user: any, token: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: sessionStorage.getItem('accessToken'),
  setAuth: (user, token) => {
    sessionStorage.setItem('accessToken', token);
    set({ user, token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    sessionStorage.removeItem('accessToken');
    set({ user: null, token: null });
  },
}));
