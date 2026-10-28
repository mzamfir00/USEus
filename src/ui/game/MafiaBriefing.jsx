// Mafia briefing pieces: the hold-to-reveal secret role card, the Storyteller phone picker
// (lobby and briefing) and the public role guide.
import React, { useEffect, useState } from 'react';
import { Eye, Volume2 } from 'lucide-react';
import { BRIEFINGS } from '../../game/briefings';
import { GAMES } from '../../game/games';
import { MAFIA_LANGS, mafiaCount, mafiaLine, storytellerOf } from '../../game/mafia';
import { hasVoice, narrate } from '../../lib/storyteller';
import { buzz } from '../../lib/sound';
import { SectionLabel } from '../primitives';

const ROLES = GAMES.mafia.roles;
const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
export const roleTitle = (role) => `${ROLES[role]?.icon || ''} ${(ROLES[role]?.label || '').toUpperCase()}`.trim();

// Press and hold to see your secret role; let go and it hides again.
export function RoleCard({ view, compact = false }) {
  const [open, setOpen] = useState(false);
  const mine = view.mine || {};
  const role = mine.role;
  const team = (mine.team || []).filter((id) => id !== view.me);
  const checks = mine.checks || [];
  const show = () => {
    buzz(15);
    setOpen(true);
  };
  const hide = () => setOpen(false);
  return (
    <button
      type="button"
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Hold to reveal your role"
      data-role-card
      className={`block w-full select-none rounded-[24px] border text-left ${open ? 'border-white bg-white text-black' : 'border-[var(--border)] bg-[var(--card)]'} ${compact ? 'p-4' : 'min-h-[168px] p-6'}`}
    >
      {open && role ? (
        <div data-role-revealed>
          <div className="text-[11.5px] font-bold tracking-[0.14em] text-black/50">YOUR SECRET ROLE</div>
          <div className={`mt-1.5 font-extrabold tracking-tight ${compact ? 'text-[24px]' : 'text-[32px]'}`} data-role-name>
            {roleTitle(role)}
          </div>
          <div className="mt-2 text-[14.5px] leading-snug">{ROLES[role].brief}</div>
          {team.length > 0 && (
            <div className="mt-2.5 text-[13.5px] font-semibold">
              Your Mafia partner{team.length > 1 ? 's' : ''}: {team.map((id) => nameOf(view, id)).join(', ')}
            </div>
          )}
          {checks.length > 0 && <div className="mt-2.5 text-[13.5px]">Your findings: {checks.map((c) => `${nameOf(view, c.id)} ${c.mafia ? '= MAFIA' : '= innocent'}`).join(' · ')}</div>}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <Eye size={compact ? 20 : 26} />
          <div className={`mt-2 font-bold tracking-[0.04em] ${compact ? 'text-[14px]' : 'text-[16px]'}`}>{role ? 'HOLD TO SEE YOUR SECRET ROLE' : 'YOU’RE WATCHING THIS ONE'}</div>
          {!compact && <div className="muted mt-1 text-[13px]">Shield your screen. Let go and it hides again.</div>}
        </div>
      )}
    </button>
  );
}

// Host picks the phone that speaks and the narrator language.
export function StorytellerSetup({ view, intent, where }) {
  const isHost = view.hostId === view.me;
  const online = view.players.filter((p) => p.connected);
  const s = where === 'lobby' ? view.settings.mafia || {} : view.round.data;
  const narrator = where === 'lobby' ? s.narrator || view.hostId : s.narrator;
  const lang = s.lang || 'ro';
  const speaking = where === 'brief' ? storytellerOf(view) : narrator;
  const mine = speaking === view.me;
  const [voice, setVoice] = useState(null);
  useEffect(() => {
    let live = true;
    if (mine) hasVoice(lang).then((v) => live && setVoice(v));
    return () => {
      live = false;
    };
  }, [mine, lang]);
  const set = (patch) => intent({ type: 'mafiaSettings', ...patch });

  return (
    <div data-storyteller>
      <SectionLabel>🔊 Storyteller speaker</SectionLabel>
      <div className="card p-4">
        <p className="muted text-[14px] leading-snug">One phone reads the whole game out loud. Its owner still plays — the phone does the narrating.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {online.map((p) => (
            <button key={p.id} type="button" disabled={!isHost} onClick={() => set({ narrator: p.id })} className={`pill ${p.id === narrator ? 'pill-on' : ''}`} data-narrator={p.username}>
              {p.id === narrator && <Volume2 size={14} />} {p.name.split(' ')[0]}
              {p.id === view.hostId ? ' (host)' : ''}
            </button>
          ))}
        </div>
        <div className="segmented mt-3">
          {Object.entries(MAFIA_LANGS).map(([id, l]) => (
            <button key={id} type="button" aria-pressed={lang === id} disabled={!isHost} onClick={() => set({ lang: id })}>
              {l.short} {l.label}
            </button>
          ))}
        </div>
        {mine && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <div className="text-[13.5px] font-semibold">Your phone is the Storyteller. Turn the volume all the way up.</div>
            {voice === false && <div className="muted mt-1 text-[13px] leading-snug">No {MAFIA_LANGS[lang].label} voice in this browser. Install one in your system speech settings, or switch the narrator language.</div>}
            <button type="button" className="btn btn-secondary mt-2.5 !min-h-[44px] text-[14px]" onClick={() => narrate(mafiaLine('sleep', lang), lang)}>
              <Volume2 size={16} /> Test the voice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// The public role guide: what every role does (nobody's own role is highlighted).
export function MafiaRules({ view }) {
  const n = view.round?.participants?.length || view.players.filter((p) => p.connected).length;
  const m = view.round?.data?.counts?.mafia || mafiaCount(n);
  const steps = BRIEFINGS.mafia.setup.concat(['Most votes is out and their role is revealed. A tie, or as many skips, saves everyone.', 'Citizens win when every Mafia member is out. The Mafia wins once they equal the rest.']);
  return (
    <div data-mafia-rules>
      <SectionLabel>{`This game · ${m} Mafia · 1 Doctor · 1 Detective · ${Math.max(0, n - m - 2)} Citizens`}</SectionLabel>
      <div className="card divide overflow-hidden">
        {['mafia', 'doctor', 'detective', 'citizen'].map((id) => (
          <div key={id} className="px-4 py-3.5">
            <div className="text-[15px] font-bold">{roleTitle(id)}</div>
            <div className="muted mt-1 text-[13.5px] leading-snug">{ROLES[id].brief}</div>
          </div>
        ))}
      </div>
      <SectionLabel>How a round flows</SectionLabel>
      <div className="card divide overflow-hidden">
        {steps.map((step, i) => (
          <div key={step} className="flex gap-3 px-4 py-3">
            <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[12px] font-bold text-[var(--bg)]">{i + 1}</span>
            <span className="text-[14px] leading-snug">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The ready-up gate for Mafia. `footer` is the ready bar (owned by the generic briefing).
export function MafiaBriefing({ view, intent, footer }) {
  return (
    <div className="enter relative pb-48" data-briefing>
      <div className="relative pt-4">
        <div className="eyebrow !text-[12px] font-semibold uppercase tracking-[0.14em]">Mission briefing · secret roles</div>
        <h2 className="title mt-2">{GAMES.mafia.name}</h2>
        <p className="muted mt-2 text-[15px] leading-snug">Everyone plays. Hold the card to see your secret role — keep it to yourself. When everyone is ready, Night 1 begins and the Storyteller phone takes over.</p>
        <div className="mt-5">
          <RoleCard view={view} />
        </div>
        <StorytellerSetup view={view} intent={intent} where="brief" />
        <MafiaRules view={view} />
      </div>
      {footer}
    </div>
  );
}
