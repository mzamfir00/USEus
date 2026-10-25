// Host-authoritative game engine. Pure functions: the host phone owns the full
// state (including the saboteur secret) and every phone receives a filtered view.

import { MISSIONS, PENALTY_DARES } from './missions';
import {
  BOT_NAMES,
  CATEGORIES,
  CHICKEN_PENALTY,
  DEFAULT_PACK,
  DNA_STYLES,
  HYPE_CREW_XP,
  MAX_PLAYERS,
  SABOTEUR_BONUS,
  SPEED_BONUS,
  ARCHETYPES,
} from './constants';

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

export const emptyDNA = () => ({
  completed: 0,
  counts: { auteur: 0, dossier: 0, kinetic: 0 },
  vibes: {},
  last: null,
  history: [],
});

// Stage grows with every completed mission (max 3); style follows the dominant playstyle.
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
  const topVibe = Object.entries(d.vibes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { stage, style, share, completed: d.completed, topVibe, name: DNA_STYLES[style].name, code: DNA_STYLES[style].code };
}

/* ------------------------------ Room state ------------------------------- */

export function createRoom({ code, host, saved }) {
  const scores = saved?.scores || {};
  return {
    code,
    hostId: host.id,
    phase: 'lobby',
    category: saved?.category || 'supermarket',
    packName: saved?.packName || DEFAULT_PACK,
    players: [{ ...host, isHost: true, isBot: false, connected: true, xp: scores[host.username] || 0 }],
    order: [],
    usedIds: [],
    round: null,
    results: null,
    secret: null,
    dna: saved?.dna || emptyDNA(),
    scores,
    seq: 0,
  };
}

const activePlayers = (s) => s.players.filter((p) => p.connected || p.isBot);

export const timerRemaining = (t, now) => (t.running ? Math.max(0, t.endsAt - now) : t.remaining);

export const castNames = (state) => {
  const r = state.round;
  if (!r) return null;
  const name = (id) => state.players.find((p) => p.id === id)?.name || 'Someone';
  return {
    Player1: name(r.cast.p1),
    Player2: name(r.cast.p2),
    Player3: r.cast.p3 ? name(r.cast.p3) : 'THE WHOLE SQUAD',
  };
};

function chooseMission(s) {
  const pool = MISSIONS.filter((m) => m.category === s.category);
  let available = pool.filter((m) => !s.usedIds.includes(m.id));
  if (!available.length) {
    // Pool exhausted: fresh cycle, but never repeat the mission just played.
    const last = s.usedIds[s.usedIds.length - 1];
    available = pool.filter((m) => m.id !== last);
    s.usedIds = s.usedIds.filter((id) => !pool.some((m) => m.id === id));
  }
  const chosen = pick(available);
  s.usedIds.push(chosen.id);
  return chosen;
}

function startRound(s, now) {
  const active = activePlayers(s).map((p) => p.id);
  if (active.length < 2) return false;

  // Keep the existing rotation, append newcomers, then rotate one seat per round.
  let order = s.order.filter((id) => active.includes(id));
  order = [...order, ...shuffle(active.filter((id) => !order.includes(id)))];
  if (s.round) order = [...order.slice(1), order[0]];
  s.order = order;

  const mission = chooseMission(s);
  const [p1, p2, p3] = order;
  const extras = order.slice(3);
  // The saboteur sits outside the two lead roles whenever the squad is big enough.
  const candidates = order.length >= 4 ? [p3, ...extras] : order.length === 3 ? [p2, p3] : [p2];

  s.round = {
    n: (s.round?.n || 0) + 1,
    spinId: rid(),
    spunAt: now,
    missionId: mission.id,
    category: s.category,
    cast: { p1, p2, p3: p3 || null, extras },
    participants: order,
    timer: { running: false, endsAt: null, remaining: mission.duration * 1000, duration: mission.duration },
  };
  s.secret = { saboteurId: pick(candidates) };
  s.results = null;
  s.phase = 'round';
  return true;
}

function timerOp(t, op, now) {
  const left = timerRemaining(t, now);
  if (op === 'toggle') {
    if (t.running) return { ...t, running: false, endsAt: null, remaining: left };
    const remaining = left > 0 ? left : t.duration * 1000;
    return { ...t, running: true, endsAt: now + remaining, remaining };
  }
  if (op === 'add') return t.running ? { ...t, endsAt: t.endsAt + 60000 } : { ...t, remaining: left + 60000 };
  if (op === 'reset') return { ...t, running: false, endsAt: null, remaining: t.duration * 1000 };
  if (op === 'sim10') return { ...t, running: true, endsAt: now + 10000, remaining: 10000 };
  return t;
}

function resolveRound(s, outcome, saboteurWon, now) {
  const r = s.round;
  const mission = missionById(r.missionId);
  const sab = s.secret?.saboteurId;
  const core = [r.cast.p1, r.cast.p2, r.cast.p3].filter(Boolean);
  const timeLeft = timerRemaining(r.timer, now) > 0;
  const deltas = {};
  const add = (id, n) => {
    if (id) deltas[id] = (deltas[id] || 0) + n;
  };

  if (outcome === 'complete') {
    core.forEach((id) => add(id, mission.xp + (timeLeft ? SPEED_BONUS : 0)));
    r.cast.extras.forEach((id) => add(id, HYPE_CREW_XP));
  } else {
    core.forEach((id) => add(id, -CHICKEN_PENALTY));
  }
  if (saboteurWon) add(sab, SABOTEUR_BONUS);

  const before = dnaInfo(s.dna);
  if (outcome === 'complete') {
    const style = CATEGORIES[r.category].style;
    s.dna.completed += 1;
    s.dna.counts[style] += 1;
    s.dna.vibes[r.category] = (s.dna.vibes[r.category] || 0) + 1;
    s.dna.last = style;
    s.dna.history = [...s.dna.history, { missionId: mission.id, category: r.category, at: now }].slice(-20);
  }
  const after = dnaInfo(s.dna);

  const stats = {};
  r.participants.forEach((id) => {
    stats[id] = {
      xp: deltas[id] || 0,
      missions: outcome === 'complete' ? 1 : 0,
      secretWins: saboteurWon && id === sab ? 1 : 0,
      rounds: 1,
      chickened: outcome === 'chicken' && core.includes(id) ? 1 : 0,
    };
  });

  s.players.forEach((p) => {
    if (deltas[p.id]) {
      p.xp += deltas[p.id];
      s.scores[p.username] = p.xp;
    }
  });

  const p1Name = s.players.find((p) => p.id === r.cast.p1)?.name || 'The main character';
  s.results = {
    outcome,
    saboteurWon,
    saboteurId: sab,
    deltas,
    stats,
    penalty: outcome === 'chicken' ? pick(PENALTY_DARES).replace('{name}', p1Name) : null,
    roundKey: `${s.code}:${r.n}:${r.spinId}`,
    evolved: before.stage !== after.stage || before.style !== after.style ? after : null,
  };
}

function makeBot(s) {
  const used = new Set(s.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Player ${s.players.length + 1}`;
  return {
    id: `bot-${rid()}`,
    username: `${name.toLowerCase()}_${rid().slice(0, 3)}`,
    name,
    age: null,
    archetype: pick(ARCHETYPES).id,
    isHost: false,
    isBot: true,
    ownerId: s.hostId,
    connected: true,
    xp: 0,
  };
}

// Applies one intent from `actorId`. Returns the previous state object when nothing changes.
export function reduce(prev, actorId, a, now = Date.now()) {
  const s = structuredClone(prev);
  const isHost = actorId === s.hostId;
  const find = (id) => s.players.find((p) => p.id === id);

  switch (a.type) {
    case 'join': {
      const existing = find(a.player.id);
      if (existing) {
        Object.assign(existing, a.player, { connected: true });
      } else {
        if (s.players.length >= MAX_PLAYERS) return prev;
        s.players.push({ ...a.player, isHost: false, isBot: false, connected: true, xp: s.scores[a.player.username] || 0 });
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
    case 'addBot': {
      if (!isHost || s.players.length >= MAX_PLAYERS) return prev;
      s.players.push(makeBot(s));
      break;
    }
    case 'remove': {
      if (!isHost || a.id === s.hostId) return prev;
      s.players = s.players.filter((p) => p.id !== a.id);
      s.order = s.order.filter((id) => id !== a.id);
      break;
    }
    case 'category': {
      if (!isHost || !CATEGORIES[a.category] || s.phase !== 'lobby') return prev;
      s.category = a.category;
      break;
    }
    case 'pack': {
      if (!isHost) return prev;
      s.packName = (a.name || '').trim().toUpperCase().slice(0, 28) || DEFAULT_PACK;
      break;
    }
    case 'spin': {
      if (!isHost || !startRound(s, now)) return prev;
      break;
    }
    case 'timer': {
      if (s.phase !== 'round' || !s.round) return prev;
      const isPlayer = s.round.participants.includes(actorId) || isHost;
      if (!isPlayer) return prev;
      s.round.timer = timerOp(s.round.timer, a.op, now);
      break;
    }
    case 'tick': {
      // Host-internal: stop an expired timer.
      const t = s.round?.timer;
      if (s.phase !== 'round' || !t?.running || t.endsAt > now) return prev;
      s.round.timer = { ...t, running: false, endsAt: null, remaining: 0 };
      break;
    }
    case 'score': {
      if (!isHost || s.phase !== 'round') return prev;
      if (s.round.timer.running) s.round.timer = timerOp(s.round.timer, 'toggle', now);
      s.phase = 'results';
      break;
    }
    case 'backToRound': {
      if (!isHost || s.phase !== 'results' || s.results) return prev;
      s.phase = 'round';
      break;
    }
    case 'resolve': {
      if (!isHost || s.phase !== 'results' || s.results) return prev;
      resolveRound(s, a.outcome === 'complete' ? 'complete' : 'chicken', !!a.saboteurWon, now);
      break;
    }
    case 'lobby': {
      if (!isHost) return prev;
      s.phase = 'lobby';
      s.secret = null;
      break;
    }
    default:
      return prev;
  }
  s.seq += 1;
  return s;
}

// What one phone is allowed to see. `viewerIds` = the phone's own player plus any
// pass-the-phone bots it controls. The saboteur identity is only included for its owner
// until the round is scored.
export function viewFor(s, viewerIds, now = Date.now()) {
  const { secret, ...pub } = s;
  const sab = secret?.saboteurId;
  return {
    ...pub,
    now,
    me: viewerIds[0],
    secret: sab && viewerIds.includes(sab) ? { saboteurId: sab } : null,
    hasSecret: !!sab && s.phase !== 'lobby',
  };
}
