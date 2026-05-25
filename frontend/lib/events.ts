/**
 * Lightweight pub/sub for cross-page data changes.
 * Components that mutate server data call `emitDataChange()`.
 * The dashboard (and any other page) subscribes with `onDataChange()`.
 */

export const DATA_CHANGE_EVENT = 'sx:data-changed';

/** Dispatch a data-changed event so any listening page can re-fetch. */
export function emitDataChange(detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: detail ?? {} }));
}

/** Subscribe to data changes. Returns an unsubscribe function. */
export function onDataChange(handler: (e: Event) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DATA_CHANGE_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGE_EVENT, handler);
}
