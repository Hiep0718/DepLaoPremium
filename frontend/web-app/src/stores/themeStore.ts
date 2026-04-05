import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (isDark: boolean) => void;
}

/**
 * Legacy theme store — now delegates to settingsStore.
 * Kept for backward compatibility with components that still reference useThemeStore.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  isDark: useSettingsStore.getState().isDark,
  toggleTheme: () => {
    const settingsStore = useSettingsStore.getState();
    const currentMode = settingsStore.settings.themeMode;
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    settingsStore.updateSettings({ themeMode: newMode });
    set({ isDark: newMode === 'dark' });
  },
  setDark: (isDark) => {
    const settingsStore = useSettingsStore.getState();
    settingsStore.updateSettings({ themeMode: isDark ? 'dark' : 'light' });
    set({ isDark });
  },
}));

// Sync themeStore whenever settingsStore.isDark changes
useSettingsStore.subscribe((state) => {
  useThemeStore.setState({ isDark: state.isDark });
});
