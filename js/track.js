export function track(eventName, payload = {}) {
  const event = String(eventName || '').trim();
  if (!event) return;

  const detail = {
    event: event,
    payload: payload,
    timestamp: new Date().toISOString(),
  };

  if (!window.__awknEvents) {
    window.__awknEvents = [];
  }
  window.__awknEvents.push(detail);

  try {
    window.dispatchEvent(new CustomEvent('awkn:track', { detail }));
  } catch (error) {
    console.warn('[track] dispatch failed', error);
  }

  if (window.console && typeof window.console.info === 'function') {
    console.info('[track]', detail);
  }
}