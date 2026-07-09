// ── Google Maps configuration ───────────────────────────────────────────────
//
// The API key is NOT stored here. It comes from the backend environment
// (GOOGLE_MAPS_API_KEY) and is delivered to the allowlisted operator at runtime
// via GET /v1/godview/access → { mapsKey }.
//
// For the key to work as a browser Maps key it must have:
//   • "Maps JavaScript API" enabled, and
//   • an HTTP-referrer restriction covering your domain(s) (incl. localhost:*).
export const GOOGLE_MAPS_CONFIG = {
  defaultCenter: { lat: 20.5937, lng: 78.9629 }, // India
  defaultZoom: 5,
  defaultType: 'roadmap' as google.maps.MapTypeId | string,
};

export type MapLoadResult = 'ok' | 'no-key' | 'auth-error' | 'failed';

let loaderPromise: Promise<MapLoadResult> | null = null;

/**
 * Lazily inject the Google Maps JS API using the runtime key.
 *
 * Uses Google's `callback` parameter — with `loading=async` the <script> load
 * event fires BEFORE `google.maps.Map` exists, so we must wait for Google to
 * invoke the ready callback instead. `gm_authFailure` catches bad-key / API-not-
 * enabled / referrer-blocked errors so the UI can explain rather than show blank.
 */
export function loadGoogleMaps(apiKey: string): Promise<MapLoadResult> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<MapLoadResult>((resolve) => {
    const w = window as unknown as Record<string, unknown> & { google?: { maps?: { Map?: unknown } } };
    if (w.google?.maps?.Map) { resolve('ok'); return; }
    if (!apiKey) { loaderPromise = null; resolve('no-key'); return; }

    let settled = false;
    const done = (r: MapLoadResult) => { if (!settled) { settled = true; if (r !== 'ok') loaderPromise = null; resolve(r); } };

    // Google calls this global when the API is fully initialised and ready.
    w['__gvGmapsReady'] = () => done('ok');
    // Google calls this global on auth failures (invalid key, API not enabled,
    // referrer not allowed, billing not set).
    w['gm_authFailure'] = () => done('auth-error');

    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&loading=async&callback=__gvGmapsReady`;
    s.async = true;
    s.onerror = () => done('failed');
    document.head.appendChild(s);

    // Safety net: if neither callback fires (network stall), don't hang forever.
    setTimeout(() => done('failed'), 12000);
  });

  return loaderPromise;
}
