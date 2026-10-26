import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, Skull, Volume2 } from 'lucide-react-native';
import { XP } from '../../core';
import { cameraPointingDown, subscribeMotion } from '../../lib/motion';
import { buzz, haptic, speak, Synth } from '../../lib/sound';
import { Button, T } from '../primitives';
import { useNow } from '../helpers';
import Camera from './Camera';
import { BlindCountdown, BottomBar, GameShell, PickPlayer, Pop, TopCard, confirm, nameOf, useScheduled } from './shared';

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
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, [n?.count, n?.at, serverNow]); // eslint-disable-line react-hooks/exhaustive-deps
  return show;
}

function Banner({ children, strong = false, testID }) {
  return (
    <TopCard testID={testID}>
      <View
        style={[
          { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
          strong ? { backgroundColor: '#fff' } : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.65)' },
        ]}
      >
        {children}
      </View>
    </TopCard>
  );
}

const Small = ({ children, dark }) => (
  <T size={13} w={500} color={dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'} center>
    {children}
  </T>
);
const Big = ({ children, dark, size = 20 }) => (
  <T size={size} w={700} lh={1.15} color={dark ? '#000' : '#fff'} center tnum>
    {children}
  </T>
);

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
            <Small dark>Noise snitch</Small>
            <Big dark>A hider just made noise — listen!</Big>
          </Banner>
        )}
        <BottomBar>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                icon={Volume2}
                title={cooling > 0 ? `${Math.ceil(cooling / 1000)}s` : `Ping · ${d.radarLeft}`}
                disabled={d.radarLeft <= 0 || cooling > 0}
                bg="rgba(0,0,0,0.6)"
                color="#fff"
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                onPress={() => {
                  buzz(40);
                  intent({ type: 'radar' });
                }}
                testID="radar"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Found someone" bg="#fff" color="#000" onPress={() => setPicking(true)} testID="found" />
            </View>
          </View>
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

  // A quick turn of the phone counts as a peek.
  useEffect(() => subscribeMotion((m, { rot }) => rot > 25 && panned()), []); // eslint-disable-line react-hooks/exhaustive-deps

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
    haptic.sonar();
  });

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={found ? 'Found · keep filming' : 'Hider · keep filming'} onLeave={onLeave}>
      <Camera hud={hud} record enforce violation={peekFail} onResume={() => setPeekFail(null)} onPan={panned} noiseMeter={seeking && !found} onNoise={() => intent({ type: 'noise' })}>
        {!seeking && (
          <Banner>
            <Small>Hide now</Small>
            <Big size={22}>Seeker looks in {Math.ceil((d.hideUntil - now) / 1000)}s</Big>
          </Banner>
        )}
        {inWindow && !passed.current.has(k) && (
          <Banner strong testID="peek-check">
            <Small dark>Peek check</Small>
            <Big dark>Pan your camera out of your spot</Big>
            <T size={13} tnum color="rgba(0,0,0,0.6)" style={{ marginTop: 2 }}>
              {Math.ceil((windowStart + PEEK_WINDOW - now) / 1000)}s
            </T>
          </Banner>
        )}
        {inWindow && passed.current.has(k) && (
          <Banner>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check size={18} color="#fff" />
              <T size={16} w={600} color="#fff">
                Peek check passed
              </T>
            </View>
          </Banner>
        )}
        {found && (
          <Banner>
            <T size={18} w={600} color="#fff" center>
              Found — keep filming the hunt
            </T>
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
            <Small>Hide now</Small>
            <Big size={22}>Hunters look in {Math.ceil((d.hideUntil - now) / 1000)}s</Big>
          </Banner>
        )}
        {inSpot && seeking && !noise && (
          <Banner>
            <T size={16} w={600} color="#fff" center>
              Stay silent. The noise snitch is listening.
            </T>
          </Banner>
        )}
        {noise && !inSpot && (
          <Banner strong>
            <Small dark>Noise snitch</Small>
            <Big dark>Noise from the hiding spot!</Big>
          </Banner>
        )}
        {role === 'hunter' && !packed && (
          <BottomBar>
            <Button title="I found them — squeeze in" bg="#fff" color="#000" testID="packed" onPress={() => confirm('Found the sardine?', 'Squeeze in silently.', () => intent({ type: 'packed' }), 'Squeeze in')} />
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

  // At zero: judge (camera pointing down, or the tap fallback), then send a proof photo.
  useScheduled(
    lava?.n,
    lava?.at,
    serverNow,
    async () => {
      const pointing = cameraPointingDown();
      const safe = pointing === null ? armedRef.current : pointing;
      const n = lava.n;
      setResult(safe);
      if (safe) Synth.success();
      else {
        Synth.boom();
        buzz([300, 80, 300]);
      }
      setTimeout(() => setResult(null), 3000);
      const img = await Promise.race([cam.current?.snapshot() ?? null, new Promise((res) => setTimeout(() => res(null), 3500))]);
      intent(img ? { type: 'lavaCheck', n, safe, img, mediaId: `lava${n}-${me.slice(0, 8)}` } : { type: 'lavaCheck', n, safe });
    },
    0
  );

  const myChecks = Object.values(d.checks).map((c) => c[me]);
  const safeCount = myChecks.filter((v) => v === true).length;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Lava calls ${lava?.n || 0}/${d.total} · safe ${safeCount}`} onLeave={onLeave}>
      <Camera ref={cam} hud={hud} record enforce flash={counting}>
        {counting && (
          <TopCard testID="lava-countdown">
            <View style={{ borderRadius: 22, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' }}>
              <T size={13} w={600} upper ls={1.8} color="#000">
                The floor is lava in
              </T>
              <T size={86} w={700} ls={-4} tnum color="#000" style={{ lineHeight: 92 }}>
                {secs}
              </T>
              <T size={14} w={500} color="#000" style={{ marginTop: 4 }}>
                Both feet up · camera pointing down
              </T>
              {down !== null && (
                <T size={13} w={600} color="#000" style={{ marginTop: 8 }}>
                  {down ? 'Camera down ✓' : 'Point your camera at your feet'}
                </T>
              )}
            </View>
          </TopCard>
        )}
        {result !== null && (
          <Pop style={{ position: 'absolute', left: 24, right: 24, top: '40%', zIndex: 10, borderRadius: 22, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' }}>
            <T size={34} w={700} ls={-1} color="#000">
              {result ? 'SAFE' : 'BURNED'}
            </T>
            <T size={13} color="rgba(0,0,0,0.6)">
              {result ? `+${XP.lavaSafe} XP · proof photo sent` : `${XP.lavaBurn} XP`}
            </T>
          </Pop>
        )}
        {counting && down === null && (
          <BottomBar>
            <Button
              title={armed ? 'Feet up — locked in' : 'Tap when your feet are up'}
              bg={armed ? '#fff' : 'rgba(0,0,0,0.6)'}
              color={armed ? '#000' : '#fff'}
              style={armed ? null : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              onPress={() => setArmed((v) => !v)}
            />
          </BottomBar>
        )}
      </Camera>
    </GameShell>
  );
}

/* ------------------------------- Zombie Tag ------------------------------- */

function ZombieFrame() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 1000);
    return () => clearInterval(id);
  }, []);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 6, borderWidth: 10, borderColor: '#fff', opacity: on ? 1 : 0.2 }]} />;
}

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
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [d.last?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={zombie ? `Zombie · ${survivors.length} survivors left` : `Survivor · ${d.zombies.length} zombies`} onLeave={onLeave}>
      <Camera key={zombie ? 'z' : 's'} hud={hud} record enforce={!zombie} beacon={zombie} pulseButton={zombie}>
        {zombie && <ZombieFrame />}
        {zombie && (
          <Banner strong>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Skull size={22} color="#000" />
              <T size={22} w={700} color="#000">
                ZOMBIE
              </T>
            </View>
            <T size={13} color="rgba(0,0,0,0.6)" center>
              Your flashlight is a beacon. Tag the survivors.
            </T>
          </Banner>
        )}
        {toast && (
          <Pop style={{ position: 'absolute', left: 24, right: 24, top: '42%', zIndex: 10, borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16 }}>
            <T size={17} w={700} color="#000" center>
              {toast}
            </T>
          </Pop>
        )}
        {!zombie && (
          <BottomBar>
            <Button title="I got tagged" bg="#fff" color="#000" testID="infected" onPress={() => confirm('Tagged by a zombie?', 'You turn into a zombie.', () => intent({ type: 'infected' }), 'Yes')} />
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
      <TouchableOpacity
        accessibilityLabel="Call Marco"
        testID="call-marco"
        disabled={!ready}
        activeOpacity={0.85}
        onPress={() => {
          buzz([80, 40, 80]);
          Synth.marco();
          speak('Marco!');
          intent({ type: 'marco' });
        }}
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: ready ? '#fff' : '#000' }]}
      >
        {ready ? (
          <>
            <T size={15} w={500} color="rgba(0,0,0,0.5)">
              Eyes closed · tap anywhere
            </T>
            <T size={86} w={700} ls={-4} color="#000" style={{ marginTop: 12 }}>
              MARCO!
            </T>
            <T size={15} color="rgba(0,0,0,0.6)" center style={{ marginTop: 24 }}>
              Every polo answers out loud and flashes
            </T>
          </>
        ) : (
          <>
            <T size={96} w={700} tnum color="#fff">
              {Math.ceil(cooldown / 1000)}
            </T>
            <T size={17} w={600} color="#fff" style={{ marginTop: 16 }}>
              Listen for the polos
            </T>
          </>
        )}
      </TouchableOpacity>
      <BottomBar>
        <Button title="I tagged someone" bg={ready ? '#000' : '#fff'} color={ready ? '#fff' : '#000'} onPress={() => setPicking(true)} testID="tag" />
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
            <Small dark>Marco called</Small>
            <Big dark size={34}>
              POLO!
            </Big>
          </Banner>
        )}
        {tagged && !polo && (
          <Banner>
            <T size={17} w={600} color="#fff" center>
              Tagged — keep filming Marco
            </T>
          </Banner>
        )}
      </Camera>
    </GameShell>
  );
}
