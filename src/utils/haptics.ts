type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

interface TelegramHapticFeedback {
  impactOccurred?: (style: ImpactStyle) => void;
  notificationOccurred?: (type: NotificationType) => void;
  selectionChanged?: () => void;
}

interface TelegramWebApp {
  HapticFeedback?: TelegramHapticFeedback;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  initData?: string;
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed') => void) => void;
}

let hapticsEnabled = true;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const getHapticFeedback = (): TelegramHapticFeedback | undefined => {
  if (!hapticsEnabled || typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp?.HapticFeedback;
};

export const setHapticsEnabled = (enabled: boolean): void => {
  hapticsEnabled = enabled;
};

export const impact = (style: ImpactStyle = 'light'): void => {
  try {
    getHapticFeedback()?.impactOccurred?.(style);
  } catch {
    // Haptics are optional and can fail if Telegram's host device does not support them.
  }
};

export const notification = (type: NotificationType): void => {
  try {
    getHapticFeedback()?.notificationOccurred?.(type);
  } catch {
    // Haptics are optional and can fail if Telegram's host device does not support them.
  }
};

export const selection = (): void => {
  try {
    getHapticFeedback()?.selectionChanged?.();
  } catch {
    // Haptics are optional and can fail if Telegram's host device does not support them.
  }
};
