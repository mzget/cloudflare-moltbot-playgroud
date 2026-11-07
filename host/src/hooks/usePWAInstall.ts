import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface UsePWAInstallReturn {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  showGuideModal: boolean;
  setShowGuideModal: (show: boolean) => void;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'guide' | 'unavailable'>;
}

/**
 * Check whether the web application is running in standalone mode (installed PWA)
 */
export function checkIsStandalone(
  win: Window | null = typeof window !== 'undefined' ? window : null,
  nav: Navigator | null = typeof navigator !== 'undefined' ? navigator : null
): boolean {
  if (!win) return false;
  const isDisplayStandalone =
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone =
    nav && (nav as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(isDisplayStandalone || isNavigatorStandalone);
}

/**
 * Check whether the client device is an Apple iOS mobile device (iPhone, iPad, iPod)
 */
export function checkIsIOS(
  nav: Navigator | null = typeof navigator !== 'undefined' ? navigator : null
): boolean {
  if (!nav) return false;
  const userAgent = nav.userAgent || '';
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
  return Boolean(isAppleMobile);
}

/**
 * Custom hook to manage PWA installability, capture `beforeinstallprompt`,
 * detect iOS Safari standalone readiness, and trigger the native install dialog.
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const standalone = checkIsStandalone(window, navigator);
    setIsStandalone(standalone);

    const ios = checkIsIOS(navigator);
    setIsIOS(ios && !standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsStandalone(true);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'guide' | 'unavailable'> => {
    // If running on iOS Safari, open the step-by-step guide modal
    if (isIOS) {
      setShowGuideModal(true);
      return 'guide';
    }

    // If native prompt is available (Chrome / Android / Edge)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsInstalled(true);
          return 'accepted';
        } else {
          return 'dismissed';
        }
      } catch (err) {
        console.warn('[PWA] Error displaying install prompt:', err);
        setShowGuideModal(true);
        return 'unavailable';
      }
    }

    // Fallback: If no deferredPrompt (e.g. desktop Chrome when prompt already captured or unsupported), show instructions
    setShowGuideModal(true);
    return 'guide';
  }, [deferredPrompt, isIOS]);

  const canInstall = !isStandalone && !isInstalled;

  return {
    canInstall,
    isIOS,
    isStandalone,
    isInstalled,
    showGuideModal,
    setShowGuideModal,
    promptInstall,
  };
}
