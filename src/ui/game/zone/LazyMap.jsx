import React, { lazy, Suspense } from 'react';

// Leaflet only downloads when a map is actually shown.
const load = () => import('./TacticalMap');
const TacticalMap = lazy(load);
export const preloadMap = () => load().catch(() => {});

export default function LazyMap(props) {
  return (
    <Suspense fallback={<div className="grid h-full w-full place-items-center bg-black text-[13px] text-white/50">Loading map…</div>}>
      <TacticalMap {...props} />
    </Suspense>
  );
}
