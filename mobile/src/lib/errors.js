// Last line of defence: an exception thrown outside React rendering (a timer, a sensor
// callback, a network message) would otherwise kill the app in release builds. It is
// reported to the error boundary instead, which offers to recover.
// The innermost boundary handles it (inside a room: recover the round, not the whole app).
const listeners = [];
let installed = false;

export function onUncaughtError(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.lastIndexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function installGlobalErrorHandler() {
  if (installed || !globalThis.ErrorUtils?.setGlobalHandler) return;
  installed = true;
  const fallback = globalThis.ErrorUtils.getGlobalHandler?.();
  globalThis.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.warn('[app] uncaught error', isFatal ? '(fatal)' : '', error);
    const top = listeners[listeners.length - 1];
    if (top) top(error);
    else fallback?.(error, isFatal);
  });
}
