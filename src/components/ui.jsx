import React from 'react';
import { X } from 'lucide-react';
import { DNA_STYLES } from '../game/constants';

// Mission text with the squad's names injected; names render as inverted blocks.
export function RichText({ text, names, pack }) {
  const parts = text.split(/(\{(?:Player1|Player2|Player3|Pack)\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{(Player1|Player2|Player3|Pack)\}$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        if (m[1] === 'Pack') {
          return (
            <span key={i} className="whitespace-nowrap border border-current px-1">
              {pack}
            </span>
          );
        }
        return (
          <span key={i} className="whitespace-nowrap bg-[var(--paper)] px-1 text-[var(--ink)]">
            {names[m[1]]}
          </span>
        );
      })}
    </>
  );
}

export function IconBtn({ label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`tap grid h-11 w-11 shrink-0 place-items-center border border-[var(--line-strong)] ${className}`}
    >
      {children}
    </button>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div
        className="rise max-h-[92dvh] w-full max-w-md overflow-y-auto border-t border-[var(--line-strong)] bg-[var(--bg)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="label">{title}</div>
          <IconBtn label="Close" onClick={onClose}>
            <X size={18} />
          </IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="border-l border-[var(--line)] pl-3 first:border-l-0 first:pl-0">
      <div className="display tnum text-[26px]">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

// Full-screen background effects for the room's current DNA.
export function BgFx() {
  return (
    <div className="bgfx">
      <div className="fx fx-auteur fx-3" style={{ '--d': 'block' }}>
        <svg className="grain" width="140%" height="140%">
          <filter id="sr-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#sr-grain)" />
        </svg>
        <div className="vignette" />
      </div>
      <div className="fx fx-dossier fx-2 radar-grid" />
      <div className="fx fx-dossier fx-3 topo" />
      <div className="fx fx-dossier fx-3 scanline" />
      <div className="fx fx-kinetic fx-3 diag" />
    </div>
  );
}

// "ROOM DNA / EVOLUTION LEVEL" meter shown in the room header.
export function DnaMeter({ info }) {
  const style = DNA_STYLES[info.style];
  return (
    <div className="panel px-3 py-2.5" data-tag="DNA">
      <div className="flex items-center justify-between gap-3">
        <div className="label">Room DNA / Evolution Level</div>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <span key={n} className="h-2.5 w-5 border border-[var(--line-strong)]" style={{ background: info.stage >= n ? 'var(--paper)' : 'transparent' }} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <div className="display accent text-[19px]">
          LV.{info.stage} — {style.name}
        </div>
        <div className="mono shrink-0 text-[10px] text-[var(--zinc)]">{style.code}</div>
      </div>
      <div className="mono mt-1 text-[10.5px] text-[var(--zinc)]">
        {info.stage === 0
          ? style.motto
          : `${info.completed} mission${info.completed === 1 ? '' : 's'} cleared · ${info.share}% ${style.name.split(' ')[0].toLowerCase()} DNA${info.stage < 3 ? ' · next level in 1' : ' · max level'}`}
      </div>
    </div>
  );
}

// The room's evolving header strip (film strip / telemetry / hazard band).
export function DnaBands({ code }) {
  return (
    <>
      <div className="fx fx-auteur fx-1 filmstrip mt-3" />
      <div className="fx fx-dossier fx-1 mt-3" style={{ '--d': 'flex' }}>
        <div className="flex w-full items-center gap-2 overflow-hidden">
          <span className="telemetry">SIG ▲ 4/4</span>
          <span className="telemetry">GRID {code}-7G</span>
          <span className="redact w-16" />
          <span className="telemetry">EYES ONLY</span>
          <span className="redact w-10" />
          <span className="fx fx-dossier fx-3 sweep ml-auto shrink-0" style={{ '--d': 'block', width: 22, height: 22 }} />
        </div>
      </div>
      <div className="fx fx-kinetic fx-1 relative mt-4">
        <div className="hazard" />
        <span className="stamp absolute -top-3 right-2 bg-[var(--bg)]">Chaos approved</span>
      </div>
    </>
  );
}
