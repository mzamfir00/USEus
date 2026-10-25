// Mission Briefing & Setup: the ready-up gate every game passes through before its countdown,
// and the same rules in the in-game "?" drawer.
import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Footprints, MapPin, Radar, Siren, Smartphone, Users, VenetianMask } from 'lucide-react';
import { BRIEFINGS, SNITCH_DARK_LINE, SNITCH_LINE } from '../../game/briefings';
import { GAMES, HUNT, XP } from '../../game/games';
import { requestMotion, useMotionMode } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { Avatar } from '../primitives';
import SafetyGate from '../Safety';
import HorrorFx from './HorrorFx';

const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';

// This phone's role, including secret roles only this phone may know about.
export function myRoleKey(view) {
  const r = view.round;
  if (r.game === 'undercover' && view.mine?.saboteur) return 'saboteur';
  if (r.game === 'doppelganger' && view.mine?.doppelganger) return 'doppelganger';
  return r.roles[view.me] || null;
}

export function briefingFor(view) {
  const r = view.round;
  const g = GAMES[r.game];
  const b = BRIEFINGS[r.game];
  const key = myRoleKey(view);
  const role = b.roles[key];
  const fill = (t) => (t || '').replace('{target}', view.mine?.target ? nameOf(view, view.mine.target) : 'secret');
  const films = g.film.includes(r.roles[view.me]); // public role: secret roles film like everyone else
  const snitch = films ? (g.dark ? SNITCH_DARK_LINE : SNITCH_LINE) : null;
  const penalty = [fill(role?.penalty), snitch].filter(Boolean).join(' ') || 'No penalties — just play it straight.';
  const setup = [...b.setup];
  if (r.zone) setup.push(`GPS Playzone: stay within ${r.zone.radius} m of the arena center. Leave it for 10 s and your live position is revealed (${XP.zoneOut} XP).`);
  const others = Object.entries(b.roles)
    .filter(([k]) => k !== key)
    .map(([k, info]) => {
      const holders = info.hidden ? [] : r.participants.filter((id) => r.roles[id] === k && id !== view.me);
      return { key: k, label: g.roles[k]?.label || k, summary: info.summary, hidden: !!info.hidden, names: holders.map((id) => nameOf(view, id)) };
    })
    .filter((o) => o.hidden || o.names.length);
  const solo = r.participants.filter((id) => id !== view.me && r.roles[id] === r.roles[view.me]).map((id) => nameOf(view, id));
  let zoneLine = null;
  if (r.zone && r.hunt) {
    const hunter = r.roles[view.me] === HUNT[r.game].role;
    zoneLine = hunter
      ? `Playzone: “RADAR PING” shows the remaining ${HUNT[r.game].hiders} on your map for 3 s (2 per round, ${XP.radarPing} XP each).`
      : 'Playzone: one decoy ping, a heartbeat warning when a hunter is within 20 m, and a mid-round supply drop worth +300 XP.';
  }
  return {
    game: g,
    key,
    label: g.roles[key]?.label || 'Spectator',
    bullets: role ? [fill(role.irl), fill(role.controls), penalty] : [],
    setup,
    others,
    sameAs: !others.length && solo.length ? solo : null,
    zoneLine,
    horror: g.pack === 'halloween',
  };
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="eyebrow mb-2.5 mt-7 flex items-center gap-2 !text-[12px] font-semibold uppercase tracking-[0.12em]">
      <Icon size={14} /> {children}
    </div>
  );
}

// The three briefing sections. `setupFirst` puts the room setup on top (the gate); the drawer
// leads with your own role and folds the setup away.
export function RulesSections({ view, setupFirst = true }) {
  const info = briefingFor(view);
  const [setupOpen, setSetupOpen] = useState(setupFirst);
  const labels = ['Do this in real life', 'On your screen', 'Penalty'];
  const icons = [Footprints, Smartphone, Siren];

  const setup = (
    <section data-brief="setup">
      <button type="button" className="w-full text-left" onClick={() => !setupFirst && setSetupOpen((v) => !v)} aria-expanded={setupOpen}>
        <SectionTitle icon={MapPin}>
          Physical setup · step by step
          {!setupFirst && <ChevronDown size={14} className={`ml-auto transition-transform ${setupOpen ? 'rotate-180' : ''}`} />}
        </SectionTitle>
      </button>
      {setupOpen && (
        <ol className="card divide overflow-hidden">
          {info.setup.map((step, i) => (
            <li key={step} className="flex gap-3 px-4 py-3 text-[14.5px] leading-snug">
              <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[12px] font-bold text-[var(--bg)]">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  const mine = (
    <section data-brief="role">
      <SectionTitle icon={VenetianMask}>Your role & phone controls</SectionTitle>
      <div className="card p-4">
        <div className="headline text-[22px]">{info.label}</div>
        {info.bullets.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {info.bullets.map((text, i) => {
              const Icon = icons[i];
              return (
                <li key={labels[i]} className="flex gap-3">
                  <Icon size={17} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="muted text-[11.5px] font-semibold uppercase tracking-[0.1em]">{labels[i]}</div>
                    <div className="mt-0.5 text-[14.5px] leading-snug">{text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted mt-2 text-[14.5px]">You joined mid-round. Watch this one — you’re dealt in next time.</p>
        )}
        {info.zoneLine && (
          <div className="mt-3 flex gap-3 border-t border-[var(--border)] pt-3 text-[13.5px] leading-snug">
            <Radar size={16} className="mt-0.5 shrink-0" />
            <span>{info.zoneLine}</span>
          </div>
        )}
      </div>
    </section>
  );

  const others = (
    <section data-brief="others">
      <SectionTitle icon={Users}>How the other roles work</SectionTitle>
      {info.others.length ? (
        <div className="card divide overflow-hidden">
          {info.others.map((o) => (
            <div key={o.key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{o.hidden ? `${o.label} · hidden` : o.label}</span>
                {!o.hidden && <span className="muted min-w-0 truncate text-[12.5px]">{o.names.join(', ')}</span>}
              </div>
              <p className="muted mt-0.5 text-[13.5px] leading-snug">{o.summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card muted p-4 text-[14px]">Everyone plays the same role{info.sameAs ? ` — ${info.sameAs.join(', ')} too` : ''}.</div>
      )}
    </section>
  );

  return setupFirst ? (
    <>
      {setup}
      {mine}
      {others}
    </>
  ) : (
    <>
      {mine}
      {others}
      {setup}
    </>
  );
}

// Live "READY: 3/4 PLAYERS" + the big ready button and the host's force start.
function ReadyBar({ view, intent }) {
  const r = view.round;
  const here = r.participants.filter((id) => view.players.find((p) => p.id === id)?.connected);
  const ready = here.filter((id) => r.ready[id]);
  const amIn = r.participants.includes(view.me);
  const iAmReady = !!r.ready[view.me];
  const isHost = view.hostId === view.me;
  const waiting = here.filter((id) => !r.ready[id]).map((id) => nameOf(view, id).split(' ')[0]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
      <div className="mx-auto max-w-md px-6 pb-[calc(16px+var(--safe-bottom))]">
        <div className="mb-3 flex items-center gap-3">
          <div className="tnum text-[13px] font-bold tracking-[0.08em]" data-ready-count={`${ready.length}/${here.length}`}>
            READY: {ready.length}/{here.length} PLAYERS
          </div>
          <div className="flex min-w-0 flex-1 justify-end -space-x-2">
            {here.map((id) => (
              <div key={id} className={`relative rounded-full ring-2 ring-[var(--bg)] ${r.ready[id] ? '' : 'opacity-40'}`} title={nameOf(view, id)}>
                <Avatar name={nameOf(view, id)} size={28} inverted={r.ready[id]} />
                {r.ready[id] && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
                    <Check size={9} strokeWidth={4} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        {amIn ? (
          iAmReady ? (
            <button type="button" className="btn btn-secondary" onClick={() => intent({ type: 'ready', on: false })}>
              <Check size={18} /> Ready — waiting for {waiting.length ? waiting.join(', ') : 'the countdown'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary !text-[14.5px] tracking-[0.02em]"
              onClick={() => {
                Synth.unlock();
                buzz(30);
                intent({ type: 'ready' });
              }}
            >
              I UNDERSTAND THE RULES — READY
            </button>
          )
        ) : (
          <div className="muted flex h-14 items-center justify-center text-[15px]">You’ll be dealt in next round.</div>
        )}
        {isHost && (
          <div className="mt-1 flex">
            <button type="button" className="muted h-10 flex-1 text-[13.5px] font-medium" onClick={() => intent({ type: 'lobby' })}>
              Cancel round
            </button>
            <button type="button" className="h-10 flex-1 text-[13.5px] font-semibold" onClick={() => intent({ type: 'forceStart' })} disabled={ready.length === here.length}>
              Force start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Outdoor arenas and the dark rituals re-confirm the IRL safety warning every round.
const safetyNote = (r, g) => {
  if (r.arena === 'roadtrip') return 'Roadtrip: drivers never play. Passengers only, and only while it is safe.';
  if (g.dark) return 'This ritual is played in the dark: clear the floor of anything you could trip over and keep away from stairs.';
  if (r.zone) return `Outdoor Playzone: stay inside the ${r.zone.radius} m boundary and never chase anyone into a road.`;
  return null;
};

export default function Briefing({ view, intent }) {
  const r = view.round;
  const info = briefingFor(view);
  const motion = useMotionMode();
  const risky = info.game.dark || r.arena !== 'indoor';
  const [agreed, setAgreed] = useState(!risky);

  useEffect(() => {
    buzz([40, 30, 40]);
  }, []);

  return (
    <div className={`enter relative pb-48 ${info.horror ? 'horror' : ''}`} data-briefing>
      {info.horror && <HorrorFx fixed />}
      <div className="relative pt-4">
        <div className="eyebrow !text-[12px] font-semibold uppercase tracking-[0.14em]">Mission briefing & setup</div>
        <h2 className={`title mt-2 ${info.horror ? 'horror-title' : ''}`}>{info.game.name}</h2>
        <p className="muted mt-2 text-[15px] leading-snug">
          You are <b className="text-[var(--fg)]">{info.label}</b>. Read this, set the space up, then tap ready. The clock and the cameras start only when everyone is in.
        </p>
        {motion === 'ask' && (
          <button
            type="button"
            className="btn btn-secondary mt-4 !min-h-[44px] text-[14px]"
            onClick={() => {
              Synth.unlock();
              requestMotion();
            }}
          >
            {r.zone ? 'Enable motion & compass' : 'Enable motion sensors'}
          </button>
        )}
        <RulesSections view={view} setupFirst />
      </div>
      <ReadyBar view={view} intent={intent} />
      {!agreed && <SafetyGate extra={safetyNote(r, info.game)} onAgree={() => setAgreed(true)} />}
    </div>
  );
}
