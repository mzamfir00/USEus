import React, { useEffect, useRef, useState } from 'react';
import { Check, Skull, Volume2 } from 'lucide-react';
import { XP } from '../../game/games';
import { cameraPointingDown, subscribeMotion } from '../../lib/motion';
import { buzz, speak, Synth } from '../../lib/sound';
import { useNow } from '../room/helpers';
import Camera from './Camera';
import { BlindCountdown, BottomBar, GameShell, nameOf, PickPlayer, useScheduled } from './shared';

const PEEK_EVERY = 45000;
const PEEK_WINDOW = 10000;

// A short banner whenever the room reports noise (the noise snitch went off somewhere).
function useNoiseBanner(view, serverNow) {
  const n = view.round.data.noise;
  const [show, setShow] = useState(false);
  const seen = useRef(n?.count || 0);
  useEffect(() => {
    if (!n || n.count === seen.current) return undefined;
    seen.current = n.count;
    if (serverNow() - n.at > 5000) return undefined;
    setShow(true);
    buzz([60, 40, 60]);
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, [n?.count, n?.at, serverNow]); // eslint-disable-line react-hooks/exhaustive-deps
  return show;
}

function Banner({ children, strong = false }) {
  return (
    <div
      className={`absolute inset-x-4 top-[calc(max(150px,calc(env(safe-area-inset-top)+136px))+var(--zone-h,0px))] z-10 mr-14 rounded-[18px] px-5 py-3.5 text-center ${
        strong ? 'bg-white text-black' : 'border border-white/15 bg-black/65 text-white backdrop-blur'
      }`}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Hide & Seek ------------------------------ */

export function HideSeekSeeker({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const d = view.round.data;
  const now = serverNow();
  const [picking, setPicking] = useState(false);
  const hiders = view.round.participants.filter((id) => view.round.roles[id] === 'hider');
  const left = hiders.filter((id) => !d.found[id]);
  const noise = useNoiseBanner(view, serverNow);
  const cooling = Math.max(0, d.radarCooldown - now);

  if (now < d.hideUntil) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Seeker · eyes closed" onLeave={onLeave}>
        <BlindCountdown until={d.hideUntil} serverNow={serverNow} title="Eyes closed — count out loud" sub="Hiders are running. Your camera opens at zero." />
      </GameShell>
    );
  }

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Seeker · ${hiders.length - left.length}/${hiders.length} found`} onLeave={onLeave}>
      <Camera hud={hud} record pulseButton>
        {noise && (
          <Banner strong>
            <div className="text-[13px] font-medium text-black/55">Noise snitch</div>
            <div className="text-[20px] font-bold">A hider just made noise — listen!</div>
          </Banner>
        )}
        <BottomBar>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={d.radarLeft <= 0 || cooling > 0}
              onClick={() => {
                buzz(40);
                intent({ type: 'radar' });
              }}
              className="btn btn-secondary !border-white/20 !bg-black/60"
            >
              <Volume2 size={18} /> {cooling > 0 ? `${Math.ceil(cooling / 1000)}s` : `Ping · ${d.radarLeft}`}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
              Found someone
            </button>
          </div>
        </BottomBar>
      </Camera>
      {picking && (
        <PickPlayer
          title="Who did you find?"
          ids={left}
          view={view}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            intent({ type: 'found', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function HideSeekHider({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const d = view.round.data;
  const me = view.me;
  const now = serverNow();
  const found = !!d.found[me];
  const seeking = now >= d.hideUntil;
  const [peekFail, setPeekFail] = useState(null);
  const passed = useRef(new Set());
  const failed = useRef(new Set());
  const first = d.hideUntil + PEEK_EVERY;
  const k = now >= first ? Math.floor((now - first) / PEEK_EVERY) : -1;
  const windowStart = first + k * PEEK_EVERY;
  const inWindow = k >= 0 && now < windowStart + PEEK_WINDOW && !found;
  const kRef = useRef(k);
  kRef.current = k;
  const inWindowRef = useRef(inWindow);
  inWindowRef.current = inWindow;

  const panned = () => {
    if (inWindowRef.current) passed.current.add(kRef.current);
    setPeekFail((v) => (v ? null : v)); // panning out clears a failed check
  };

  // A quick turn of the phone also counts as a peek.
  useEffect(() => subscribeMotion((e, { rot }) => rot > 25 && panned()), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Missed peek window → Snitch alarm (windows that ended before this screen mounted don't count).
  const lastEnded = now >= first + PEEK_WINDOW ? Math.floor((now - first - PEEK_WINDOW) / PEEK_EVERY) : -1;
  const mountEnded = useRef(lastEnded);
  useEffect(() => {
    if (lastEnded <= mountEnded.current || found || passed.current.has(lastEnded) || failed.current.has(lastEnded)) return;
    failed.current.add(lastEnded);
    setPeekFail('peek');
  }, [lastEnded, found]);

  useEffect(() => {
    if (inWindow) {
      Synth.beep(true);
      buzz([120, 60, 120]);
    }
  }, [inWindow, k]);

  useScheduled(d.radarCount, d.radarAt, serverNow, () => {
    if (found) return;
    Synth.radar();
    buzz([300, 100, 300]);
  });

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={found ? 'Found · keep filming' : 'Hider · keep filming'} onLeave={onLeave}>
      <Camera
        hud={hud}
        record
        enforce
        violation={peekFail}
        onResume={() => setPeekFail(null)}
        onPan={panned}
        noiseMeter={seeking && !found}
        onNoise={() => intent({ type: 'noise' })}
      >
        {!seeking && (
          <Banner>
            <div className="text-[13px] text-white/60">Hide now</div>
            <div className="tnum text-[22px] font-bold">Seeker looks in {Math.ceil((d.hideUntil - now) / 1000)}s</div>
          </Banner>
        )}
        {inWindow && !passed.current.has(k) && (
          <Banner strong>
            <div className="text-[13px] font-medium text-black/55">Peek check</div>
            <div className="text-[20px] font-bold leading-tight">Pan your camera out of your spot</div>
            <div className="tnum mt-0.5 text-[13px] text-black/60">{Math.ceil((windowStart + PEEK_WINDOW - now) / 1000)}s</div>
          </Banner>
        )}
        {inWindow && passed.current.has(k) && (
          <Banner>
            <div className="flex items-center justify-center gap-2 text-[16px] font-semibold">
              <Check size={18} /> Peek check passed
            </div>
          </Banner>
        )}
        {found && (
          <Banner>
            <div className="text-[18px] font-semibold">Found — keep filming the hunt</div>
          </Banner>
        )}
      </Camera>
    </GameShell>
  );
}

/* -------------------------------- Sardines -------------------------------- */

export function Sardines({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const role = r.roles[me];
  const packed = d.packed.includes(me);
  const seeking = now >= d.hideUntil;
  const hunters = r.participants.filter((id) => r.roles[id] === 'hunter');
  const searching = hunters.filter((id) => !d.packed.includes(id));
  const noise = useNoiseBanner(view, serverNow);
  const inSpot = role === 'sardine' || packed;

  if (role === 'hunter' && !seeking) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Hunter · eyes closed" onLeave={onLeave}>
        <BlindCountdown until={d.hideUntil} serverNow={serverNow} title="Eyes closed — the sardine is hiding" sub="Then search alone, filming all the way." />
      </GameShell>
    );
  }

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={inSpot ? `In the spot · ${searching.length} still searching` : 'Hunter · find the sardine'} onLeave={onLeave}>
      <Camera hud={hud} record enforce noiseMeter={inSpot && seeking} onNoise={() => intent({ type: 'noise' })}>
        {role === 'sardine' && !seeking && (
          <Banner>
            <div className="text-[13px] text-white/60">Hide now</div>
            <div className="tnum text-[22px] font-bold">Hunters look in {Math.ceil((d.hideUntil - now) / 1000)}s</div>
          </Banner>
        )}
        {inSpot && seeking && !noise && (
          <Banner>
            <div className="text-[16px] font-semibold">Stay silent. The noise snitch is listening.</div>
          </Banner>
        )}
        {noise && !inSpot && (
          <Banner strong>
            <div className="text-[13px] font-medium text-black/55">Noise snitch</div>
            <div className="text-[20px] font-bold">Noise from the hiding spot!</div>
          </Banner>
        )}
        {role === 'hunter' && !packed && (
          <BottomBar>
            <button type="button" className="btn btn-primary" onClick={() => window.confirm('Found the sardine? Squeeze in silently.') && intent({ type: 'packed' })}>
              I found them — squeeze in
            </button>
          </BottomBar>
        )}
      </Camera>
    </GameShell>
  );
}

/* ---------------------------- The Floor Is Lava ---------------------------- */

export function FloorLava({ view, serverNow, intent, onLeave, hud }) {
  useNow(150);
  const cam = useRef(null);
  const d = view.round.data;
  const me = view.me;
  const lava = d.lava;
  const now = serverNow();
  const counting = lava && now < lava.at && now >= lava.at - 6000;
  const secs = counting ? Math.ceil((lava.at - now) / 1000) : null;
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const [result, setResult] = useState(null);
  const down = cameraPointingDown();
  const lastSec = useRef(null);

  useEffect(() => setArmed(false), [lava?.n]);

  // Siren + countdown on every phone.
  useEffect(() => {
    if (secs !== lastSec.current && secs !== null && secs <= 5) {
      Synth.siren();
      buzz(secs <= 2 ? [200, 60, 200] : 120);
    }
    lastSec.current = secs;
  }, [secs]);

  // At zero: judge (camera pointing down, or the tap fallback) and send a proof photo.
  useScheduled(
    lava?.n,
    lava?.at,
    serverNow,
    () => {
      const pointing = cameraPointingDown();
      const safe = pointing === null ? armedRef.current : pointing;
      const img = cam.current?.snapshot();
      intent({ type: 'lavaCheck', n: lava.n, safe, img, mediaId: `lava${lava.n}-${me.slice(0, 8)}` });
      setResult(safe);
      if (safe) Synth.success();
      else {
        Synth.boom();
        buzz([300, 80, 300]);
      }
      setTimeout(() => setResult(null), 3000);
    },
    0
  );

  const myChecks = Object.values(d.checks).map((c) => c[me]);
  const safeCount = myChecks.filter((v) => v === true).length;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Lava calls ${lava?.n || 0}/${d.total} · safe ${safeCount}`} onLeave={onLeave}>
      <Camera ref={cam} hud={hud} record enforce flash={counting}>
        {counting && (
          <div className="absolute inset-x-4 top-[calc(max(150px,calc(env(safe-area-inset-top)+136px))+var(--zone-h,0px))] z-10 mr-14 rounded-[22px] bg-white px-5 py-5 text-center text-black">
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em]">The floor is lava in</div>
            <div className="tnum text-[86px] font-bold leading-none tracking-[-0.05em]">{secs}</div>
            <div className="mt-1 text-[14px] font-medium">Both feet up · camera pointing down</div>
            {down !== null && <div className="mt-2 text-[13px] font-semibold">{down ? 'Camera down ✓' : 'Point your camera at your feet'}</div>}
          </div>
        )}
        {result !== null && (
          <div className="pop absolute inset-x-6 top-[40%] z-10 rounded-[22px] bg-white px-5 py-5 text-center text-black">
            <div className="text-[34px] font-bold tracking-[-0.03em]">{result ? 'SAFE' : 'BURNED'}</div>
            <div className="text-[13px] text-black/60">{result ? `+${XP.lavaSafe} XP · proof photo sent` : `${XP.lavaBurn} XP`}</div>
          </div>
        )}
        {counting && down === null && (
          <BottomBar>
            <button type="button" className={`btn ${armed ? 'btn-primary' : 'btn-secondary !border-white/20 !bg-black/60'}`} onClick={() => setArmed((v) => !v)}>
              {armed ? 'Feet up — locked in' : 'Tap when your feet are up'}
            </button>
          </BottomBar>
        )}
      </Camera>
    </GameShell>
  );
}

/* ------------------------------- Zombie Tag ------------------------------- */

export function ZombieTag({ view, serverNow, intent, onLeave, hud }) {
  useNow(500);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const zombie = d.zombies.includes(me);
  const survivors = r.participants.filter((id) => !d.zombies.includes(id));
  const [toast, setToast] = useState(null);
  const seen = useRef(d.last?.at || 0);

  useEffect(() => {
    if (!d.last || d.last.at === seen.current) return undefined;
    seen.current = d.last.at;
    Synth.infect();
    buzz([200, 100, 200]);
    setToast(d.last.id === me ? 'You were infected — hunt them down' : `${nameOf(view, d.last.id)} was infected`);
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [d.last?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={zombie ? `Zombie · ${survivors.length} survivors left` : `Survivor · ${d.zombies.length} zombies`} onLeave={onLeave}>
      <Camera key={zombie ? 'z' : 's'} hud={hud} record enforce={!zombie} beacon={zombie} pulseButton={zombie}>
        {zombie && <div className="pointer-events-none absolute inset-0 z-[6] border-[10px] border-white" style={{ animation: 'blink 2s ease-in-out infinite' }} />}
        {zombie && (
          <Banner strong>
            <div className="flex items-center justify-center gap-2 text-[22px] font-bold">
              <Skull size={22} /> ZOMBIE
            </div>
            <div className="text-[13px] text-black/60">Your flashlight is a beacon. Tag the survivors.</div>
          </Banner>
        )}
        {toast && (
          <div className="pop absolute inset-x-6 top-[42%] z-10 rounded-[18px] bg-white px-5 py-4 text-center text-[17px] font-bold text-black">{toast}</div>
        )}
        {!zombie && (
          <BottomBar>
            <button type="button" className="btn btn-primary" onClick={() => window.confirm('Were you tagged by a zombie?') && intent({ type: 'infected' })}>
              I got tagged
            </button>
          </BottomBar>
        )}
      </Camera>
    </GameShell>
  );
}

/* ------------------------------- Marco Polo ------------------------------- */

export function MarcoHunter({ view, serverNow, intent, onLeave }) {
  useNow(200);
  const d = view.round.data;
  const [picking, setPicking] = useState(false);
  const cooldown = Math.max(0, d.cooldownUntil - serverNow());
  const ready = cooldown === 0;
  const polos = view.round.participants.filter((id) => view.round.roles[id] === 'polo' && !d.tagged[id]);

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Marco · ${Object.keys(d.tagged).length} tagged`} onLeave={onLeave} light={ready}>
      <button
        type="button"
        aria-label="Call Marco"
        disabled={!ready}
        onClick={() => {
          buzz([80, 40, 80]);
          Synth.marco();
          speak('Marco!');
          intent({ type: 'marco' });
        }}
        className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-center transition-colors duration-300 ${ready ? 'bg-white text-black' : 'bg-black text-white'}`}
      >
        {ready ? (
          <>
            <div className="text-[15px] font-medium text-black/50">Eyes closed · tap anywhere</div>
            <div className="mt-3 text-[86px] font-bold leading-none tracking-[-0.05em]">MARCO!</div>
            <div className="mt-6 text-[15px] text-black/60">Every polo answers out loud and flashes</div>
          </>
        ) : (
          <>
            <div className="tnum text-[96px] font-bold leading-none">{Math.ceil(cooldown / 1000)}</div>
            <div className="mt-4 text-[17px] font-semibold">Listen for the polos</div>
          </>
        )}
      </button>
      <BottomBar>
        <button type="button" className={`btn ${ready ? 'bg-black text-white' : 'btn-primary'}`} onClick={() => setPicking(true)}>
          I tagged someone
        </button>
      </BottomBar>
      {picking && (
        <PickPlayer
          title="Who did you tag?"
          ids={polos}
          view={view}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            intent({ type: 'tag', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function MarcoPolo({ view, serverNow, onLeave, hud }) {
  const cam = useRef(null);
  const d = view.round.data;
  const tagged = !!d.tagged[view.me];
  const [polo, setPolo] = useState(false);

  // Every hider answers with a voice + tone + light, slightly staggered so they can be told apart.
  useScheduled(d.marcos, d.marcoAt, serverNow, () => {
    if (tagged) return;
    setTimeout(() => {
      speak('Polo!');
      Synth.polo();
      cam.current?.flash(300);
      buzz(250);
      setPolo(true);
      setTimeout(() => setPolo(false), 1500);
    }, Math.random() * 500);
  });

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={tagged ? 'Tagged · keep filming' : 'Polo · film Marco'} onLeave={onLeave}>
      <Camera ref={cam} hud={hud} record enforce>
        {polo && (
          <Banner strong>
            <div className="text-[13px] font-medium text-black/55">Marco called</div>
            <div className="text-[34px] font-bold leading-none tracking-[-0.03em]">POLO!</div>
          </Banner>
        )}
        {tagged && !polo && (
          <Banner>
            <div className="text-[17px] font-semibold">Tagged — keep filming Marco</div>
          </Banner>
        )}
      </Camera>
    </GameShell>
  );
}
