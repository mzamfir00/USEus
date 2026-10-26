import React, { useRef } from 'react';
import { X } from 'lucide-react';

export function Sheet({ title, onClose, children }) {
  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-[var(--border)] bg-[var(--card)] px-6 pb-[calc(24px+var(--safe-bottom))] pt-3"
        style={{ animation: 'sheet .35s cubic-bezier(.2,.9,.3,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)]" />
        {title && (
          <div className="mb-5 flex items-center justify-between">
            <div className="headline text-[22px]">{title}</div>
            <button type="button" aria-label="Close" className="icon-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 44, inverted = false }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: inverted ? 'var(--fg)' : '#1f1f1f',
        color: inverted ? 'var(--bg)' : 'var(--fg)',
        border: inverted ? 'none' : '1px solid var(--border)',
      }}
    >
      {initials}
    </div>
  );
}

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-6 pt-[max(20px,var(--safe-top))]">
      <div className="min-w-0">
        {subtitle && <div className="eyebrow mb-1">{subtitle}</div>}
        <h1 className="title">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between px-1">
      <div className="eyebrow">{children}</div>
      {right}
    </div>
  );
}

export function Empty({ icon: Icon, title, body }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-[var(--border)]">
          <Icon size={20} />
        </div>
      )}
      <div className="text-[16px] font-semibold">{title}</div>
      {body && <div className="muted mt-1.5 max-w-[30ch] text-[14px] leading-snug">{body}</div>}
    </div>
  );
}

// Mission text with player names as small inverted chips.
export function RichText({ text, names, pack }) {
  const parts = text.split(/(\{(?:Player1|Player2|Player3|Pack)\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{(Player1|Player2|Player3|Pack)\}$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        const value = m[1] === 'Pack' ? pack : names[m[1]];
        return (
          <span key={i} className="whitespace-nowrap rounded-[6px] bg-[var(--fg)] px-1.5 text-[var(--bg)]">
            {value}
          </span>
        );
      })}
    </>
  );
}

// 4-digit room code entry rendered as four cells over a hidden numeric input.
export function CodeInput({ value, onChange, onComplete, autoFocus }) {
  const ref = useRef(null);
  return (
    <label className="relative block" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Room code"
        className="absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          onChange(v);
          if (v.length === 4) onComplete?.(v);
        }}
      />
      <div className="code-cells" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`code-cell ${i === Math.min(value.length, 3) ? 'active' : ''}`}>
            {value[i] || ''}
          </div>
        ))}
      </div>
    </label>
  );
}

// Background layers for the current Room DNA / personal aesthetic.
export function BgFx() {
  return (
    <div className="bgfx" aria-hidden="true">
      <svg className="grain fx fx-auteur fx-3" width="140%" height="140%">
        <filter id="useus-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#useus-grain)" />
      </svg>
      <div className="radar fx fx-dossier fx-2" />
      <div className="scanline fx fx-dossier fx-3" />
    </div>
  );
}

export function LevelDots({ stage }) {
  return (
    <span className="flex gap-1" aria-label={`Level ${stage} of 3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className="h-1.5 w-1.5 rounded-full" style={{ background: stage >= n ? 'var(--fg)' : 'var(--border)' }} />
      ))}
    </span>
  );
}
