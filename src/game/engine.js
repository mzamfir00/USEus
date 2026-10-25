// Host-authoritative game engine (pure functions).
// The host phone owns the full state, including per-player secrets (paparazzi targets,
// the undercover saboteur, the bomb's fuse). Each phone receives only its own view.

import { MISSIONS } from './missions';
import { DEFAULT_PACK, DNA_STYLES, MAX_PLAYERS } from './constants';
import {
  ARENAS,
  COVERT_TASKS,
  DARES,
  DECOY_OFFSET,
  DEFAULT_RADIUS,
  DIRECTIONS,
  DROP_RADIUS,
  GAMES,
  gamesFor,
  HEARTBEAT_BANDS,
  HUNT,
  PRODUCTS,
  RADAR_MS,
  RADAR_USES,
  scriptFor,
  XP,
  ZONE_ARENAS,
  ZONE_RADII,
} from './games';
import { bearing, destination, haversine, randomInCircle, SHRINK_WINDOW, zoneRadius, zoneSide } from '../lib/geo';

export const WHEEL_MS = 3800; // random roulette spin
export const PICK_MS = 1400; // manual pick reveal
export const REVEAL_MS = 5000; // role card before the game clock starts
export const SONAR_COOLDOWN = 12000;
export const SONAR_WARNING = 3000;
export const SONAR_BEEP_MS = 2000;
export const FREEZE_GRACE = 700;
export const DARE_MS = 5000;
export const INJECT_COOLDOWN = 5000;
export const MAX_SHOTS = 3;
export const ZONE_GRACE = 10000; // seconds outside the playzone before your position is revealed

export const missionById = (id) => MISSIONS.find((m) => m.id === id) || null;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const rid = () => Math.random().toString(36).slice(2, 10);

export const fillText = (text, names, pack) =>
  text.replace(/\{(Player1|Player2|Player3|Pack)\}/g, (_, k) => (k === 'Pack' ? pack : names[k]));

/* ------------------------------- Room DNA -------------------------------- */

export const emptyDNA = () => ({ completed: 0, counts: { auteur: 0, dossier: 0, kinetic: 0 }, vibes: {}, last: null, history: [] });

export function dnaInfo(dna) {
  const d = dna || emptyDNA();
  const stage = Math.min(3, d.completed);
  let style = 'none';
  if (stage > 0) {
    const entries = Object.entries(d.counts);
    const max = Math.max(...entries.map(([, n]) => n));
    const top = entries.filter(([, n]) => n === max).map(([k]) => k);
    style = top.includes(d.last) ? d.last : top[0];
  }
  const share = stage > 0 ? Math.round((d.counts[style] / d.completed) * 100) : 0;
  return { stage, style, share, completed: d.completed, name: DNA_STYLES[style].name };
}

/* ------------------------------- Room state ------------------------------ */

const defaultZone = (arena, saved) => ({
  on: saved?.on ?? true,
  center: null, // locked fresh at the field every session
  radius: ZONE_RADII.some((o) => o.m === saved?.radius) ? saved.radius : DEFAULT_RADIUS[arena] || 150,
  shrink: !!saved?.shrink,
  sim: false,
});

const validPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
const round6 = (n) => Math.round(n * 1e6) / 1e6;

export function createRoom({ code, host, saved }) {
  const scores = saved?.scores || {};
  const arena = ARENAS[saved?.settings?.arena] ? saved.settings.arena : 'indoor';
  return {
    code,
    hostId: host.id,
    phase: 'lobby', // lobby | round | review | results
    settings: {
      arena,
      location: saved?.settings?.location || '',
      mode: saved?.settings?.mode || 'random',
      game: GAMES[saved?.settings?.game] ? saved.settings.game : 'blind_sonar',
      starter: null,
      zone: defaultZone(arena, saved?.settings?.zone),
    },
    packName: DEFAULT_PACK,
    players: [{ ...host, isHost: true, connected: true, xp: scores[host.username] || 0 }],
    round: null,
    secret: null,
    results: null,
    lastGames: [],
    dna: saved?.dna || emptyDNA(),
    scores,
    seq: 0,
  };
}

const connected = (s) => s.players.filter((p) => p.connected);
const nameOf = (s, id) => s.players.find((p) => p.id === id)?.name || 'Someone';

// Names injected into undercover challenges ({Player1..3}).
export const castNames = (view) => {
  const n = view.round?.data?.names;
  return n || { Player1: 'Someone', Player2: 'Someone', Player3: 'The whole squad' };
};

export const roundClock = (round, now) => ({
  started: now >= round.startsAt,
  remaining: Math.max(0, round.endsAt - now),
});

/* ------------------------------ GPS Playzone ----------------------------- */

// Hunters right now (zombie tag's horde grows, sardine hunters who squeezed in stop hunting).
export function isHunter(r, id) {
  if (!r?.hunt) return false;
  if (r.game === 'zombie_tag') return r.data.zombies.includes(id);
  if (r.game === 'sardines') return r.roles[id] === 'hunter' && !r.data.packed.includes(id);
  return r.roles[id] === HUNT[r.game].role;
}

// Hiders still in play (found hiders are out; squeezed-in sardines hide with the sardine).
export function remainingHiders(r) {
  if (!r?.hunt) return [];
  if (r.game === 'zombie_tag') return r.participants.filter((id) => !r.data.zombies.includes(id));
  if (r.game === 'sardines') return r.participants.filter((id) => r.roles[id] === 'sardine' || r.data.packed.includes(id));
  return r.participants.filter((id) => r.roles[id] === 'hider' && !r.data.found?.[id]);
}

const zoneOutside = (r, id) => !!(r.zoneOuts[id] || r.zoneRevealed[id]);

// Applies the boundary rule to one player's last known position. Returns true if it changed.
function checkSide(s, id, now) {
  const r = s.round;
  const pos = s.secret.host.pos[id];
  if (!pos) return false;
  const was = zoneOutside(r, id);
  const out = zoneSide(r.zone, pos, now, was) === 'out';
  if (out === was) return false;
  if (out) r.zoneOuts[id] = now + ZONE_GRACE;
  else {
    delete r.zoneOuts[id];
    delete r.zoneRevealed[id];
  }
  return true;
}

const bandFor = (d) => HEARTBEAT_BANDS.find((b) => d <= b) || null;

// Nearest-hunter proximity band for every hider (secret). Returns true if any band changed.
function updateHeartbeat(s) {
  const r = s.round;
  const h = s.secret.host;
  const hunters = r.participants.filter((id) => isHunter(r, id) && h.pos[id]);
  const next = {};
  remainingHiders(r).forEach((id) => {
    if (!h.pos[id]) return;
    const d = Math.min(Infinity, ...hunters.map((hid) => haversine(h.pos[id], h.pos[hid])));
    const band = bandFor(d);
    if (band) next[id] = band;
  });
  const changed = JSON.stringify(next) !== JSON.stringify(h.hb);
  h.hb = next;
  return changed;
}

function claimDrop(s, id, now) {
  const r = s.round;
  const h = s.secret.host;
  if (!r.drop || r.drop.claimedBy || !remainingHiders(r).includes(id) || haversine(h.pos[id], r.drop) > DROP_RADIUS) return false;
  r.drop.claimedBy = id;
  r.drop.claimedAt = now;
  r.xpAdj[id] = (r.xpAdj[id] || 0) + XP.supplyDrop;
  h.ghost[id] = true; // invisible to the next radar ping
  return true;
}

// A decoy blip 35 m from the hider on a random bearing, kept inside the zone so it
// can't give itself away (a real hider outside would already be revealed).
function fakeBlip(s, id, now) {
  const r = s.round;
  const from = s.secret.host.pos[id] || r.zone.center;
  const limit = zoneRadius(r.zone, now) - 3;
  let p = null;
  for (let i = 0; i < 24 && !p; i += 1) {
    const c = destination(from, DECOY_OFFSET, Math.random() * 360);
    if (haversine(r.zone.center, c) <= limit) p = c;
  }
  if (!p) p = destination(from, DECOY_OFFSET, bearing(from, r.zone.center));
  return { id, lat: round6(p.lat), lng: round6(p.lng) };
}

function addTrail(h, id, p) {
  const t = (h.trails[id] = h.trails[id] || []);
  const last = t[t.length - 1];
  if (last && haversine({ lat: last[0], lng: last[1] }, p) < 4 && p.at - last[2] < 15000) return;
  t.push([round6(p.lat), round6(p.lng), p.at]);
  if (t.length > 600) h.trails[id] = t.filter((_, i) => i % 2 === 0 || i === t.length - 1);
}

const thin = (pts, max) => (pts.length <= max ? pts : pts.filter((_, i) => i % Math.ceil(pts.length / max) === 0 || i === pts.length - 1));

// Host clock work for the zone: countdowns, the closing ring, radar expiry, the supply drop.
function zoneTick(s, now) {
  const r = s.round;
  const h = s.secret.host;
  let changed = false;
  r.participants.forEach((id) => {
    if (checkSide(s, id, now)) changed = true;
  });
  Object.entries(r.zoneOuts).forEach(([id, deadline]) => {
    if (now < deadline) return;
    delete r.zoneOuts[id];
    r.zoneRevealed[id] = now;
    r.xpAdj[id] = (r.xpAdj[id] || 0) + XP.zoneOut;
    const p = h.pos[id];
    h.outLog.push({ id, at: now, lat: p?.lat ?? null, lng: p?.lng ?? null });
    changed = true;
  });
  if (h.scan && now >= h.scan.until) {
    h.scan = null;
    changed = true;
  }
  if (r.hunt) {
    if (!r.drop && now >= r.dropAt) {
      const p = randomInCircle(r.zone.center, zoneRadius(r.zone, now) * 0.6);
      r.drop = { lat: round6(p.lat), lng: round6(p.lng), at: now, claimedBy: null };
      changed = true;
    }
    if (updateHeartbeat(s)) changed = true;
  }
  return changed;
}

/* ------------------------------- round setup ----------------------------- */

function chooseGame(s, count) {
  if (s.settings.mode === 'manual') {
    const g = GAMES[s.settings.game];
    return g && count >= g.min ? g : null;
  }
  const pool = gamesFor(s.settings.arena, count);
  if (!pool.length) return null;
  // Avoid repeating the last game when there is a choice.
  const fresh = pool.filter((g) => g.id !== s.lastGames[s.lastGames.length - 1]);
  return pick(fresh.length ? fresh : pool);
}

function startRound(s, now) {
  const ids = connected(s).map((p) => p.id);
  const game = chooseGame(s, ids.length);
  if (!game) return false;

  const pool = s.settings.mode === 'random' ? gamesFor(s.settings.arena, ids.length).map((g) => g.id) : [game.id];
  const lead = s.settings.mode === 'manual' && s.settings.starter && ids.includes(s.settings.starter) ? s.settings.starter : pick(ids);
  const order = [lead, ...shuffle(ids.filter((id) => id !== lead))];
  const startsAt = now + (s.settings.mode === 'random' ? WHEEL_MS : PICK_MS) + REVEAL_MS;
  const roles = {};
  const secret = { players: {}, host: {} };
  let data = {};
  let duration = game.duration;

  switch (game.id) {
    case 'blind_sonar':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'hunter' : 'survivor'));
      data = { pulses: 0, pulseAt: null, cooldownUntil: startsAt, nearMiss: {}, nearMissAt: {}, caught: null };
      break;
    case 'paparazzi': {
      const ring = shuffle(ids);
      ring.forEach((id, i) => {
        roles[id] = 'sniper';
        secret.players[id] = { target: ring[(i + 1) % ring.length] };
      });
      data = { shots: [], votes: {} };
      break;
    }
    case 'teleprompter': {
      order.forEach((id, i) => (roles[id] = i === 0 ? 'actor' : i === 1 ? 'director' : 'saboteur'));
      const product = pick(PRODUCTS[s.settings.arena] || PRODUCTS.indoor);
      data = { product, script: scriptFor(product, Math.random), injects: [], injectAt: {} };
      break;
    }
    case 'red_light':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'watcher' : 'runner'));
      data = { light: 'green', changedAt: startsAt, flips: 0, out: {}, winner: null };
      break;
    case 'hot_potato':
      ids.forEach((id) => (roles[id] = 'player'));
      data = { holder: lead, since: startsAt, passes: 0, dare: pick(DARES), exploded: null };
      secret.host.explodeAt = startsAt + 30000 + Math.floor(Math.random() * 40000);
      duration = 90;
      break;
    case 'undercover': {
      const category = ARENAS[s.settings.arena].missionCategory;
      const mission = pick(MISSIONS.filter((m) => m.category === category));
      const sab = pick(order.slice(1).length ? order.slice(1) : order);
      ids.forEach((id) => (roles[id] = 'crew'));
      secret.players[sab] = { saboteur: true, tasks: shuffle(COVERT_TASKS).slice(0, 3), done: [] };
      secret.host.saboteurId = sab;
      const cast = shuffle(ids);
      data = {
        missionId: mission.id,
        names: { Player1: nameOf(s, cast[0]), Player2: nameOf(s, cast[1]), Player3: cast[2] ? nameOf(s, cast[2]) : 'the whole squad' },
        votes: {},
      };
      duration = Math.min(mission.duration, 240);
      break;
    }
    case 'hide_seek':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'seeker' : 'hider'));
      data = { hideUntil: startsAt + game.hideMs, radarLeft: 3, radarAt: null, radarCount: 0, radarCooldown: 0, found: {}, noise: { count: 0, at: 0 } };
      break;
    case 'sardines':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'sardine' : 'hunter'));
      data = { hideUntil: startsAt + game.hideMs, packed: [], noise: { count: 0, at: 0 } };
      break;
    case 'floor_lava': {
      ids.forEach((id) => (roles[id] = 'player'));
      // Random lava calls, revealed one at a time by the host (6 s before each).
      const times = [];
      let t = startsAt + 15000 + Math.floor(Math.random() * 10000);
      while (t < startsAt + duration * 1000 - 12000 && times.length < 5) {
        times.push(t);
        t += 20000 + Math.floor(Math.random() * 15000);
      }
      secret.host.lavaTimes = times;
      data = { lava: null, checks: {}, proofs: [], total: times.length };
      break;
    }
    case 'zombie_tag':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'zombie' : 'survivor'));
      data = { zombies: [lead], infectedAt: { [lead]: startsAt }, last: null };
      break;
    case 'marco_polo':
      order.forEach((id, i) => (roles[id] = i === 0 ? 'marco' : 'polo'));
      data = { marcos: 0, marcoAt: null, cooldownUntil: startsAt, tagged: {} };
      break;
    default:
      return false;
  }

  const z = s.settings.zone;
  const zoned = ZONE_ARENAS.includes(s.settings.arena) && z?.on && validPoint(z.center);
  const endsAt = startsAt + duration * 1000;
  const playFrom = startsAt + (game.hideMs || 0);
  if (zoned) secret.host = { ...secret.host, pos: {}, trails: {}, hb: {}, decoys: {}, ghost: {}, ghostUsed: {}, scan: null, radarLog: [], outLog: [] };

  s.round = {
    n: (s.round?.n || 0) + 1,
    spinId: rid(),
    spunAt: now,
    mode: s.settings.mode,
    pool,
    game: game.id,
    arena: s.settings.arena,
    location: s.settings.location.trim(),
    startsAt,
    endsAt,
    participants: ids,
    roles,
    data,
    violations: {}, // live Snitch Protocol alarms: id -> { reason, at }
    strikes: {}, // violations per player this round
    noiseAt: {},
    ...(zoned && {
      zone: { center: z.center, radius: z.radius, shrink: z.shrink, sim: z.sim, shrinkStart: Math.max(playFrom, endsAt - SHRINK_WINDOW) },
      hunt: !!HUNT[game.id],
      zoneOuts: {}, // id -> server time the 10 s countdown hits zero
      zoneRevealed: {}, // id -> when their live position went public
      xpAdj: {}, // radar costs, out-of-bounds penalties, supply drop bonus
      radarUses: {},
      radar: [], // public radar alerts (no positions)
      drop: null,
      dropAt: playFrom + Math.round((endsAt - playFrom) / 2),
    }),
  };
  s.secret = secret;
  s.results = null;
  s.phase = 'round';
  s.lastGames = [...s.lastGames, game.id].slice(-3);
  return true;
}

/* -------------------------------- scoring -------------------------------- */

function finish(s, now, outcome) {
  const r = s.round;
  const d = r.data;
  const deltas = {};
  const winners = new Set();
  const add = (id, n) => {
    if (id && r.participants.includes(id)) deltas[id] = (deltas[id] || 0) + n;
  };
  const role = (id) => r.roles[id];
  const reveal = {};
  let headline = '';
  const secretWins = {};

  switch (r.game) {
    case 'blind_sonar': {
      const hunter = r.participants.find((id) => role(id) === 'hunter');
      const survivors = r.participants.filter((id) => id !== hunter);
      if (d.caught) {
        add(hunter, XP.sonarCatch);
        add(d.caught, XP.sonarCaught);
        survivors.filter((id) => id !== d.caught).forEach((id) => {
          add(id, XP.sonarSurviveCaughtRound);
          winners.add(id);
        });
        winners.add(hunter);
        headline = `${nameOf(s, hunter)} caught ${nameOf(s, d.caught)}`;
      } else {
        add(hunter, XP.sonarHunterTimeout);
        survivors.forEach((id) => {
          add(id, XP.sonarSurvive);
          winners.add(id);
        });
        headline = 'The survivors escaped the sonar';
      }
      Object.entries(d.nearMiss).forEach(([id, n]) => add(id, n * XP.nearMiss));
      break;
    }
    case 'paparazzi': {
      let valid = 0;
      reveal.shots = d.shots.map((shot) => {
        const votes = Object.values(d.votes[shot.id] || {});
        const yes = votes.filter(Boolean).length;
        const ok = yes > votes.length - yes;
        if (ok) {
          valid += 1;
          add(shot.by, XP.validShot);
          add(shot.target, XP.shotTarget);
          winners.add(shot.by);
        }
        return { ...shot, valid: ok, yes, no: votes.length - yes };
      });
      reveal.targets = Object.fromEntries(Object.entries(s.secret.players).map(([id, v]) => [id, v.target]));
      headline = valid ? `${valid} confirmed hit${valid === 1 ? '' : 's'}` : 'Nobody landed a clean shot';
      break;
    }
    case 'teleprompter': {
      r.participants.forEach((id) => {
        add(id, XP.telepromptCast);
        winners.add(id);
      });
      add(r.participants.find((id) => role(id) === 'actor'), XP.telepromptActor);
      d.injects.forEach((i) => add(i.by, XP.inject));
      headline = `Commercial wrapped with ${d.injects.length} live sabotage${d.injects.length === 1 ? '' : 's'}`;
      break;
    }
    case 'red_light': {
      const watcher = r.participants.find((id) => role(id) === 'watcher');
      const runners = r.participants.filter((id) => id !== watcher);
      const outCount = Object.keys(d.out).length;
      add(watcher, outCount * XP.watcherPerOut);
      if (d.winner) {
        add(d.winner, XP.runnerWin);
        winners.add(d.winner);
        runners.filter((id) => id !== d.winner && !d.out[id]).forEach((id) => {
          add(id, XP.runnerSurvive);
          winners.add(id);
        });
        headline = `${nameOf(s, d.winner)} tagged the watcher`;
      } else {
        add(watcher, XP.watcherWin);
        winners.add(watcher);
        headline = `${nameOf(s, watcher)} held the line`;
      }
      reveal.out = Object.keys(d.out);
      break;
    }
    case 'hot_potato': {
      const loser = d.exploded || d.holder;
      r.participants.forEach((id) => {
        if (id === loser) add(id, XP.bombLoser);
        else {
          add(id, XP.bombSurvive);
          winners.add(id);
        }
      });
      headline = `Boom. It blew up on ${nameOf(s, loser)}`;
      reveal.loser = loser;
      reveal.passes = d.passes;
      break;
    }
    case 'undercover': {
      const sab = s.secret.host.saboteurId;
      const tally = {};
      Object.values(d.votes).forEach((v) => {
        tally[v] = (tally[v] || 0) + 1;
      });
      const top = Math.max(0, ...Object.values(tally));
      const leaders = Object.keys(tally).filter((k) => tally[k] === top);
      const caught = top > 0 && leaders.length === 1 && leaders[0] === sab;
      const done = s.secret.players[sab]?.done.length || 0;
      if (caught) {
        r.participants.filter((id) => id !== sab).forEach((id) => {
          add(id, XP.crewCatch);
          winners.add(id);
        });
        add(sab, done * XP.sabCaughtTask);
        headline = `The squad caught ${nameOf(s, sab)}`;
      } else {
        add(sab, XP.sabEscape + done * XP.sabTask);
        r.participants.filter((id) => id !== sab).forEach((id) => add(id, XP.crewMissed));
        winners.add(sab);
        secretWins[sab] = 1;
        headline = `${nameOf(s, sab)} got away with it`;
      }
      reveal.saboteur = sab;
      reveal.tasks = s.secret.players[sab]?.tasks || [];
      reveal.done = s.secret.players[sab]?.done || [];
      reveal.tally = tally;
      break;
    }
    case 'hide_seek': {
      const seeker = r.participants.find((id) => role(id) === 'seeker');
      const hiders = r.participants.filter((id) => id !== seeker);
      const found = Object.keys(d.found);
      add(seeker, found.length * XP.seekFound);
      found.forEach((id) => add(id, XP.hideFound));
      if (hiders.length && found.length === hiders.length) {
        add(seeker, XP.seekAll);
        winners.add(seeker);
        headline = `${nameOf(s, seeker)} found everyone`;
      } else {
        const hidden = hiders.filter((id) => !d.found[id]);
        hidden.forEach((id) => {
          add(id, XP.hideSurvive);
          winners.add(id);
        });
        headline = `${hidden.length} hider${hidden.length === 1 ? ' was' : 's were'} never found`;
      }
      reveal.found = found;
      break;
    }
    case 'sardines': {
      const sardine = r.participants.find((id) => role(id) === 'sardine');
      const hunters = r.participants.filter((id) => id !== sardine);
      d.packed.forEach((id, i) => {
        add(id, Math.max(100, 300 - i * 100));
        winners.add(id);
      });
      const unpacked = hunters.filter((id) => !d.packed.includes(id));
      winners.add(sardine);
      if (outcome === 'last-hunter') {
        add(sardine, XP.sardineBase);
        unpacked.forEach((id) => add(id, XP.sardineLast));
        headline = `${nameOf(s, unpacked[0])} was the last one searching`;
      } else {
        add(sardine, unpacked.length ? XP.sardineHidden : XP.sardineBase);
        headline = unpacked.length ? `${unpacked.length} hunter${unpacked.length === 1 ? '' : 's'} never found the sardine` : 'Everyone squeezed in';
      }
      reveal.packed = d.packed;
      reveal.unpacked = unpacked;
      break;
    }
    case 'floor_lava': {
      const reached = d.lava && d.lava.at <= now ? d.lava.n : d.lava ? d.lava.n - 1 : 0;
      const tally = {};
      r.participants.forEach((id) => {
        let safe = 0;
        let burned = 0;
        for (let n = 1; n <= reached; n += 1) {
          if (d.checks[n]?.[id] === true) safe += 1;
          else burned += 1; // no proof in time = burned
        }
        tally[id] = { safe, burned };
        add(id, safe * XP.lavaSafe + burned * XP.lavaBurn);
      });
      const best = Math.max(0, ...Object.values(tally).map((t) => t.safe));
      const top = r.participants.filter((id) => best > 0 && tally[id].safe === best);
      top.forEach((id) => winners.add(id));
      headline = reached === 0 ? 'The lava never came' : top.length ? `${top.map((id) => nameOf(s, id).split(' ')[0]).join(' & ')} kept their feet up` : 'Everyone got burned';
      reveal.lava = tally;
      reveal.proofs = d.proofs;
      reveal.reached = reached;
      break;
    }
    case 'zombie_tag': {
      const zero = r.participants.find((id) => role(id) === 'zombie');
      const survivors = r.participants.filter((id) => !d.zombies.includes(id));
      if (!survivors.length) {
        d.zombies.forEach((id) => {
          add(id, XP.zombieWin);
          winners.add(id);
        });
        add(zero, XP.zeroWin);
        headline = 'The horde took everyone';
      } else {
        survivors.forEach((id) => {
          add(id, XP.survivorWin);
          winners.add(id);
        });
        headline = `${survivors.length} survivor${survivors.length === 1 ? '' : 's'} made it`;
      }
      d.zombies
        .filter((id) => id !== zero)
        .forEach((id) => add(id, Math.floor((d.infectedAt[id] - r.startsAt) / 30000) * XP.survivedPer30));
      reveal.zombies = d.zombies;
      break;
    }
    case 'marco_polo': {
      const marco = r.participants.find((id) => role(id) === 'marco');
      const polos = r.participants.filter((id) => id !== marco);
      const tagged = Object.keys(d.tagged);
      add(marco, tagged.length * XP.marcoTag);
      tagged.forEach((id) => add(id, XP.poloTagged));
      if (polos.length && tagged.length === polos.length) {
        add(marco, XP.marcoAll);
        winners.add(marco);
        headline = `${nameOf(s, marco)} tagged everyone`;
      } else {
        const free = polos.filter((id) => !d.tagged[id]);
        free.forEach((id) => {
          add(id, XP.poloSurvive);
          winners.add(id);
        });
        headline = `${free.length} polo${free.length === 1 ? '' : 's'} slipped away`;
      }
      reveal.tagged = tagged;
      break;
    }
    default:
      break;
  }

  // Snitch Protocol strikes cost XP whatever the game.
  Object.entries(r.strikes || {}).forEach(([id, n]) => add(id, n * XP.strike));
  reveal.strikes = r.strikes || {};

  // GPS Playzone: radar costs, out-of-bounds penalties and the supply drop, plus the post-match map.
  if (r.zone) {
    const h = s.secret.host;
    Object.entries(r.xpAdj).forEach(([id, n]) => add(id, n));
    reveal.zone = {
      center: r.zone.center,
      radius: r.zone.radius,
      finalRadius: Math.round(zoneRadius(r.zone, Math.min(now, r.endsAt))),
      shrink: r.zone.shrink,
      hunt: r.hunt,
      hunters: r.hunt ? r.participants.filter((id) => r.roles[id] === HUNT[r.game].role) : [],
      trails: Object.fromEntries(Object.entries(h.trails).map(([id, t]) => [id, thin(t, 120).map(([la, ln]) => [la, ln])])),
      radar: h.radarLog,
      drop: r.drop,
      outs: h.outLog,
      adj: r.xpAdj,
    };
  }

  const before = dnaInfo(s.dna);
  const style = ARENAS[r.arena].style;
  s.dna.completed += 1;
  s.dna.counts[style] += 1;
  s.dna.vibes[r.arena] = (s.dna.vibes[r.arena] || 0) + 1;
  s.dna.last = style;
  s.dna.history = [...s.dna.history, { game: r.game, arena: r.arena, at: now }].slice(-20);
  const after = dnaInfo(s.dna);

  const stats = {};
  r.participants.forEach((id) => {
    stats[id] = { xp: deltas[id] || 0, missions: winners.has(id) ? 1 : 0, secretWins: secretWins[id] || 0, rounds: 1, chickened: 0 };
  });
  s.players.forEach((p) => {
    if (deltas[p.id]) {
      p.xp += deltas[p.id];
      s.scores[p.username] = p.xp;
    }
  });

  s.results = {
    game: r.game,
    outcome,
    headline,
    winners: [...winners],
    deltas,
    stats,
    reveal,
    location: r.location,
    roundKey: `${s.code}:${r.n}:${r.spinId}`,
    evolved: before.stage !== after.stage || before.style !== after.style ? after : null,
    unlock: after.stage > 0 ? after.style : null,
  };
  s.phase = 'results';
}

// Ends active play: games with a vote go to review, the rest straight to results.
function endPlay(s, now, reason) {
  const g = s.round.game;
  if (g === 'paparazzi' || g === 'undercover') {
    s.phase = 'review';
    s.round.reviewSince = now;
    s.round.endReason = reason;
  } else finish(s, now, reason);
}

/* --------------------------------- reducer ------------------------------- */

export function reduce(prev, actorId, a, now = Date.now()) {
  const s = structuredClone(prev);
  const isHost = actorId === s.hostId;
  const find = (id) => s.players.find((p) => p.id === id);
  const r = s.round;
  const inPlay = s.phase === 'round' && r && now >= r.startsAt;
  const isPlayer = r?.participants.includes(actorId);
  const myRole = r?.roles[actorId];

  switch (a.type) {
    /* ---- roster ---- */
    case 'join': {
      const existing = find(a.player.id);
      if (existing) Object.assign(existing, a.player, { connected: true });
      else {
        if (s.players.length >= MAX_PLAYERS) return prev;
        s.players.push({ ...a.player, isHost: false, connected: true, xp: s.scores[a.player.username] || 0 });
      }
      break;
    }
    case 'disconnect': {
      const p = find(a.id);
      if (!p || !p.connected) return prev;
      p.connected = false;
      break;
    }
    case 'leave': {
      const p = find(a.id);
      if (!p || p.isHost) return prev;
      if (s.phase === 'lobby') s.players = s.players.filter((x) => x.id !== a.id);
      else p.connected = false;
      break;
    }
    case 'remove': {
      if (!isHost || a.id === s.hostId) return prev;
      s.players = s.players.filter((p) => p.id !== a.id);
      break;
    }

    /* ---- host setup ---- */
    case 'settings': {
      if (!isHost || s.phase !== 'lobby') return prev;
      const next = { ...s.settings };
      if (a.arena && ARENAS[a.arena]) next.arena = a.arena;
      if (typeof a.location === 'string') next.location = a.location.slice(0, 48);
      if (a.mode === 'random' || a.mode === 'manual') next.mode = a.mode;
      if (a.game && GAMES[a.game]) next.game = a.game;
      if ('starter' in a) next.starter = a.starter || null;
      if (a.arena && a.arena !== s.settings.arena && DEFAULT_RADIUS[a.arena]) next.zone = { ...next.zone, radius: DEFAULT_RADIUS[a.arena] };
      if (a.zone && typeof a.zone === 'object') {
        const z = { ...next.zone };
        ['on', 'shrink', 'sim'].forEach((k) => typeof a.zone[k] === 'boolean' && (z[k] = a.zone[k]));
        if (ZONE_RADII.some((o) => o.m === a.zone.radius)) z.radius = a.zone.radius;
        if (a.zone.center === null) z.center = null;
        else if (validPoint(a.zone.center)) z.center = { lat: round6(a.zone.center.lat), lng: round6(a.zone.center.lng) };
        next.zone = z;
      }
      s.settings = next;
      break;
    }
    case 'start': {
      if (!isHost || !(s.phase === 'lobby' || s.phase === 'results') || !startRound(s, now)) return prev;
      break;
    }
    case 'lobby': {
      if (!isHost) return prev;
      s.phase = 'lobby';
      s.secret = null;
      break;
    }

    /* ---- shared ---- */
    case 'tick': {
      if (!r || s.phase !== 'round') return prev;
      const zoneChanged = r.zone && now >= r.startsAt ? zoneTick(s, now) : false;
      const nextLava = r.game === 'floor_lava' ? s.secret.host.lavaTimes.find((t) => t > (r.data.lava?.at || 0)) : null;
      if (r.game === 'hot_potato' && (now >= s.secret.host.explodeAt || now >= r.endsAt)) {
        r.data.exploded = r.data.holder;
        finish(s, now, 'exploded');
      } else if (now >= r.endsAt) {
        endPlay(s, now, 'time');
      } else if (nextLava && now >= nextLava - 6000) {
        r.data.lava = { n: (r.data.lava?.n || 0) + 1, at: nextLava };
      } else if (!zoneChanged) return prev;
      break;
    }
    case 'end': {
      if (!r || s.phase !== 'round') return prev;
      const directorCanEnd = r.game === 'teleprompter' && myRole === 'director';
      if (!isHost && !directorCanEnd) return prev;
      endPlay(s, now, 'host');
      break;
    }
    case 'finishReview': {
      if (!isHost || s.phase !== 'review') return prev;
      finish(s, now, r.endReason || 'time');
      break;
    }

    /* ---- Blind Sonar ---- */
    case 'sonar': {
      if (!inPlay || r.game !== 'blind_sonar' || myRole !== 'hunter' || now < r.data.cooldownUntil) return prev;
      r.data.pulses += 1;
      r.data.pulseAt = now + SONAR_WARNING;
      r.data.cooldownUntil = now + SONAR_COOLDOWN;
      break;
    }
    case 'nearMiss': {
      if (!inPlay || r.game !== 'blind_sonar' || myRole !== 'survivor') return prev;
      const count = r.data.nearMiss[actorId] || 0;
      if (count >= 3 || now - (r.data.nearMissAt[actorId] || 0) < 8000) return prev;
      r.data.nearMiss[actorId] = count + 1;
      r.data.nearMissAt[actorId] = now;
      break;
    }
    case 'caught': {
      if (!inPlay || r.game !== 'blind_sonar' || myRole !== 'hunter' || r.roles[a.id] !== 'survivor') return prev;
      r.data.caught = a.id;
      finish(s, now, 'caught');
      break;
    }

    /* ---- Paparazzi ---- */
    case 'shot': {
      if (!inPlay || r.game !== 'paparazzi' || !isPlayer) return prev;
      const mine = r.data.shots.filter((x) => x.by === actorId).length;
      if (mine >= MAX_SHOTS || !a.id) return prev;
      r.data.shots.push({ id: a.id, by: actorId, target: s.secret.players[actorId].target, at: now });
      break;
    }
    case 'voteShot': {
      if (s.phase !== 'review' || r.game !== 'paparazzi' || !isPlayer) return prev;
      const shot = r.data.shots.find((x) => x.id === a.id);
      if (!shot || shot.by === actorId) return prev;
      r.data.votes[a.id] = { ...(r.data.votes[a.id] || {}), [actorId]: !!a.valid };
      break;
    }

    /* ---- Teleprompter ---- */
    case 'inject': {
      if (!inPlay || r.game !== 'teleprompter' || !isPlayer || myRole === 'actor') return prev;
      if (myRole === 'director' && r.participants.length > 2) return prev;
      if (now - (r.data.injectAt[actorId] || 0) < INJECT_COOLDOWN || !DIRECTIONS[a.i]) return prev;
      r.data.injects.push({ text: DIRECTIONS[a.i], by: actorId, at: now });
      r.data.injectAt[actorId] = now;
      break;
    }

    /* ---- Red Light ---- */
    case 'light': {
      if (!inPlay || r.game !== 'red_light' || myRole !== 'watcher' || now - r.data.changedAt < 1500) return prev;
      r.data.light = r.data.light === 'green' ? 'red' : 'green';
      r.data.changedAt = now;
      r.data.flips += 1;
      break;
    }
    case 'moved': {
      if (!inPlay || r.game !== 'red_light' || myRole !== 'runner' || r.data.out[actorId]) return prev;
      if (r.data.light !== 'red' || now - r.data.changedAt < FREEZE_GRACE) return prev;
      r.data.out[actorId] = now;
      const runners = r.participants.filter((id) => r.roles[id] === 'runner');
      if (runners.every((id) => r.data.out[id])) finish(s, now, 'all-out');
      break;
    }
    case 'tagged': {
      if (!inPlay || r.game !== 'red_light' || myRole !== 'runner' || r.data.out[actorId]) return prev;
      r.data.winner = actorId;
      finish(s, now, 'tagged');
      break;
    }

    /* ---- Hot Potato ---- */
    case 'pass': {
      if (!inPlay || r.game !== 'hot_potato' || r.data.holder !== actorId) return prev;
      if (now - r.data.since < DARE_MS || a.to === actorId || !r.participants.includes(a.to) || !find(a.to)?.connected) return prev;
      r.data.holder = a.to;
      r.data.since = now;
      r.data.passes += 1;
      r.data.dare = pick(DARES.filter((d) => d !== r.data.dare));
      break;
    }

    /* ---- Undercover ---- */
    case 'task': {
      const mine = s.secret?.players[actorId];
      if (!inPlay || r.game !== 'undercover' || !mine?.saboteur || !mine.tasks[a.i] || mine.done.includes(a.i)) return prev;
      mine.done.push(a.i);
      break;
    }
    case 'accuse': {
      if (s.phase !== 'review' || r.game !== 'undercover' || !isPlayer || !r.participants.includes(a.id) || a.id === actorId) return prev;
      r.data.votes[actorId] = a.id;
      if (r.participants.filter((id) => find(id)?.connected).every((id) => r.data.votes[id])) finish(s, now, 'votes');
      break;
    }

    /* ---- Snitch Protocol ---- */
    case 'violation': {
      if (s.phase !== 'round' || !isPlayer || now < r.startsAt || r.violations[actorId]) return prev;
      r.violations[actorId] = { reason: String(a.reason || 'stopped').slice(0, 16), at: now };
      r.strikes[actorId] = (r.strikes[actorId] || 0) + 1;
      break;
    }
    case 'resolved': {
      if (!r?.violations?.[actorId]) return prev;
      delete r.violations[actorId];
      break;
    }
    case 'noise': {
      if (!inPlay || !isPlayer || now - (r.noiseAt[actorId] || 0) < 4000 || !r.data.noise) return prev;
      r.noiseAt[actorId] = now;
      r.data.noise = { count: r.data.noise.count + 1, at: now, by: actorId };
      break;
    }

    /* ---- Hide & Seek ---- */
    case 'radar': {
      const d = r?.data;
      if (!inPlay || r.game !== 'hide_seek' || myRole !== 'seeker' || now < d.hideUntil || d.radarLeft <= 0 || now < d.radarCooldown) return prev;
      d.radarLeft -= 1;
      d.radarCount += 1;
      d.radarAt = now + 1500;
      d.radarCooldown = now + 8000;
      break;
    }
    case 'found': {
      const d = r?.data;
      if (!inPlay || r.game !== 'hide_seek' || myRole !== 'seeker' || now < d.hideUntil || r.roles[a.id] !== 'hider' || d.found[a.id]) return prev;
      d.found[a.id] = now;
      if (r.participants.filter((id) => r.roles[id] === 'hider').every((id) => d.found[id])) finish(s, now, 'all-found');
      break;
    }

    /* ---- Sardines ---- */
    case 'packed': {
      const d = r?.data;
      if (!inPlay || r.game !== 'sardines' || myRole !== 'hunter' || now < d.hideUntil || d.packed.includes(actorId)) return prev;
      d.packed.push(actorId);
      const left = r.participants.filter((id) => r.roles[id] === 'hunter' && !d.packed.includes(id));
      if (left.length <= 1) finish(s, now, 'last-hunter');
      break;
    }

    /* ---- Floor Is Lava ---- */
    case 'lavaCheck': {
      const d = r?.data;
      if (!inPlay || r.game !== 'floor_lava' || !isPlayer || !d.lava || a.n !== d.lava.n) return prev;
      if (now < d.lava.at - 1000 || now > d.lava.at + 6000 || d.checks[a.n]?.[actorId] !== undefined) return prev;
      d.checks[a.n] = { ...(d.checks[a.n] || {}), [actorId]: !!a.safe };
      if (a.mediaId) d.proofs.push({ id: String(a.mediaId).slice(0, 32), by: actorId, n: a.n, safe: !!a.safe });
      break;
    }

    /* ---- Zombie Tag ---- */
    case 'infected': {
      const d = r?.data;
      if (!inPlay || r.game !== 'zombie_tag' || !isPlayer || d.zombies.includes(actorId)) return prev;
      d.zombies.push(actorId);
      d.infectedAt[actorId] = now;
      d.last = { id: actorId, at: now };
      if (r.participants.every((id) => d.zombies.includes(id))) finish(s, now, 'all-infected');
      break;
    }

    /* ---- Marco Polo ---- */
    case 'marco': {
      const d = r?.data;
      if (!inPlay || r.game !== 'marco_polo' || myRole !== 'marco' || now < d.cooldownUntil) return prev;
      d.marcos += 1;
      d.marcoAt = now + 400;
      d.cooldownUntil = now + 20000;
      break;
    }
    case 'tag': {
      const d = r?.data;
      if (!inPlay || r.game !== 'marco_polo' || myRole !== 'marco' || r.roles[a.id] !== 'polo' || d.tagged[a.id]) return prev;
      d.tagged[a.id] = now;
      if (r.participants.filter((id) => r.roles[id] === 'polo').every((id) => d.tagged[id])) finish(s, now, 'all-tagged');
      break;
    }

    /* ---- GPS Playzone ---- */
    case 'pos': {
      if (s.phase !== 'round' || !r.zone || !isPlayer) return prev;
      const p = { lat: Number(a.lat), lng: Number(a.lng), acc: Math.min(9999, Math.round(Number(a.acc) || 0)), at: now };
      if (!validPoint(p)) return prev;
      const h = s.secret.host;
      h.pos[actorId] = p;
      addTrail(h, actorId, p);
      let visible = false;
      if (now >= r.startsAt) {
        visible = checkSide(s, actorId, now);
        if (r.hunt) {
          if (updateHeartbeat(s)) visible = true;
          if (claimDrop(s, actorId, now)) visible = true;
        }
      }
      // Revealed players stream their pin; everything else is host-only bookkeeping.
      if (!visible && !r.zoneRevealed[actorId]) s.quiet = true;
      break;
    }
    case 'uavRadar': {
      if (!inPlay || !r.hunt || !isHunter(r, actorId) || now < (r.data.hideUntil || 0)) return prev;
      const h = s.secret.host;
      const used = r.radarUses[actorId] || 0;
      if (used >= RADAR_USES || (h.scan && now < h.scan.until)) return prev;
      const id = rid();
      const blips = [];
      const decoys = [];
      remainingHiders(r).forEach((hid) => {
        if (h.ghost[hid]) {
          delete h.ghost[hid];
          h.ghostUsed[hid] = id;
        } else if (h.pos[hid]) blips.push({ id: hid, lat: h.pos[hid].lat, lng: h.pos[hid].lng });
      });
      Object.keys(h.decoys).forEach((hid) => {
        if (h.decoys[hid] !== 'armed') return;
        h.decoys[hid] = 'used';
        decoys.push(hid);
        blips.push(fakeBlip(s, hid, now));
      });
      r.radarUses[actorId] = used + 1;
      r.xpAdj[actorId] = (r.xpAdj[actorId] || 0) + XP.radarPing;
      r.radar.push({ id, by: actorId, at: now, until: now + RADAR_MS });
      h.scan = { id, kind: 'radar', by: actorId, at: now, until: now + RADAR_MS, blips: shuffle(blips) };
      const me = h.pos[actorId];
      h.radarLog.push({ id, by: actorId, at: now, lat: me?.lat ?? null, lng: me?.lng ?? null, seen: blips.length - decoys.length, decoys });
      break;
    }
    case 'decoy': {
      if (!inPlay || !r.hunt || !remainingHiders(r).includes(actorId)) return prev;
      const h = s.secret.host;
      if (h.decoys[actorId]) return prev;
      const pingsLeft = r.participants.some((id) => isHunter(r, id) && (r.radarUses[id] || 0) < RADAR_USES);
      if (pingsLeft || (h.scan && now < h.scan.until)) h.decoys[actorId] = 'armed';
      else {
        // No radar left to ride on: the fake signal goes straight to the hunters' map.
        h.decoys[actorId] = 'used';
        h.scan = { id: rid(), kind: 'signal', at: now, until: now + RADAR_MS, blips: [fakeBlip(s, actorId, now)] };
        h.radarLog.push({ id: h.scan.id, by: null, at: now, lat: null, lng: null, seen: 0, decoys: [actorId] });
      }
      break;
    }

    default:
      return prev;
  }
  s.seq += 1;
  return s;
}

// Per-phone GPS intel: hunters see radar blips and revealed pins, hiders get the heartbeat.
function intelFor(s, viewerId, now) {
  const r = s.round;
  const h = s.secret?.host;
  if (s.phase !== 'round' || !r?.zone || !h?.pos) return null;
  const hunter = isHunter(r, viewerId);
  const hiding = remainingHiders(r).includes(viewerId);
  const intel = {
    // Out-of-bounds players stream their position to the other side (to everyone outside hunts).
    reveals: Object.keys(r.zoneRevealed)
      .filter((id) => id !== viewerId && h.pos[id] && (!r.hunt || isHunter(r, id) !== hunter))
      .map((id) => ({ id, lat: h.pos[id].lat, lng: h.pos[id].lng, at: h.pos[id].at })),
  };
  if (hunter && h.scan && now < h.scan.until) intel.scan = h.scan;
  if (hiding) {
    intel.hb = h.hb[viewerId] || null;
    intel.ghost = !!h.ghost[viewerId];
    intel.ghostUsed = h.ghostUsed[viewerId] || null;
    intel.decoy = h.decoys[viewerId] || 'ready';
  }
  return intel;
}

// What one phone may see: public state + only its own secret slice.
export function viewFor(s, viewerId, now = Date.now()) {
  const { secret, ...pub } = s;
  return { ...pub, now, me: viewerId, mine: secret?.players?.[viewerId] || null, intel: intelFor(s, viewerId, now) };
}
