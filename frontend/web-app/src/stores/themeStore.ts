import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (isDark: boolean) => void;
}

const getInitialTheme = (): boolean => {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return false;
  }
};

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const newDark = !state.isDark;
      localStorage.setItem('theme', newDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', newDark);
      return { isDark: newDark };
    }),
  setDark: (isDark) => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
    set({ isDark });
  },
}));
