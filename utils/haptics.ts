type HapticKind = 'light' | 'medium';

let lastHapticAt = 0;
const MIN_HAPTIC_GAP_MS = 45;

const MOBILE_MAX_WIDTH = 1024;
const VIBRATION_PATTERN: Record<HapticKind, number> = {
  light: 8,
  medium: 14
};

const isMobileTouchContext = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  const isMobileWidth = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return isMobileWidth && hasCoarsePointer;
};

const triggerTelegramHaptic = (kind: HapticKind): boolean => {
  if (typeof window === 'undefined') return false;
  const telegramFeedback = (window as typeof window & {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          selectionChanged?: () => void;
        };
      };
    };
  }).Telegram?.WebApp?.HapticFeedback;

  if (!telegramFeedback) return false;
  if (typeof telegramFeedback.impactOccurred === 'function') {
    telegramFeedback.impactOccurred(kind === 'medium' ? 'medium' : 'light');
    return true;
  }
  if (typeof telegramFeedback.selectionChanged === 'function') {
    telegramFeedback.selectionChanged();
    return true;
  }
  return false;
};

export const triggerMobileHaptic = (kind: HapticKind = 'light'): void => {
  if (!isMobileTouchContext()) return;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastHapticAt < MIN_HAPTIC_GAP_MS) return;
  lastHapticAt = now;

  if (triggerTelegramHaptic(kind)) return;

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(VIBRATION_PATTERN[kind]);
    } catch {
      // Best-effort only: unsupported browsers (e.g. iOS Safari) should fail silently.
    }
  }
};

