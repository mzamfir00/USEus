import { useEffect, useState } from 'react';
import { HYPE_TASK, ROLES } from '../../game/constants';
import { missionById } from '../../game/engine';

export const formatTime = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const missionNumber = (m) => `#${String(m.id).padStart(2, '0')}`;

// Role + public task for one player in the current round.
export function assignmentFor(view, id) {
  const r = view.round;
  const m = missionById(r.missionId);
  if (r.cast.p1 === id) return { role: ROLES.main, task: m.roles.p1 };
  if (r.cast.p2 === id) return { role: ROLES.director, task: m.roles.p2 };
  if (r.cast.p3 === id) return { role: ROLES.camera, task: m.roles.p3 };
  if (r.cast.extras.includes(id)) return { role: ROLES.hype, task: HYPE_TASK };
  return null;
}

// Re-render on an interval (for live timers).
export function useNow(ms = 250) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
