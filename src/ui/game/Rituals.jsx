// Halloween Rituals: five urban-legend games built on the flashlight, mic, camera and sync.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, Flame, Ghost, Hand, Lock, Moon, Music, PowerOff, Skull, UserX, Vote, Wind } from 'lucide-react';
import { blackoutAt, dopAlive, nextBlackout, statueCycle } from '../../game/engine';
import { RITUAL } from '../../game/games';
import { buzz, speak, Synth } from '../../lib/sound';
import { formatTime, useNow } from '../room/helpers';
import { Sheet } from '../primitives';
import Camera from './Camera';
import HorrorFx from './HorrorFx';
import { useMotion } from './RedLight';
import { BottomBar, GameShell, nameOf, PickPlayer, userOf } from './shared';

const TOP = 'top-[calc(max(150px,calc(var(--safe-top)+136px))+var(--zone-h,0px))]';
const PAD_TOP = 'pt-[calc(max(84px,calc(var(--safe-top)+70px))+var(--zone-top,0px))]';

// Fires `fn` whenever `value` changes after mount (new extinguish, new noise, new blackout…).
function useOnChange(value, fn) {
  const seen = useRef(value);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (value === seen.current) return;
    const prev = seen.current;
    seen.current = value;
    cb.current(value, prev);
  }, [value]);
}

// Toggles every `ms` while `on` (flashlight strobes).
function useBlink(on, ms = 250) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setV((x) => !x), ms);
    return () => {
      clearInterval(id);
      setV(false);
    };
  }, [on, ms]);
  return v;
}

function Banner({ children, strong = false, className = '' }) {
  return (
    <div
      className={`absolute inset-x-4 ${TOP} z-10 mr-14 rounded-[18px] px-5 py-3.5 text-center ${strong ? 'bg-white text-black' : 'border border-white/15 bg-black/70 text-white backdrop-blur'} ${className}`}
    >
      {children}
    </div>
  );
}

function ConfirmCaught({ label, onConfirm }) {
  return (
    <button
      type="button"
      className="h-11 w-full text-[13.5px] font-medium text-white/70"
      onClick={() => {
        if (window.confirm(`${label}? You'll be out for the rest of the round.`)) {
          buzz([200, 80, 200]);
          onConfirm();
        }
      }}
    >
      {label}
    </button>
  );
}

function OutScreen({ title, sub, icon: Icon = Skull }) {
  return (
    <div className="absolute inset-0 z-[12] grid place-items-center bg-black/85 px-8 text-center">
      <div>
        <Icon size={34} className="mx-auto text-white/70" />
        <div className="horror-title mt-4 text-[40px] leading-none text-white">{title}</div>
        <div className="mt-3 text-[15px] text-white/60">{sub}</div>
      </div>
    </div>
  );
}

const hudOf = (hud, extra) => ({ ...hud, title: `${hud.title}${extra ? ` · ${extra}` : ''}` });

/* ============================== The Midnight Man ============================== */

// 12:00 AM → 3:33 AM across the round.
function ritualTime(r, now) {
  const p = Math.min(1, Math.max(0, (now - r.startsAt) / (r.endsAt - r.startsAt)));
  const mins = Math.floor(p * 213);
  const h = Math.floor(mins / 60);
  return `${h === 0 ? 12 : h}:${String(mins % 60).padStart(2, '0')} AM`;
}

export function MidnightHunter({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const r = view.round;
  const d = r.data;
  const now = serverNow();
  const candles = r.participants.filter((id) => r.roles[id] === 'candle');
  const lit = candles.filter((id) => !d.caught[id] && !d.out[id]);
  const exposed = candles.filter((id) => d.exposed[id] && !d.caught[id]);
  const cooling = Math.max(0, d.cooldownUntil - now);
  const [target, setTarget] = useState(null);
  const [catching, setCatching] = useState(false);
  const status = (id) => (d.caught[id] ? 'TAKEN' : d.exposed[id] ? 'EXPOSED' : d.out[id] ? 'IN THE DARK' : 'LIT');

  useOnChange(exposed.join(','), (v, prev) => {
    if (v.split(',').filter(Boolean).length > prev.split(',').filter(Boolean).length) buzz([300, 100, 300]);
  });
  useEffect(() => {
    if (target && !lit.includes(target)) setTarget(null);
  }, [lit.join(','), target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Midnight Man · ${lit.length} candle${lit.length === 1 ? '' : 's'} lit`} onLeave={onLeave}>
      <div className="absolute inset-0 bg-black text-white">
        <HorrorFx />
        <div className={`relative flex h-full flex-col px-5 pb-[calc(18px+var(--safe-bottom))] ${PAD_TOP}`}>
          <div className="vhs text-[13px] text-white/50">▶ PLAY · {ritualTime(r, now)}</div>
          <div className="horror-title mt-2 text-[44px] leading-none">The candles</div>
          <div className="mt-4 space-y-2" data-candles>
            {candles.map((id) => (
              <div
                key={id}
                className={`flex items-center justify-between rounded-[14px] border px-4 py-3 ${d.exposed[id] && !d.caught[id] ? 'border-white bg-white text-black' : 'border-white/15'}`}
              >
                <span className={`flex items-center gap-2 text-[15px] font-semibold ${d.caught[id] ? 'line-through opacity-40' : ''}`}>
                  <Flame size={15} className={d.out[id] || d.caught[id] ? 'opacity-30' : ''} /> {nameOf(view, id)}
                </span>
                <span className={`vhs text-[11px] ${d.exposed[id] && !d.caught[id] ? 'animate-pulse' : 'text-white/60'}`}>{status(id)}</span>
              </div>
            ))}
          </div>
          {exposed.length > 0 && (
            <div className="pop mt-3 rounded-[14px] bg-white px-4 py-3 text-black" data-exposed>
              <div className="vhs text-[11px] text-black/60">Shrieking now</div>
              <div className="text-[17px] font-bold">{exposed.map((id) => `@${userOf(view, id)}`).join(', ')} — follow the scream</div>
            </div>
          )}
          <div className="mt-auto">
            <div className="noscroll -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
              <button type="button" onClick={() => setTarget(null)} className={`pill !border-white/20 ${!target ? '!bg-white !text-black' : '!bg-black !text-white'}`}>
                Random candle
              </button>
              {lit.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTarget(id)}
                  className={`pill !border-white/20 ${target === id ? '!bg-white !text-black' : '!bg-black !text-white'}`}
                >
                  {nameOf(view, id).split(' ')[0]}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={cooling > 0 || !lit.length}
              onClick={() => {
                Synth.unlock();
                buzz([60, 40, 160]);
                intent({ type: 'extinguish', ...(target && { id: target }) });
              }}
              className="flex min-h-[64px] w-full flex-col items-center justify-center rounded-[20px] bg-white text-black transition-opacity disabled:opacity-35"
              data-extinguish={cooling > 0 ? Math.ceil(cooling / 1000) : 0}
            >
              <span className="flex items-center gap-2 text-[16px] font-bold tracking-wide">
                <Wind size={18} /> EXTINGUISH CANDLE
              </span>
              <span className="text-[12px] font-medium text-black/60">
                {cooling > 0 ? `Ready in ${Math.ceil(cooling / 1000)}s` : `${target ? nameOf(view, target) : 'Random'} · 25s cooldown`}
              </span>
            </button>
            <button type="button" className="btn btn-secondary mt-2 !border-white/20 !bg-black !text-white" onClick={() => setCatching(true)}>
              <Hand size={17} /> I caught someone
            </button>
          </div>
        </div>
      </div>
      {catching && (
        <PickPlayer
          title="Who did you catch?"
          ids={candles.filter((id) => !d.caught[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

// Five matches in random spots; tap 1→5 to relight.
function Relight({ out, now, exposed, onDone }) {
  const cells = useMemo(() => {
    let seed = out.at % 2147483647;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pool = Array.from({ length: 12 }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, RITUAL.relightTaps);
  }, [out.at]);
  const [next, setNext] = useState(0);
  const left = Math.max(0, out.deadline - now);
  useEffect(() => {
    if (next >= RITUAL.relightTaps) onDone();
  }, [next]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black px-5 pb-[calc(20px+var(--safe-bottom))] pt-[max(80px,calc(var(--safe-top)+66px))] text-white"
      style={exposed ? { animation: 'strobe .5s steps(1) infinite' } : undefined}
      data-relight={next}
    >
      <div className="rounded-[20px] border border-white/30 bg-black px-5 py-4 text-center">
        <div className="vhs text-[12px] text-white/60">{exposed ? 'They can hear you' : 'Your candle went out'}</div>
        <div className="horror-title mt-1 text-[34px] leading-none">{exposed ? 'EXPOSED' : 'Relight it'}</div>
        <div className="mt-2 text-[14px] text-white/70">
          {exposed ? 'Your phone is shrieking. Light the matches to stop it.' : `Tap the matches in order. ${Math.ceil(left / 1000)}s before you scream.`}
        </div>
        {!exposed && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${(left / RITUAL.relightMs) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="relative mt-4 grid flex-1 grid-cols-3 grid-rows-4 gap-3">
        {Array.from({ length: 12 }, (_, cell) => {
          const n = cells.indexOf(cell);
          if (n < 0) return <span key={cell} />;
          const done = n < next;
          return (
            <button
              key={cell}
              type="button"
              aria-label={`Match ${n + 1}`}
              onClick={() => {
                if (n !== next) {
                  buzz(80);
                  return;
                }
                Synth.click();
                buzz(20);
                setNext(next + 1);
              }}
              className={`grid place-items-center rounded-[18px] border text-[22px] font-bold ${done ? 'border-white bg-white text-black' : 'border-white/40 bg-black text-white'}`}
            >
              <span className="flex flex-col items-center gap-1">
                <Flame size={22} className={done ? '' : 'opacity-40'} />
                {n + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MidnightCandle({ view, serverNow, intent, onLeave, hud }) {
  useNow(200);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const out = d.out[me];
  const exposed = !!d.exposed[me];
  const caught = !!d.caught[me];
  const strobe = useBlink(exposed && !caught, 250);

  useOnChange(out?.at, (at) => {
    if (!at) return;
    Synth.whisper();
    buzz([500, 120, 200]);
  });
  // Exposed: shriek until relit.
  useEffect(() => {
    if (!exposed || caught) return undefined;
    Synth.shriek();
    buzz([400, 100, 400]);
    const id = setInterval(() => {
      Synth.shriek();
      buzz([400, 100, 400]);
    }, 1500);
    return () => clearInterval(id);
  }, [exposed, caught]);

  const torch = caught ? false : out ? exposed && strobe : true;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Taken by the Midnight Man' : out ? 'Your candle is out' : 'Survivor · candle lit'} onLeave={onLeave}>
      <Camera hud={hudOf(hud, ritualTime(r, now))} record enforce={!caught} lensCheck={false} torch={torch}>
        <HorrorFx />
        {!out && !caught && (
          <Banner>
            <div className="vhs text-[11.5px] text-white/60">{ritualTime(r, now)}</div>
            <div className="mt-0.5 flex items-center justify-center gap-2 text-[17px] font-bold">
              <Flame size={17} className="breathe" /> Candle lit
            </div>
          </Banner>
        )}
        <BottomBar>{!caught && <ConfirmCaught label="He got me" onConfirm={() => intent({ type: 'caughtBy' })} />}</BottomBar>
        {caught && <OutScreen title="Taken" sub="Stay silent until 3:33 AM. Keep watching." />}
      </Camera>
      {out && !caught && <Relight out={out} now={now} exposed={exposed} onDone={() => intent({ type: 'relight' })} />}
    </GameShell>
  );
}

/* ============================== The Weeping Statue ============================== */

function useStatueClock(r, serverNow, onSwitch) {
  useNow(100);
  const c = statueCycle(r, serverNow());
  useOnChange(c.lit, (lit) => onSwitch(lit));
  return c;
}

export function StatueEntity({ view, serverNow, intent, onLeave }) {
  const r = view.round;
  const d = r.data;
  const c = useStatueClock(r, serverNow, (lit) => buzz(lit ? [450] : [60, 50, 60]));
  const [catching, setCatching] = useState(false);
  const watchers = r.participants.filter((id) => r.roles[id] === 'watcher');
  const report = () => {
    const now = serverNow();
    const cc = statueCycle(r, now);
    if (cc.lit && cc.left < RITUAL.statueLight - 500) intent({ type: 'statueMoved' });
  };
  const motion = useMotion(report);
  useOnChange(d.moves, (n) => n && buzz([600, 100, 600]));

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Statue · ${c.lit ? 'FREEZE' : 'move'}`} onLeave={onLeave}>
      <div className="absolute inset-0 bg-black text-white" data-statue={c.lit ? 'light' : 'dark'}>
        <HorrorFx />
        <div className={`absolute inset-x-5 bottom-[calc(96px+var(--safe-bottom))] top-[max(80px,calc(var(--safe-top)+66px))] rounded-[28px] border-2 ${c.lit ? 'border-white' : 'border-white/10'}`} />
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="vhs text-[13px] text-white/50">{c.lit ? 'The light is on them' : 'Total blackout'}</div>
          <div className={`mt-2 text-[76px] font-bold leading-[0.9] tracking-[-0.05em] ${c.lit ? 'tremble' : 'text-white/80'}`}>{c.lit ? 'FREEZE' : 'MOVE'}</div>
          <div className="tnum mt-4 text-[34px] font-bold text-white/70">{Math.ceil(c.left / 1000)}</div>
          <div className="mt-6 max-w-[30ch] text-[14px] text-white/55">
            {motion.mode === 'sensor'
              ? 'Phone in your pocket. It feels it if you move in the light.'
              : motion.mode === 'ask'
                ? 'Tap below so your phone can feel you move.'
                : 'No motion sensor on this phone — freeze on your honour.'}
          </div>
          {motion.mode === 'ask' && (
            <button type="button" className="pill mt-3 !border-white/30 !bg-black !text-white" onClick={motion.ask}>
              Enable motion sensor
            </button>
          )}
          {d.moves > 0 && (
            <div className="vhs mt-4 text-[12px] text-white/70" data-moves={d.moves}>
              Moved in the light ×{d.moves}
            </div>
          )}
        </div>
      </div>
      <BottomBar>
        <button type="button" className="btn btn-secondary !border-white/20 !bg-black !text-white" onClick={() => setCatching(true)}>
          <Hand size={17} /> I tagged someone
        </button>
      </BottomBar>
      {catching && (
        <PickPlayer
          title="Who did you tag?"
          ids={watchers.filter((id) => !d.tagged[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function StatueWatcher({ view, serverNow, intent, onLeave, hud }) {
  const r = view.round;
  const d = r.data;
  const tagged = !!d.tagged[view.me];
  const c = useStatueClock(r, serverNow, () => {
    Synth.clunk();
    buzz(30);
  });
  const [moved, setMoved] = useState(false);
  useOnChange(d.moves, (n) => {
    if (!n) return;
    Synth.alert();
    setMoved(true);
    setTimeout(() => setMoved(false), 3000);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={tagged ? 'Tagged by the Statue' : `Survivor · ${c.lit ? 'light' : 'blackout'}`} onLeave={onLeave}>
      <Camera hud={hud} record enforce={!tagged} lensCheck={false} torch={!tagged && c.lit}>
        <HorrorFx />
        {moved && (
          <Banner strong>
            <div className="vhs text-[11px] text-black/60">Snitched by its own phone</div>
            <div className="text-[19px] font-bold">THE STATUE MOVED IN THE LIGHT</div>
          </Banner>
        )}
        {!c.lit && !tagged && (
          <div className="pointer-events-none absolute inset-0 z-[15] grid place-items-center bg-black" data-blackout>
            <div className="text-center">
              <div className="vhs text-[12px] text-white/25">Blackout</div>
              <div className="tnum mt-1 text-[40px] font-bold text-white/15">{Math.ceil(c.left / 1000)}</div>
            </div>
          </div>
        )}
        <BottomBar>{!tagged && <ConfirmCaught label="It got me" onConfirm={() => intent({ type: 'caughtBy' })} />}</BottomBar>
        {tagged && <OutScreen title="You blinked" sub="The Statue got you. Stay still and keep watching." icon={Eye} />}
      </Camera>
    </GameShell>
  );
}

/* ============================== Daruma-san ============================== */

export function DarumaShadow({ view, serverNow, intent, onLeave }) {
  useNow(200);
  const r = view.round;
  const d = r.data;
  const now = serverNow();
  const frozen = now < d.frozenUntil;
  const walkers = r.participants.filter((id) => r.roles[id] === 'walker');
  const [catching, setCatching] = useState(false);
  useOnChange(d.freezes, (n) => {
    if (!n) return;
    Synth.sting();
    speak('Tomare!');
    buzz([700, 100, 300]);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={frozen ? 'The Shadow · FROZEN' : 'The Shadow · stalk them'} onLeave={onLeave}>
      <div className={`absolute inset-0 ${frozen ? 'bg-white text-black' : 'bg-black text-white'}`} data-frozen={frozen ? 1 : 0}>
        {!frozen && <HorrorFx />}
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          {frozen ? (
            <>
              <div className="vhs text-[13px] text-black/60">@{userOf(view, d.frozenBy)} saw you</div>
              <div className="mt-2 text-[72px] font-bold leading-[0.9] tracking-[-0.05em]">TOMARE!</div>
              <div className="mt-3 text-[18px] font-semibold">Freeze. Don’t move.</div>
              <div className="tnum mt-4 text-[48px] font-bold">{Math.ceil((d.frozenUntil - now) / 1000)}</div>
            </>
          ) : (
            <>
              <Moon size={30} className="text-white/50" />
              <div className="horror-title mt-3 text-[46px] leading-none">Stay behind them</div>
              <div className="mt-4 max-w-[30ch] text-[15px] text-white/60">They can only see you in their selfie cameras. When someone calls TOMARE, you freeze for 5 seconds.</div>
              <div className="mt-6 space-y-1.5 text-left">
                {walkers.map((id) => (
                  <div key={id} className={`vhs text-[12.5px] ${d.caught[id] ? 'text-white/30 line-through' : 'text-white/80'}`}>
                    {nameOf(view, id)} · {d.done[id]?.length || 0}/3 checkpoints
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <BottomBar>
        <button
          type="button"
          disabled={frozen}
          className={`btn ${frozen ? 'btn-primary' : 'btn-secondary !border-white/20 !bg-black !text-white'}`}
          onClick={() => setCatching(true)}
        >
          {frozen ? <Lock size={17} /> : <Hand size={17} />} {frozen ? 'Frozen' : 'I caught someone'}
        </button>
      </BottomBar>
      {catching && (
        <PickPlayer
          title="Who did you catch?"
          ids={walkers.filter((id) => !d.caught[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function DarumaWalker({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const cam = useRef(null);
  const caught = !!d.caught[me];
  const tasks = d.tasks[me] || [];
  const done = d.done[me] || [];
  const uses = RITUAL.tomareUses - (d.tomare[me] || 0);
  const cooling = Math.max(0, (d.tomareAt[me] || 0) + RITUAL.tomareCooldown - now);
  const frozen = now < d.frozenUntil;
  useOnChange(d.freezes, (n) => n && buzz(60));

  const tomare = () => {
    Synth.unlock();
    buzz([80, 40, 80]);
    const id = Math.random().toString(36).slice(2, 10);
    const img = cam.current?.live ? cam.current.snapshot() : null;
    intent({ type: 'tomare', mediaId: id, ...(img && { img }) });
  };

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Caught by the Shadow' : `Walker · ${done.length}/3 checkpoints`} onLeave={onLeave}>
      <Camera ref={cam} hud={hud} record enforce={!caught} lensCheck={false} lockFacing="user" glow torch={false}>
        <HorrorFx />
        <Banner strong={frozen}>
          {frozen ? (
            <>
              <div className="vhs text-[11px] text-black/60">@{userOf(view, d.frozenBy)} called it</div>
              <div className="text-[19px] font-bold">SHADOW FROZEN · {Math.ceil((d.frozenUntil - now) / 1000)}s</div>
            </>
          ) : (
            <>
              <div className="vhs text-[11px] text-white/60">Never turn around</div>
              <div className="text-[15px] font-semibold">Watch the dark behind you</div>
            </>
          )}
        </Banner>
        <BottomBar>
          {!caught && (
            <div className="space-y-2">
              <div className="rounded-[18px] border border-white/15 bg-black/70 px-4 py-3 backdrop-blur">
                {tasks.map((t, i) => {
                  const ok = done.includes(i);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={ok}
                      onClick={() => intent({ type: 'checkpoint', i })}
                      className="flex w-full items-center gap-3 py-1 text-left text-[14px]"
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white ${ok ? 'bg-white text-black' : ''}`}>
                        {ok && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className={ok ? 'line-through opacity-50' : ''}>{t}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={uses <= 0 || cooling > 0}
                onClick={tomare}
                className="btn btn-primary !min-h-[60px] !text-[17px] font-bold tracking-wide"
                data-tomare={uses}
              >
                {uses <= 0 ? 'NO TOMARE LEFT' : cooling > 0 ? `TOMARE IN ${Math.ceil(cooling / 1000)}s` : `TOMARE! (FREEZE SHADOW) · ${uses}`}
              </button>
              <ConfirmCaught label="The Shadow got me" onConfirm={() => intent({ type: 'caughtBy' })} />
            </div>
          )}
        </BottomBar>
        {caught && <OutScreen title="Caught" sub="You felt it before you saw it. Keep filming." icon={Ghost} />}
      </Camera>
    </GameShell>
  );
}

/* ============================== Dead Silence ============================== */

export function SilenceHunter({ view, serverNow, onLeave }) {
  useNow(500);
  const r = view.round;
  const d = r.data;
  const [ping, setPing] = useState(0);
  const mice = r.participants.filter((id) => r.roles[id] === 'mouse');
  useOnChange(d.noise.count, (n) => {
    if (!n) return;
    buzz([120, 60, 120]);
    setPing((p) => p + 1);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Hunter · ${mice.filter((id) => !d.caught[id]).length} still moving`} onLeave={onLeave}>
      <div className="absolute inset-0 bg-black text-white">
        <HorrorFx />
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="relative grid h-44 w-44 place-items-center">
            {ping > 0 && <span key={ping} className="absolute inset-0 rounded-full border-2 border-white" style={{ animation: 'ping 1.2s ease-out both' }} />}
            <Music size={40} className={ping ? 'text-white' : 'text-white/40'} />
          </div>
          <div className="horror-title mt-4 text-[46px] leading-none">Listen.</div>
          <div className="mt-3 max-w-[30ch] text-[15px] text-white/60">Blindfold on. Every sound they make chimes from their own phone.</div>
          <div className="vhs mt-6 text-[12.5px] text-white/70" data-noise={d.noise.count}>
            Noises heard: {d.noise.count}
          </div>
          <div className="mt-2 space-y-1">
            {mice.map((id) => (
              <div key={id} className={`vhs text-[12px] ${d.caught[id] ? 'text-white/30 line-through' : 'text-white/60'}`}>
                {nameOf(view, id)} · {d.done[id]?.length || 0}/3 tasks
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}

export function SilenceSurvivor({ view, serverNow, intent, onLeave, hud }) {
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const caught = !!d.caught[me];
  const tasks = d.tasks[me] || [];
  const done = d.done[me] || [];
  const noises = d.noiseBy[me] || 0;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Caught in the silence' : `Survivor · ${done.length}/3 tasks`} onLeave={onLeave}>
      <Camera
        hud={hud}
        record
        enforce={!caught}
        lensCheck={false}
        noiseMeter={!caught}
        noiseDb={-50}
        noiseHold={2}
        noiseCue="musicbox"
        noiseFlashMs={500}
        noiseCooldown={2500}
        onNoise={() => intent({ type: 'noise' })}
      >
        <HorrorFx />
        <Banner>
          <div className="vhs text-[11px] text-white/60">Whisper threshold · 35 dB</div>
          <div className="text-[15px] font-semibold">{noises ? `You made ${noises} sound${noises === 1 ? '' : 's'} (${noises * -25} XP)` : 'Not a sound.'}</div>
        </Banner>
        <BottomBar>
          {!caught && (
            <div className="space-y-2">
              <div className="rounded-[18px] border border-white/15 bg-black/70 px-4 py-3 backdrop-blur">
                {tasks.map((t, i) => {
                  const ok = done.includes(i);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={ok}
                      onClick={() => intent({ type: 'silentTask', i })}
                      className="flex w-full items-center gap-3 py-1 text-left text-[14px]"
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white ${ok ? 'bg-white text-black' : ''}`}>
                        {ok && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className={ok ? 'line-through opacity-50' : ''}>{t}</span>
                    </button>
                  );
                })}
              </div>
              <ConfirmCaught label="The hunter got me" onConfirm={() => intent({ type: 'caughtBy' })} />
            </div>
          )}
        </BottomBar>
        {caught && <OutScreen title="Heard you" sub="Sit down where you were caught. Not a sound." />}
      </Camera>
    </GameShell>
  );
}

/* ============================== The Doppelgänger ============================== */

export function Doppelganger({ view, serverNow, intent, onLeave, hud }) {
  useNow(200);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const isDop = !!view.mine?.doppelganger;
  const b = blackoutAt(r, now);
  const alive = dopAlive(r);
  const taken = !!d.taken[me];
  const banished = !!d.banished[me];
  const out = taken || banished;
  const [voting, setVoting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [secretOpen, setSecretOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const claimedNow = b && d.claimedIn[b.k];

  useOnChange(!!b, (dark) => {
    if (dark) {
      Synth.powerDown();
      buzz([300, 100, 300]);
    } else Synth.powerUp();
  });
  // Victims are announced to everyone else only once the lights come back.
  const announced = Object.keys(d.taken)
    .filter((id) => id !== me && !(b && d.taken[id] >= b.start))
    .join(',');
  useOnChange(announced, (v, prev) => {
    const fresh = v.split(',').filter((id) => id && !prev.split(',').includes(id));
    if (fresh.length) {
      setToast(`@${fresh.map((id) => userOf(view, id)).join(', @')} was taken in the dark`);
      buzz([200, 100, 200]);
      setTimeout(() => setToast(null), 5000);
    }
  });
  const banishedIds = Object.keys(d.banished).join(',');
  useOnChange(banishedIds, (v, prev) => {
    const fresh = v.split(',').filter((id) => id && !prev.split(',').includes(id));
    if (fresh.length && !fresh.includes(me)) {
      setToast(`@${userOf(view, fresh[0])} was voted out — and was innocent`);
      setTimeout(() => setToast(null), 5000);
    }
  });

  const tally = {};
  Object.values(d.accuse).forEach((id) => (tally[id] = (tally[id] || 0) + 1));
  const need = Math.floor(alive.length / 2) + 1;
  const nextCut = Math.max(0, nextBlackout(r, now) - now);

  return (
    <GameShell
      view={view}
      serverNow={serverNow}
      roleLabel={out ? (taken ? 'Taken' : 'Banished') : b ? 'POWER OUTAGE' : `Explorer · power cut in ${formatTime(nextCut)}`}
      onLeave={onLeave}
    >
      <Camera hud={hud} record enforce={!out} lensCheck={false} torch={!out && !b}>
        <HorrorFx />
        {toast && !b && (
          <Banner strong>
            <div className="text-[16px] font-bold">{toast}</div>
          </Banner>
        )}
        {isDop && !out && !b && (
          <button
            type="button"
            onClick={() => setSecretOpen((v) => !v)}
            className={`absolute inset-x-4 ${TOP} z-10 mr-14 rounded-[18px] bg-white px-4 py-3 text-left text-black ${toast ? 'hidden' : ''}`}
            data-secret
          >
            <div className="flex items-center gap-2 text-[13.5px] font-bold">
              <Skull size={15} /> {secretOpen ? 'YOU ARE THE DOPPELGÄNGER' : 'Secret role · tap to show'}
            </div>
            {secretOpen && <div className="mt-1 text-[13px] text-black/70">Act normal. When the power cuts, claim the player next to you.</div>}
          </button>
        )}
        {b && !out && (
          <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center bg-black px-8 text-center" data-blackout>
            <PowerOff size={28} className="text-white/25" />
            <div className="vhs mt-3 text-[12px] text-white/30">Power outage</div>
            <div className="tnum mt-1 text-[44px] font-bold text-white/20" style={{ animation: 'flicker 2s infinite' }}>
              {Math.ceil((b.end - now) / 1000)}
            </div>
            {isDop && (
              <button
                type="button"
                disabled={!!claimedNow}
                onClick={() => setClaiming(true)}
                className="mt-8 h-14 w-full max-w-[280px] rounded-full border border-white/40 text-[15px] font-bold tracking-wide text-white disabled:opacity-40"
                data-claim
              >
                {claimedNow ? 'VICTIM CLAIMED' : 'CLAIM VICTIM'}
              </button>
            )}
          </div>
        )}
        <BottomBar>
          {!out && !b && (
            <button type="button" className="btn btn-secondary !border-white/20 !bg-black/70 !text-white" onClick={() => setVoting(true)}>
              <Vote size={17} /> Accuse{d.accuse[me] ? ` · ${nameOf(view, d.accuse[me]).split(' ')[0]}` : ''}
            </button>
          )}
        </BottomBar>
        {taken && <OutScreen title="You were taken" sub="You’re a ghost now. Stay silent — let them work it out." icon={Ghost} />}
        {banished && <OutScreen title="Banished" sub="The squad voted you out. You were innocent." icon={UserX} />}
      </Camera>
      {claiming && (
        <PickPlayer
          title="Who is next to you?"
          ids={alive.filter((id) => id !== me)}
          view={view}
          onClose={() => setClaiming(false)}
          onPick={(id) => {
            setClaiming(false);
            buzz(40);
            intent({ type: 'claim', id });
          }}
          note="One claim per blackout."
        />
      )}
      {voting && (
        <div className="text-[var(--fg)]">
          <Sheet title="Who is the Doppelgänger?" onClose={() => setVoting(false)}>
            <p className="muted -mt-3 mb-4 text-[14px]">{need} votes unmask or banish someone. Tap again to take your vote back.</p>
            <div className="card divide overflow-hidden">
              {alive
                .filter((id) => id !== me)
                .map((id) => {
                  const mine = d.accuse[me] === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        buzz(20);
                        intent({ type: 'accuse', id: mine ? null : id });
                        setVoting(false);
                      }}
                      className={`card-press flex w-full items-center justify-between px-5 py-4 text-left ${mine ? 'bg-[var(--fg)] text-[var(--bg)]' : ''}`}
                    >
                      <span className="text-[16px] font-semibold">{nameOf(view, id)}</span>
                      <span className="tnum text-[13px] font-medium">
                        {tally[id] || 0}/{need}
                      </span>
                    </button>
                  );
                })}
            </div>
          </Sheet>
        </div>
      )}
    </GameShell>
  );
}
