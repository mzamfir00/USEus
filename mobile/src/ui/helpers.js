import { useCallback, useEffect, useRef, useState } from 'react';

export const formatTime = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Re-render on an interval (for live timers).
export function useNow(ms = 250) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// setTimeout that is cancelled automatically when the component unmounts (banners, flashes,
// toasts), so nothing fires into a screen that is already gone.
export function useLater() {
  const timers = useRef(new Set());
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);
  return useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
}
