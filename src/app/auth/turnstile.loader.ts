// ── Cloudflare Turnstile loader ─────────────────────────────────────────────
//
// The SITE key is public and delivered at runtime from the backend
// (GET /v1/auth/config → { captchaEnabled, turnstileSiteKey }). This just injects
// Cloudflare's script once and resolves when window.turnstile is ready, so the
// login component can render the widget explicitly.

export interface TurnstileApi {
  render(
    el: HTMLElement | string,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      'timeout-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible' | 'compact';
      appearance?: 'always' | 'execute' | 'interaction-only';
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __dfTurnstileReady?: () => void;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__dfTurnstileReady';

let loaderPromise: Promise<TurnstileApi | null> | null = null;

/** Lazily inject the Turnstile script; resolves with the API (or null on failure). */
export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<TurnstileApi | null>((resolve) => {
    if (window.turnstile) { resolve(window.turnstile); return; }

    let settled = false;
    const done = (api: TurnstileApi | null) => {
      if (settled) return;
      settled = true;
      if (!api) loaderPromise = null; // allow a retry after a transient failure
      resolve(api);
    };

    window.__dfTurnstileReady = () => done(window.turnstile ?? null);

    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onerror = () => done(null);
    document.head.appendChild(s);

    // Safety net: if the onload callback never fires (blocked/offline), don't hang.
    setTimeout(() => done(window.turnstile ?? null), 12000);
  });

  return loaderPromise;
}
