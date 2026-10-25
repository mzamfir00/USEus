import React from 'react';

// Analog-horror overlay for the Halloween pack: VHS scanlines, film grain, a rolling tracking
// band and a heavy vignette. Purely visual — never captures taps.
export default function HorrorFx({ fixed = false, className = '' }) {
  return (
    <div className={`hfx ${fixed ? 'fixed' : 'absolute'} ${className}`} aria-hidden="true">
      <div className="hfx-scan" />
      <svg className="hfx-grain" width="140%" height="140%">
        <filter id="useus-hfx-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#useus-hfx-grain)" />
      </svg>
      <div className="hfx-roll" />
      <div className="hfx-vignette" />
    </div>
  );
}
