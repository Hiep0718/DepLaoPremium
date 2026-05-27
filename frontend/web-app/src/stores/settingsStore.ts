import { create } from 'zustand';

// ===== Types =====
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'red' | 'teal' | 'amber';
export type FontSize = 'small' | 'medium' | 'large';
export type ChatWallpaper = 'default' | 'gradient1' | 'gradient2' | 'gradient3' | 'pattern1' | 'pattern2' | 'solid1';
export type BubbleStyle = 'modern' | 'classic' | 'minimal';

export interface UserSettings {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSize;
  chatWallpaper: ChatWallpaper;
  bubbleStyle: BubbleStyle;
  showMessageTime: boolean;
  notifyMessages: boolean;
  notifySound: boolean;
  notifyPreview: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  themeMode: 'light',
  accentColor: 'blue',
  fontSize: 'medium',
  chatWallpaper: 'default',
  bubbleStyle: 'modern',
  showMessageTime: true,
  notifyMessages: true,
  notifySound: true,
  notifyPreview: true,
};

// ===== Accent color palettes =====
export const ACCENT_COLORS: Record<AccentColor, { primary: string; hover: string; light: string; name: string }> = {
  blue:   { primary: '#0068FF', hover: '#0055D4', light: '#E7F0FF', name: 'Xanh dương' },
  purple: { primary: '#7C3AED', hover: '#6D28D9', light: '#EDE9FE', name: 'Tím' },
  green:  { primary: '#059669', hover: '#047857', light: '#D1FAE5', name: 'Xanh lá' },
  orange: { primary: '#EA580C', hover: '#C2410C', light: '#FFF7ED', name: 'Cam' },
  pink:   { primary: '#DB2777', hover: '#BE185D', light: '#FCE7F3', name: 'Hồng' },
  red:    { primary: '#DC2626', hover: '#B91C1C', light: '#FEE2E2', name: 'Đỏ' },
  teal:   { primary: '#0D9488', hover: '#0F766E', light: '#CCFBF1', name: 'Ngọc lam' },
  amber:  { primary: '#D97706', hover: '#B45309', light: '#FEF3C7', name: 'Vàng hổ phách' },
};

// ===== Dark mode accent adjustments =====
const ACCENT_COLORS_DARK: Record<AccentColor, { primary: string; hover: string; light: string }> = {
  blue:   { primary: '#60A5FA', hover: '#3B82F6', light: '#1E3A5F' },
  purple: { primary: '#A78BFA', hover: '#8B5CF6', light: '#3B1F7E' },
  green:  { primary: '#34D399', hover: '#10B981', light: '#064E3B' },
  orange: { primary: '#FB923C', hover: '#F97316', light: '#7C2D12' },
  pink:   { primary: '#F472B6', hover: '#EC4899', light: '#831843' },
  red:    { primary: '#F87171', hover: '#EF4444', light: '#7F1D1D' },
  teal:   { primary: '#2DD4BF', hover: '#14B8A6', light: '#134E4A' },
  amber:  { primary: '#FBBF24', hover: '#F59E0B', light: '#78350F' },
};

export const FONT_SIZE_MAP: Record<FontSize, { base: string; sm: string; lg: string; label: string }> = {
  small:  { base: '13px', sm: '11px', lg: '15px', label: 'Nhỏ' },
  medium: { base: '15px', sm: '13px', lg: '17px', label: 'Trung bình' },
  large:  { base: '17px', sm: '15px', lg: '19px', label: 'Lớn' },
};

export const CHAT_WALLPAPERS: Record<ChatWallpaper, { label: string; css: string; preview: string }> = {
  default:   { label: 'Mặc định', css: 'var(--bg-chat)', preview: '#E4DDD6' },
  gradient1: { label: 'Hoàng hôn', css: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e8eaf6 100%)', preview: 'linear-gradient(135deg, #fce4ec, #e8eaf6)' },
  gradient2: { label: 'Đại dương', css: 'linear-gradient(135deg, #e0f7fa 0%, #e1f5fe 50%, #e8eaf6 100%)', preview: 'linear-gradient(135deg, #e0f7fa, #e8eaf6)' },
  gradient3: { label: 'Rừng xanh', css: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #fffde7 100%)', preview: 'linear-gradient(135deg, #e8f5e9, #fffde7)' },
  pattern1:  { label: 'Chấm tròn', css: 'var(--bg-chat)', preview: '#d5d0cb' },
  pattern2:  { label: 'Sóng', css: 'var(--bg-chat)', preview: '#c8d8e4' },
  solid1:    { label: 'Xám nhạt', css: '#f0f2f5', preview: '#f0f2f5' },
};

const CHAT_WALLPAPERS_DARK: Partial<Record<ChatWallpaper, { css: string; preview: string }>> = {
  default:   { css: 'var(--bg-chat)', preview: '#0f172a' },
  gradient1: { css: 'linear-gradient(135deg, #1a1025 0%, #1e1533 50%, #151a2e 100%)', preview: 'linear-gradient(135deg, #1a1025, #151a2e)' },
  gradient2: { css: 'linear-gradient(135deg, #0a1929 0%, #0d1b2a 50%, #151a2e 100%)', preview: 'linear-gradient(135deg, #0a1929, #151a2e)' },
  gradient3: { css: 'linear-gradient(135deg, #0a1f13 0%, #121f0a 50%, #1a1a00 100%)', preview: 'linear-gradient(135deg, #0a1f13, #1a1a00)' },
  pattern1:  { css: 'var(--bg-chat)', preview: '#111827' },
  pattern2:  { css: 'var(--bg-chat)', preview: '#111827' },
  solid1:    { css: '#1e293b', preview: '#1e293b' },
};

// ===== Helpers =====
const getStorageKey = (userId: string) => `settings_${userId}`;

const loadFromStorage = (userId: string): UserSettings => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
};

const saveToStorage = (userId: string, settings: UserSettings) => {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(settings));
  } catch { /* ignore */ }
};

const resolveIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return mode === 'dark';
};

// ===== Apply to DOM =====
export const applySettingsToDOM = (settings: UserSettings) => {
  const root = document.documentElement;
  const isDark = resolveIsDark(settings.themeMode);

  // Theme
  root.classList.toggle('dark', isDark);

  // Accent color
  const palette = isDark ? ACCENT_COLORS_DARK[settings.accentColor] : ACCENT_COLORS[settings.accentColor];
  root.style.setProperty('--accent-primary', palette.primary);
  root.style.setProperty('--accent-hover', palette.hover);
  root.style.setProperty('--accent-light', palette.light);

  // Override sidebar background with accent color (light mode)
  if (!isDark) {
    root.style.setProperty('--bg-sidebar', ACCENT_COLORS[settings.accentColor].primary);
  } else {
    root.style.setProperty('--bg-sidebar', '#16213e');
  }

  // Accent as text-accent
  root.style.setProperty('--text-accent', palette.primary);

  // Font size
  const font = FONT_SIZE_MAP[settings.fontSize];
  root.style.setProperty('--font-size-base', font.base);
  root.style.setProperty('--font-size-sm', font.sm);
  root.style.setProperty('--font-size-lg', font.lg);

  // Chat wallpaper
  const wallpaper = isDark
    ? (CHAT_WALLPAPERS_DARK[settings.chatWallpaper]?.css || CHAT_WALLPAPERS[settings.chatWallpaper].css)
    : CHAT_WALLPAPERS[settings.chatWallpaper].css;
  root.style.setProperty('--chat-wallpaper', wallpaper);

  // Bubble style
  root.setAttribute('data-bubble-style', settings.bubbleStyle);

  // Message time visibility
  root.setAttribute('data-show-time', String(settings.showMessageTime));
};

// ===== Store =====
interface SettingsState {
  settings: UserSettings;
  currentUserId: string | null;
  isDark: boolean;
  isSettingsOpen: boolean;
  loadSettings: (userId: string) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetSettings: () => void;
  resetSection: (section: 'appearance' | 'chat' | 'notifications') => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  currentUserId: null,
  isDark: false,
  isSettingsOpen: false,

  loadSettings: (userId: string) => {
    const settings = loadFromStorage(userId);
    const isDark = resolveIsDark(settings.themeMode);
    set({ settings, currentUserId: userId, isDark });
    applySettingsToDOM(settings);
  },

  updateSettings: (partial: Partial<UserSettings>) => {
    const { settings, currentUserId } = get();
    const newSettings = { ...settings, ...partial };
    const isDark = resolveIsDark(newSettings.themeMode);
    set({ settings: newSettings, isDark });
    applySettingsToDOM(newSettings);
    if (currentUserId) saveToStorage(currentUserId, newSettings);
  },

  resetSettings: () => {
    const { currentUserId } = get();
    const isDark = resolveIsDark(DEFAULT_SETTINGS.themeMode);
    set({ settings: { ...DEFAULT_SETTINGS }, isDark });
    applySettingsToDOM(DEFAULT_SETTINGS);
    if (currentUserId) saveToStorage(currentUserId, DEFAULT_SETTINGS);
  },

  resetSection: (section) => {
    let partial: Partial<UserSettings> = {};
    switch (section) {
      case 'appearance':
        partial = {
          themeMode: DEFAULT_SETTINGS.themeMode,
          accentColor: DEFAULT_SETTINGS.accentColor,
          fontSize: DEFAULT_SETTINGS.fontSize,
        };
        break;
      case 'chat':
        partial = {
          chatWallpaper: DEFAULT_SETTINGS.chatWallpaper,
          bubbleStyle: DEFAULT_SETTINGS.bubbleStyle,
          showMessageTime: DEFAULT_SETTINGS.showMessageTime,
        };
        break;
      case 'notifications':
        partial = {
          notifyMessages: DEFAULT_SETTINGS.notifyMessages,
          notifySound: DEFAULT_SETTINGS.notifySound,
          notifyPreview: DEFAULT_SETTINGS.notifyPreview,
        };
        break;
    }
    get().updateSettings(partial);
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { settings, currentUserId } = useSettingsStore.getState();
    if (settings.themeMode === 'system' && currentUserId) {
      const isDark = resolveIsDark('system');
      useSettingsStore.setState({ isDark });
      applySettingsToDOM(settings);
    }
  });
}
