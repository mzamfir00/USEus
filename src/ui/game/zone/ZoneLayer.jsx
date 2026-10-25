// GPS Playzone layer, drawn over every game screen in an outdoor zone round:
// live boundary + out-of-bounds penalty, hunter radar pings, hider decoys and heartbeat,
// the mid-round supply drop and the tactical map.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, Ghost, HeartPulse, Map as MapIcon, Radar, Satellite, TriangleAlert, X, Zap } from 'lucide-react';
import { isHunter, remainingHiders } from '../../../game/engine';
import { DROP_RADIUS, RADAR_MS, RADAR_USES, XP } from '../../../game/games';
import { bearing, cardinal, destination, formatDistance, haversine, nextShrinkAt, shrinkStep, zoneRadius } from '../../../lib/geo';
import { currentHeading } from '../../../lib/motion';
import { buzz, Synth } from '../../../lib/sound';
import { formatTime, useNow } from '../../room/helpers';
import LazyMap, { preloadMap } from './LazyMap';

const SIM_STEP = 5; // metres per D-pad tap
const SEND_MIN_M = 2; // resend a GPS fix after moving this far…
const SEND_MIN_MS = 4000; // …or this long
const BEAT_MS = { 20: 1000, 10: 650, 5: 380 }; // heartbeat period by hunter distance

const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
const userOf = (view, id) => view.players.find((p) => p.id === id)?.username || 'someone';
const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/* --------------------------------- GPS feed -------------------------------- */

// Real GPS via watchPosition, or a D-pad-driven simulated position for indoor testing.
// Every fix that moved (or every few seconds) goes to the host as a `pos` intent.
function useGeoFeed(zone, intent) {
  const [fix, setFix] = useState(null); // { lat, lng, acc, at }
  const [error, setError] = useState(null); // denied | unavailable
  const [simHeading, setSimHeading] = useState(null);
  const fixRef = useRef(null);
  const sent = useRef(null);

  const send = useCallback(
    (p, force) => {
      const last = sent.current;
      if (!force && last && haversine(last, p) < SEND_MIN_M && Date.now() - last.t < SEND_MIN_MS) return;
      sent.current = { lat: p.lat, lng: p.lng, t: Date.now() };
      intent({ type: 'pos', lat: p.lat, lng: p.lng, acc: p.acc });
    },
    [intent]
  );

  const accept = useCallback(
    (p, force) => {
      fixRef.current = p;
      setFix(p);
      send(p, force);
    },
    [send]
  );

  useEffect(() => {
    if (zone.sim) return undefined;
    if (!navigator.geolocation) {
      setError('unavailable');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        accept({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0), at: Date.now() });
      },
      (err) => setError(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [zone.sim, accept]);

  // Simulated GPS starts somewhere near the middle of the zone.
  useEffect(() => {
    if (!zone.sim) return;
    const p = destination(zone.center, zone.radius * 0.35 * Math.random(), Math.random() * 360);
    accept({ lat: p.lat, lng: p.lng, acc: 3, at: Date.now() }, true);
  }, [zone.sim, zone.center.lat, zone.center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep-alive so the host's picture survives a dropped message.
  useEffect(() => {
    const id = setInterval(() => fixRef.current && send(fixRef.current, true), SEND_MIN_MS);
    return () => clearInterval(id);
  }, [send]);

  const step = useCallback(
    (brg) => {
      const f = fixRef.current;
      if (!f) return;
      const p = destination(f, SIM_STEP, brg);
      setSimHeading(brg);
      accept({ lat: p.lat, lng: p.lng, acc: 3, at: Date.now() }, true);
    },
    [accept]
  );

  return { fix, error, step, simHeading };
}

/* --------------------------------- widgets -------------------------------- */

// Arrow back to the zone inside a compass rose; the rose turns with the phone when a compass exists.
function Compass({ target, heading, size = 132 }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 border-current transition-transform duration-300" style={{ transform: `rotate(${-(heading || 0)}deg)` }}>
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] font-bold">N</div>
        <div className="absolute inset-0 grid place-items-center transition-transform duration-300" style={{ transform: `rotate(${target}deg)` }}>
          <ArrowUp size={size * 0.5} strokeWidth={2.6} />
        </div>
      </div>
    </div>
  );
}

// Scrolling ECG line, faster as the hunter closes in.
function Ecg({ period }) {
  const beat = 'H18 L21 9 L24 12 H27 L29 2 L32 22 L35 12 H39 L43 8 L47 12 H50';
  const d = `M0 12 ${[0, 50, 100, 150].map((o) => beat.replace(/([HL])(\d+)/g, (_, c, x) => `${c}${Number(x) + o}`)).join(' ')}`;
  return (
    <div className="h-6 overflow-hidden">
      <svg viewBox="0 0 200 24" preserveAspectRatio="none" className="h-6 w-[200%]" style={{ animation: `ecg ${period * 2}ms linear infinite` }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Drain({ ms, id, dark = false }) {
  return (
    <div className={`mt-2 h-1 overflow-hidden rounded-full ${dark ? 'bg-black/15' : 'bg-white/20'}`}>
      <div key={id} className={`drain h-full ${dark ? 'bg-black' : 'bg-white'}`} style={{ animation: `drain ${ms}ms linear both` }} />
    </div>
  );
}

// On-screen D-pad for simulated GPS; stays above the out-of-bounds overlay so you can walk back.
function SimPad({ onStep, z = 86 }) {
  const btn = 'pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur active:bg-white active:text-black';
  return (
    <div className="fixed right-2 top-1/2 -translate-y-1/2" style={{ zIndex: z }} data-sim-pad>
      <div className="grid grid-cols-3 gap-1">
        <span />
        <button type="button" className={btn} aria-label="Move north" onClick={() => onStep(0)}>
          <ChevronUp size={18} />
        </button>
        <span />
        <button type="button" className={btn} aria-label="Move west" onClick={() => onStep(270)}>
          <ChevronLeft size={18} />
        </button>
        <div className="grid place-items-center text-[9px] font-bold text-white/70">SIM</div>
        <button type="button" className={btn} aria-label="Move east" onClick={() => onStep(90)}>
          <ChevronRight size={18} />
        </button>
        <span />
        <button type="button" className={btn} aria-label="Move south" onClick={() => onStep(180)}>
          <ChevronDown size={18} />
        </button>
        <span />
      </div>
      <div className="mt-1 text-center text-[9.5px] font-medium text-white/60">{SIM_STEP} m / tap</div>
    </div>
  );
}

/* ---------------------------------- layer ---------------------------------- */

export default function ZoneLayer({ view, serverNow, intent, onStrobe, onRows, children }) {
  useNow(250);
  const [, force] = useState(0);
  const r = view.round;
  const zone = r.zone;
  const me = view.me;
  const now = serverNow();
  const intel = view.intel || {};
  const { fix, error, step, simHeading } = useGeoFeed(zone, intent);
  const heading = zone.sim ? simHeading : currentHeading();
  const radius = zoneRadius(zone, now);
  const dist = fix ? haversine(zone.center, fix) : null;
  const toEdge = dist == null ? null : radius - dist; // > 0 inside
  const hunter = isHunter(r, me);
  const hiding = remainingHiders(r).includes(me);
  const outDeadline = r.zoneOuts?.[me];
  const revealed = !!r.zoneRevealed?.[me];
  const scan = intel.scan && now < intel.scan.until ? intel.scan : null;
  const drop = r.drop && !r.drop.claimedBy ? r.drop : null;
  const [mapOpen, setMapOpen] = useState(false);
  const [banners, setBanners] = useState([]);
  const [lostSignal, setLostSignal] = useState(false);

  useEffect(() => {
    preloadMap();
  }, []);

  // Report where the HUD ends so the game's own banners and camera controls sit below it.
  const rowsRef = useRef(null);
  const [rowsBottom, setRowsBottom] = useState(0);
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return undefined;
    const report = () => {
      if (!el.isConnected || !el.offsetParent) return;
      const bottom = Math.ceil(el.getBoundingClientRect().bottom - el.offsetParent.getBoundingClientRect().top);
      setRowsBottom(bottom);
      onRows?.(bottom);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onRows]);

  const pushBanner = useCallback((b) => {
    const id = Math.random().toString(36).slice(2);
    setBanners((list) => [...list.slice(-2), { ...b, id }]);
    setTimeout(() => setBanners((list) => list.filter((x) => x.id !== id)), b.ms || 4500);
  }, []);

  /* ---- hunters: a radar ping (or a decoy signal) opens the map for exactly 3.0 s ---- */
  const scanSeen = useRef(intel.scan?.id);
  useEffect(() => {
    const sc = intel.scan;
    if (!sc || sc.id === scanSeen.current) return undefined;
    scanSeen.current = sc.id;
    setMapOpen(true);
    setLostSignal(false);
    Synth.blip();
    buzz([60, 40, 60]);
    const left = Math.max(0, sc.until - serverNow());
    const t1 = setTimeout(() => {
      force((n) => n + 1); // hide the pins on the dot
      setLostSignal(true);
    }, left);
    const t2 = setTimeout(() => setLostSignal(false), left + 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [intel.scan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- hiders: radar alert ---- */
  const lastRadar = r.radar?.[r.radar.length - 1];
  const radarSeen = useRef(lastRadar?.id);
  useEffect(() => {
    if (!lastRadar || lastRadar.id === radarSeen.current) return;
    radarSeen.current = lastRadar.id;
    if (!hiding) return;
    buzz([200, 100, 200, 100, 200]);
    if (intel.ghostUsed === lastRadar.id) {
      pushBanner({ kind: 'ghost', Icon: Ghost, text: 'GHOST IMMUNITY ABSORBED THE RADAR — YOU STAYED INVISIBLE', ms: 6000 });
    } else {
      pushBanner({
        kind: 'radar',
        Icon: TriangleAlert,
        text: `HUNTER USED RADAR (${XP.radarPing} XP)! YOUR ZONE WAS EXPOSED FOR 3 SECONDS — MOVE OR STAY HIDDEN!`,
        ms: 6500,
        drain: Math.max(0, lastRadar.until - serverNow()),
      });
    }
  }, [lastRadar?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- supply drop ---- */
  const dropSeen = useRef(r.drop?.at);
  useEffect(() => {
    if (!r.drop || r.drop.at === dropSeen.current) return;
    dropSeen.current = r.drop.at;
    buzz([60, 40, 60]);
    if (!hiding) Synth.blip(); // hiders stay silent
    pushBanner({ kind: 'drop', Icon: Zap, text: `SUPPLY DROP LANDED — FIRST HIDER WITHIN ${DROP_RADIUS} m GETS +${XP.supplyDrop} XP & GHOST IMMUNITY`, ms: 6500 });
  }, [r.drop?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const claimSeen = useRef(r.drop?.claimedBy);
  useEffect(() => {
    const by = r.drop?.claimedBy;
    if (!by || by === claimSeen.current) return;
    claimSeen.current = by;
    if (by === me) {
      buzz([80, 40, 80, 40, 240]);
      pushBanner({ kind: 'drop', Icon: Ghost, text: `SUPPLY DROP SECURED · +${XP.supplyDrop} XP · GHOST IMMUNITY — INVISIBLE TO THE NEXT RADAR PING`, ms: 6500 });
    } else pushBanner({ kind: 'drop', Icon: Zap, text: `@${userOf(view, by)} GRABBED THE SUPPLY DROP`, ms: 4500 });
  }, [r.drop?.claimedBy]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- closing ring ---- */
  const ringStep = shrinkStep(zone, now);
  const stepSeen = useRef(ringStep);
  useEffect(() => {
    if (ringStep === stepSeen.current) return;
    stepSeen.current = ringStep;
    if (!ringStep) return;
    buzz([120, 60, 120]);
    pushBanner({ kind: 'ring', Icon: Crosshair, text: `RING CLOSING — ZONE NOW ${Math.round(radius)} m`, ms: 4500 });
  }, [ringStep]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- other players exposed ---- */
  const outIds = Object.keys(r.zoneRevealed || {})
    .filter((id) => id !== me)
    .sort()
    .join(',');
  const outSeen = useRef(outIds);
  useEffect(() => {
    const before = new Set(outSeen.current.split(',').filter(Boolean));
    outSeen.current = outIds;
    outIds
      .split(',')
      .filter((id) => id && !before.has(id))
      .forEach((id) => {
        const tracked = (intel.reveals || []).some((p) => p.id === id);
        pushBanner({
          kind: 'reveal',
          Icon: Satellite,
          text: tracked ? `@${userOf(view, id)} LEFT THE PLAYZONE — LIVE POSITION ON YOUR MAP` : `@${userOf(view, id)} LEFT THE PLAYZONE — POSITION EXPOSED`,
          ms: 5000,
        });
      });
  }, [outIds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- out of bounds: countdown beeps, then siren + strobe while revealed ---- */
  const secsLeft = outDeadline ? Math.max(0, Math.ceil((outDeadline - now) / 1000)) : null;
  const lastSec = useRef(null);
  useEffect(() => {
    if (secsLeft != null && secsLeft !== lastSec.current) {
      Synth.beep(secsLeft <= 3);
      buzz(secsLeft <= 3 ? 140 : 60);
    }
    lastSec.current = secsLeft;
  }, [secsLeft]);

  useEffect(() => {
    if (!revealed) return undefined;
    onStrobe(true);
    const siren = () => {
      Synth.penalty();
      buzz([400, 100, 400]);
    };
    siren();
    const id = setInterval(siren, 1000);
    return () => {
      clearInterval(id);
      onStrobe(false);
    };
  }, [revealed, onStrobe]);

  /* ---- hider heartbeat: vibrate on every beat ---- */
  const hb = hiding ? intel.hb : null;
  useEffect(() => {
    if (!hb) return undefined;
    const id = setInterval(() => buzz(hb === 5 ? [40, 60, 40] : 35), BEAT_MS[hb]);
    return () => clearInterval(id);
  }, [hb]);

  /* --------------------------------- render -------------------------------- */
  const radarLeft = RADAR_USES - (r.radarUses?.[me] || 0);
  const armsAt = r.data.hideUntil || 0;
  const radarArming = now < armsAt;
  const nextShrink = nextShrinkAt(zone, now);
  const dropDist = drop && fix ? haversine(fix, drop) : null;
  const backBearing = fix ? bearing(fix, zone.center) : 0;
  const backDist = dist == null ? null : Math.max(0, dist - radius);

  const pins = [];
  if (drop) pins.push({ key: 'drop', kind: 'drop', lat: drop.lat, lng: drop.lng });
  (intel.reveals || []).forEach((p) => pins.push({ key: `rv-${p.id}`, kind: 'reveal', lat: p.lat, lng: p.lng, label: initials(nameOf(view, p.id)) }));
  if (scan) scan.blips.forEach((b, i) => pins.push({ key: `b${i}`, kind: 'blip', lat: b.lat, lng: b.lng, label: initials(nameOf(view, b.id)) }));
  const rings = [];
  if (radius < zone.radius - 0.5) rings.push({ r: zone.radius, faint: true });
  if (nextShrink && nextShrink - now <= 45000) rings.push({ r: zoneRadius(zone, nextShrink + 1), dashed: true });

  const chip = 'rounded-full border border-white/15 bg-black/60 backdrop-blur';
  const status = error
    ? error === 'denied'
      ? 'LOCATION BLOCKED — allow GPS for this site'
      : 'NO GPS SIGNAL'
    : !fix
      ? 'Waiting for GPS…'
      : toEdge >= 0
        ? `ZONE ${Math.round(radius)} m · ${formatDistance(toEdge)} to edge`
        : `ZONE ${Math.round(radius)} m · ${formatDistance(-toEdge)} OUTSIDE`;
  const sub = zone.shrink
    ? nextShrink
      ? `Ring closes in ${formatTime(nextShrink - now)}`
      : 'Ring fully closed'
    : zone.sim
      ? 'Simulated GPS'
      : fix
        ? `GPS ±${fix.acc} m`
        : 'Playzone';

  return (
    <>
      {/* Shade behind the HUD so the camera's REC stamp doesn't bleed between rows. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[15] bg-gradient-to-b from-black/80 via-black/50 to-transparent" style={{ height: rowsBottom + 14 }} />
      <div ref={rowsRef} className="pointer-events-none absolute inset-x-4 top-[max(64px,calc(env(safe-area-inset-top)+52px))] z-[25] space-y-2 text-white">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open tactical map"
              onClick={() => setMapOpen(true)}
              className={`pointer-events-auto grid h-10 w-10 shrink-0 place-items-center ${chip}`}
            >
              <MapIcon size={17} />
            </button>
            <div className={`min-w-0 flex-1 px-3.5 py-1.5 ${chip}`} data-zone-status={toEdge == null ? 'pending' : toEdge >= 0 ? 'in' : 'out'}>
              <div className="truncate text-[12px] font-semibold leading-tight">{status}</div>
              <div className="truncate text-[10.5px] leading-tight text-white/60">{sub}</div>
            </div>
          </div>

          {drop && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="pointer-events-auto flex w-full items-center gap-2 rounded-full border border-white bg-black/70 px-3.5 py-2 text-[12px] font-bold backdrop-blur"
              data-drop={dropDist == null ? '' : Math.round(dropDist)}
            >
              <Zap size={14} /> SUPPLY DROP
              <span className="ml-auto font-semibold text-white/80">{dropDist == null ? 'on your map' : `${formatDistance(dropDist)} ${cardinal(bearing(fix, drop))}`}</span>
            </button>
          )}

          {r.hunt && hunter && (
            <button
              type="button"
              disabled={radarLeft <= 0 || radarArming || !!scan}
              onClick={() => {
                Synth.unlock();
                intent({ type: 'uavRadar' });
              }}
              className="pointer-events-auto flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white bg-white text-[12.5px] font-bold tracking-wide text-black transition-colors disabled:border-white/15 disabled:bg-black/60 disabled:text-white/50"
              data-radar-left={radarLeft}
            >
              <Radar size={16} />
              {radarLeft <= 0
                ? `RADAR LOCKED (0/${RADAR_USES})`
                : radarArming
                  ? `RADAR ARMS IN ${formatTime(armsAt - now)}`
                  : `RADAR PING (${radarLeft}/${RADAR_USES} LEFT • ${XP.radarPing} XP)`}
            </button>
          )}

          {hiding && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={intel.decoy !== 'ready'}
                onClick={() => {
                  buzz(30);
                  intent({ type: 'decoy' });
                }}
                className="pointer-events-auto flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/60 bg-black/60 px-3 text-[11.5px] font-bold tracking-wide backdrop-blur disabled:border-white/15 disabled:text-white/50"
                data-decoy={intel.decoy}
              >
                <Crosshair size={14} className="shrink-0" />
                <span className="truncate">{intel.decoy === 'ready' ? 'DECOY PING (1 LEFT)' : intel.decoy === 'armed' ? 'DECOY ARMED · NEXT RADAR' : 'DECOY USED'}</span>
              </button>
              {intel.ghost && (
                <div className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11.5px] font-bold text-black" data-ghost>
                  <Ghost size={14} /> GHOST
                </div>
              )}
            </div>
          )}

          {hb && (
            <div className="pop flex items-center gap-3 rounded-[16px] bg-white px-3.5 py-2 text-black" data-heartbeat={hb}>
              <HeartPulse size={20} className="shrink-0" style={{ animation: `beat ${BEAT_MS[hb]}ms ease-in-out infinite` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-bold tracking-wide">HUNTER WITHIN {hb} m</div>
                <Ecg period={BEAT_MS[hb]} />
              </div>
            </div>
          )}
        </div>

        {children}

        {banners.map((b) => (
          <div
            key={b.id}
            className={`pop rounded-[14px] px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug ${b.kind === 'radar' ? 'bg-white text-black' : 'border border-white/20 bg-black/80 text-white backdrop-blur'}`}
            data-banner={b.kind}
          >
            <div className="flex items-start gap-2.5">
              <b.Icon size={16} className="mt-px shrink-0" />
              <span>{b.text}</span>
            </div>
            {b.drain > 0 && <Drain ms={b.drain} id={b.id} dark={b.kind === 'radar'} />}
          </div>
        ))}
      </div>

      {zone.sim && !mapOpen && <SimPad onStep={step} />}

      {/* Tactical map */}
      {mapOpen && (
        <div className={`fade fixed inset-0 flex flex-col bg-black text-white ${outDeadline || revealed ? 'z-[90]' : 'z-[70]'}`} data-tactical-map>
          <div className="flex items-center gap-3 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold tracking-wide">TACTICAL MAP</div>
              <div className="truncate text-[12px] text-white/60">{status}</div>
            </div>
            <button type="button" aria-label="Close map" onClick={() => setMapOpen(false)} className={`grid h-10 w-10 place-items-center ${chip}`}>
              <X size={17} />
            </button>
          </div>
          {scan && (
            <div className="mx-4 mb-2 rounded-[14px] bg-white px-3.5 py-2.5 text-black" data-scan={scan.blips.length}>
              <div className="flex items-center gap-2 text-[12.5px] font-bold tracking-wide">
                <Radar size={15} /> {scan.kind === 'signal' ? 'SIGNAL INTERCEPTED' : `RADAR SWEEP · ${scan.blips.length} SIGNAL${scan.blips.length === 1 ? '' : 'S'}`}
              </div>
              <Drain ms={Math.max(0, scan.until - now)} id={scan.id} dark />
            </div>
          )}
          {!scan && lostSignal && <div className="mx-4 mb-2 rounded-[14px] border border-white/20 px-3.5 py-2.5 text-[12.5px] font-semibold">SIGNAL LOST — PINS HIDDEN</div>}
          <div className="relative min-h-0 flex-1">
            <LazyMap center={zone.center} radius={radius} fitRadius={zone.radius} rings={rings} me={fix && { lat: fix.lat, lng: fix.lng, heading }} pins={pins} />
            {zone.sim && <SimPad onStep={step} z={1000} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-[calc(14px+var(--safe-bottom))] pt-3 text-[11.5px] text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-black bg-white shadow-[0_0_0_1.5px_#fff]" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={12} /> Supply drop
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-white" /> Out of zone (live)
            </span>
            {hunter && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-white" /> Radar blip
              </span>
            )}
          </div>
        </div>
      )}

      {/* Out of bounds */}
      {(outDeadline || revealed) && (
        <div
          className="fixed inset-0 z-[85] grid place-items-center px-6 text-center"
          style={revealed ? { animation: 'strobe .5s steps(1) infinite' } : { background: 'rgba(0,0,0,.92)', animation: 'oob 1s ease-in-out infinite' }}
          role="alertdialog"
          aria-label="Out of playzone"
          data-zone-oob={revealed ? 'revealed' : 'countdown'}
        >
          <div className="w-full max-w-sm rounded-[28px] border-2 border-white bg-black px-6 py-7 text-white">
            <TriangleAlert size={30} className="mx-auto" />
            <div className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.02em]">OUT OF PLAYZONE! RETURN IN 10s OR POSITION REVEALED!</div>
            {revealed ? (
              <div className="mt-4 rounded-[16px] bg-white px-4 py-3 text-black">
                <div className="text-[18px] font-bold">POSITION REVEALED · {XP.zoneOut} XP</div>
                <div className="mt-1 text-[13px] leading-snug">Your live GPS pin is on the {r.hunt ? 'hunter’s' : 'squad’s'} map until you’re back inside.</div>
              </div>
            ) : (
              <div className="tnum mt-2 text-[96px] font-bold leading-none" data-countdown={secsLeft}>
                {secsLeft}
              </div>
            )}
            <div className="mt-5">
              <Compass target={backBearing} heading={heading} />
            </div>
            <div className="mt-4 text-[17px] font-bold">{backDist == null ? 'Finding you…' : `${formatDistance(backDist)} back to the zone`}</div>
            <div className="mt-1 text-[13px] text-white/60">
              Head {cardinal(backBearing)}
              {heading == null ? ' · arrow points from north (no compass)' : ''}
            </div>
            <button type="button" className="mt-5 h-11 w-full rounded-full border border-white/30 text-[14px] font-semibold" onClick={() => setMapOpen(true)}>
              Open map
            </button>
          </div>
        </div>
      )}
    </>
  );
}
