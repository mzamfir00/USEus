// Mafia: The AI Storyteller Edition. One phone (the Storyteller) reads every line out loud while
// the host phone runs the night → morning → debate → vote cycle below, so nobody sits out as a
// human moderator. Shared by the web app and the native app.
//
// Secrets: everyone's public role is "player". The real role, the Mafia's live target picks,
// the Doctor's save and the Detective's verdicts live in the host's secret state; each phone
// only receives its own slice (view.mine).

import { XP } from './games';

export const MAFIA_ROLES = ['mafia', 'doctor', 'detective', 'citizen'];

// 4–5 players: 1 Mafia · 6–8: 2 · 9+: 3. Always one Doctor and one Detective.
export const mafiaCount = (n) => (n >= 9 ? 3 : n >= 6 ? 2 : 1);

export const MAFIA_TIMING = {
  dusk: 4000, // after "Everyone close your eyes"
  pick: 20000, // a night role's time to choose, after its wake-up line
  fakeMin: 7000, // a dead (or quick) Doctor / Detective still "takes" 7–10 s
  fakeMax: 10000,
  verdict: 4000, // the Detective's verdict stays on screen
  mafiaSleep: 2000, // black screens before "Mafia, go to sleep"
  morning: 3500, // time to read the morning newspaper
  day: 120000, // daytime discussion
  vote: 90000, // ballot window; missing ballots count as a skip
  read: 4000, // time to read the vote result
};

export const MAFIA_LANGS = { ro: { label: 'Română', short: 'RO', speech: 'ro-RO' }, en: { label: 'English', short: 'EN', speech: 'en-US' } };

// Every line the Storyteller says, in both narrator languages.
export const MAFIA_LINES = {
  sleep: { ro: 'Orașul adoarme. Toată lumea închide ochii.', en: 'Night falls over the city. Everyone close your eyes.' },
  mafiaWake: { ro: 'Mafia se trezește. Deschideți ochii și alegeți victima pe ecran.', en: 'Mafia, wake up. Open your eyes and select your target on your screen.' },
  mafiaSleep: { ro: 'Mafia adoarme. Închideți ochii.', en: 'Mafia, go to sleep. Close your eyes.' },
  doctorWake: { ro: 'Doctorul se trezește. Alege pe ecran pe cine vrei să salvezi în această noapte.', en: 'Doctor, wake up. Choose on your screen who you want to save tonight.' },
  doctorSleep: { ro: 'Doctorul adoarme.', en: 'Doctor, go to sleep.' },
  detectiveWake: { ro: 'Detectivul se trezește. Alege pe ecran persoana pe care vrei să o verifici.', en: 'Detective, wake up. Choose on your screen the person you want to investigate.' },
  detectiveSleep: { ro: 'Detectivul adoarme.', en: 'Detective, go to sleep.' },
  morning: { ro: 'S-a făcut dimineață! Toată lumea deschide ochii.', en: 'Morning has come! Everyone, open your eyes.' },
  killed: { ro: 'Azi-noapte, Mafia a atacat... și {name} a fost eliminat!', en: 'Last night, the Mafia attacked... and {name} was eliminated!' },
  saved: { ro: 'Azi-noapte, Mafia a încercat să atace, dar Doctorul a intervenit la timp! Nimeni nu a murit!', en: 'Last night, the Mafia tried to attack, but the Doctor stepped in just in time! Nobody died!' },
  quiet: { ro: 'Noaptea a trecut în liniște. Nimeni nu a murit!', en: 'The night passed quietly. Nobody died!' },
  day: { ro: 'Aveți două minute să discutați. Cine face parte din Mafia?', en: 'You have two minutes to talk. Who is in the Mafia?' },
  vote: { ro: 'Timpul a expirat. Votați pe ecran pe cine vreți să eliminați.', en: 'Time is up. Vote on your screen for who to eliminate.' },
  voteOut: { ro: 'Orașul a votat. {name} este eliminat. Rolul său era: {role}.', en: 'The town has voted. {name} is eliminated. Their role was: {role}.' },
  voteNone: { ro: 'Orașul nu s-a hotărât. Nimeni nu este eliminat astăzi.', en: 'The town could not agree. Nobody is eliminated today.' },
  townWin: { ro: 'Toată Mafia a fost prinsă. Cetățenii au câștigat!', en: 'The whole Mafia has been caught. The citizens win!' },
  mafiaWin: { ro: 'Mafia a preluat controlul orașului. Mafia a câștigat!', en: 'The Mafia has taken over the city. The Mafia wins!' },
};

const ROLE_WORDS = {
  ro: { mafia: 'Mafia', doctor: 'Doctor', detective: 'Detectiv', citizen: 'Cetățean' },
  en: { mafia: 'Mafia', doctor: 'Doctor', detective: 'Detective', citizen: 'Citizen' },
};

export const mafiaLang = (lang) => (MAFIA_LANGS[lang] ? lang : 'ro');

export function mafiaLine(key, lang, params = {}) {
  const l = mafiaLang(lang);
  return (MAFIA_LINES[key]?.[l] || '').replace(/\{(name|role)\}/g, (_, k) => (k === 'role' ? ROLE_WORDS[l][params.role] || '' : params.name || ''));
}

// The full text a step reads out, and roughly how long a phone takes to say it.
export const stepText = (step, lang) => (step?.say || []).map((x) => mafiaLine(x.k, lang, x.p)).join(' ');
export const speakMs = (text) => (text ? 700 + text.length * 72 : 0);

/* ------------------------------ host helpers ------------------------------ */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const roleOf = (s, id) => s.secret?.host?.roles?.[id] || null;
const nameOf = (s, id) => s.players.find((p) => p.id === id)?.name || 'Someone';
const connected = (s, id) => !!s.players.find((p) => p.id === id)?.connected;

export const mafiaAlive = (r) => r.participants.filter((id) => !r.data.dead[id]);
const aliveWith = (s, role) => mafiaAlive(s.round).filter((id) => roleOf(s, id) === role);

// The phone that speaks: the chosen Storyteller while it's connected, otherwise the host.
export function storytellerOf(view) {
  const d = view.round?.data;
  const id = d?.narrator;
  return id && view.players.find((p) => p.id === id)?.connected ? id : view.hostId;
}

export function mafiaWinner(s) {
  const alive = mafiaAlive(s.round);
  const mafia = alive.filter((id) => roleOf(s, id) === 'mafia').length;
  if (mafia === 0) return 'town';
  if (mafia >= alive.length - mafia) return 'mafia';
  return null;
}

/* ----------------------------------- setup -------------------------------- */

export function setupMafia(s, ids) {
  const order = shuffle(ids);
  const n = mafiaCount(ids.length);
  const roles = {};
  order.forEach((id, i) => {
    roles[id] = i < n ? 'mafia' : i === n ? 'doctor' : i === n + 1 ? 'detective' : 'citizen';
  });
  const team = order.slice(0, n);
  const players = {};
  ids.forEach((id) => {
    players[id] = roles[id] === 'mafia' ? { role: 'mafia', team } : roles[id] === 'detective' ? { role: 'detective', checks: [] } : { role: roles[id] };
  });
  const st = s.settings.mafia || {};
  const narrator = st.narrator && ids.includes(st.narrator) ? st.narrator : s.hostId;
  return {
    public: Object.fromEntries(ids.map((id) => [id, 'player'])),
    secretPlayers: players,
    secretHost: { roles, picks: {}, locked: {}, target: null, protect: null, check: null, ballots: {}, until: null, minUntil: null },
    data: { narrator, lang: mafiaLang(st.lang), n: 0, step: null, dead: {}, voted: {}, ballots: null, report: null, verdict: null, log: [], winner: null, counts: { mafia: n } },
  };
}

/* -------------------------------- the cycle ------------------------------- */

function syncMafia(s) {
  const h = s.secret.host;
  aliveWith(s, 'mafia').forEach((id) => {
    s.secret.players[id] = { ...s.secret.players[id], picks: { ...h.picks }, locked: { ...h.locked }, target: h.target, deadline: h.deadline };
  });
}

// Enters a step: what the Storyteller says and when the host moves on.
function enter(s, kind, now) {
  const r = s.round;
  const d = r.data;
  const h = s.secret.host;
  const T = MAFIA_TIMING;
  let say = [];
  let delay = 0;
  switch (kind) {
    case 'dusk':
      say = [{ k: 'sleep' }];
      break;
    case 'mafia':
      say = [{ k: 'mafiaWake' }];
      break;
    case 'mafiaSleep':
      say = [{ k: 'mafiaSleep' }];
      delay = T.mafiaSleep;
      break;
    case 'doctor':
      say = [{ k: 'doctorWake' }];
      break;
    case 'doctorSleep':
      say = [{ k: 'doctorSleep' }];
      break;
    case 'detective':
      say = [{ k: 'detectiveWake' }];
      break;
    case 'detectiveSleep':
      say = [{ k: 'detectiveSleep' }];
      break;
    case 'morning': {
      const rep = d.report;
      say = [{ k: 'morning' }, rep.victim ? { k: 'killed', p: { name: nameOf(s, rep.victim) } } : { k: rep.saved ? 'saved' : 'quiet' }];
      break;
    }
    case 'day':
      say = [{ k: 'day' }];
      break;
    case 'vote':
      say = [{ k: 'vote' }];
      break;
    case 'verdict': {
      const v = d.verdict;
      say = [v.out ? { k: 'voteOut', p: { name: nameOf(s, v.out), role: v.role } } : { k: 'voteNone' }];
      break;
    }
    case 'end':
      say = [{ k: d.winner === 'mafia' ? 'mafiaWin' : 'townWin' }];
      break;
    default:
      break;
  }
  const speak = speakMs(say.map((x) => mafiaLine(x.k, d.lang, x.p)).join(' '));
  const spoken = now + delay + speak;
  d.step = { id: `${d.n}-${kind}`, kind, n: d.n, at: now, sayAt: now + delay, say, until: null };
  h.minUntil = null;
  h.deadline = null;
  switch (kind) {
    case 'dusk':
      h.until = spoken + T.dusk;
      break;
    case 'mafia':
      h.picks = {};
      h.locked = {};
      h.target = null;
      h.deadline = spoken + T.pick;
      h.until = h.deadline;
      syncMafia(s);
      break;
    case 'doctor':
    case 'detective': {
      // Same silent pause whether the role is alive or not, so nobody learns who died.
      h.minUntil = spoken + between(T.fakeMin, T.fakeMax);
      const alive = aliveWith(s, kind).length > 0;
      h.deadline = alive ? spoken + T.pick : null;
      h.until = alive ? h.deadline : h.minUntil;
      aliveWith(s, kind).forEach((id) => {
        s.secret.players[id] = { ...s.secret.players[id], deadline: h.deadline, picked: null, verdict: null };
      });
      break;
    }
    case 'morning':
      h.until = spoken + T.morning;
      break;
    case 'day':
      h.until = spoken + T.day;
      d.step.until = h.until;
      break;
    case 'vote':
      d.voted = {};
      d.ballots = null;
      h.ballots = {};
      h.until = spoken + T.vote;
      d.step.until = h.until;
      break;
    case 'verdict':
      h.until = spoken + T.read;
      break;
    default:
      h.until = spoken + 1200; // the "go to sleep" lines and the closing line
  }
}

export function startNight(s, now) {
  const d = s.round.data;
  d.n += 1;
  d.report = null;
  d.verdict = null;
  d.voted = {};
  d.ballots = null;
  const h = s.secret.host;
  h.protect = null;
  h.check = null;
  enter(s, 'dusk', now);
}

function resolveMafiaTarget(s) {
  const h = s.secret.host;
  if (h.target) return;
  const tally = {};
  Object.values(h.picks).forEach((id) => {
    if (id) tally[id] = (tally[id] || 0) + 1;
  });
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === top);
  h.target = top > 0 ? pick(leaders) : null; // time ran out: the most-picked target (ties: random)
}

function resolveNight(s) {
  const r = s.round;
  const d = r.data;
  const h = s.secret.host;
  const victim = h.target && !d.dead[h.target] ? h.target : null;
  const saved = !!victim && victim === h.protect;
  if (victim && !saved) d.dead[victim] = { n: d.n, how: 'night' };
  d.report = { n: d.n, victim: saved ? null : victim, saved };
  d.log.push({ n: d.n, kind: 'night', victim: saved ? null : victim, saved, ...(saved && { savedBy: aliveWith(s, 'doctor')[0] || null }) });
  if (saved) h.saves = (h.saves || 0) + 1;
}

function resolveVote(s) {
  const r = s.round;
  const d = r.data;
  const h = s.secret.host;
  const ballots = {};
  mafiaAlive(r).forEach((id) => {
    ballots[id] = h.ballots[id] ?? null; // missing ballot = skip
  });
  const tally = {};
  let skips = 0;
  Object.values(ballots).forEach((id) => {
    if (id) tally[id] = (tally[id] || 0) + 1;
    else skips += 1;
  });
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === top);
  // Most votes is out. A tie at the top, or at least as many skips, saves everyone.
  const out = top > 0 && leaders.length === 1 && top > skips ? leaders[0] : null;
  if (out) d.dead[out] = { n: d.n, how: 'vote' };
  d.ballots = ballots;
  d.verdict = { n: d.n, out, role: out ? roleOf(s, out) : null, tally, skips };
  d.log.push({ n: d.n, kind: 'vote', out, role: out ? roleOf(s, out) : null, ballots });
}

function advance(s, now) {
  const d = s.round.data;
  const kind = d.step.kind;
  const win = () => {
    d.winner = mafiaWinner(s);
    return !!d.winner;
  };
  switch (kind) {
    case 'dusk':
      return enter(s, 'mafia', now);
    case 'mafia':
      resolveMafiaTarget(s);
      syncMafia(s);
      return enter(s, 'mafiaSleep', now);
    case 'mafiaSleep':
      return enter(s, 'doctor', now);
    case 'doctor':
      return enter(s, 'doctorSleep', now);
    case 'doctorSleep':
      return enter(s, 'detective', now);
    case 'detective':
      return enter(s, 'detectiveSleep', now);
    case 'detectiveSleep':
      resolveNight(s);
      return enter(s, 'morning', now);
    case 'morning':
      return enter(s, win() ? 'end' : 'day', now);
    case 'day':
      return enter(s, 'vote', now);
    case 'vote':
      resolveVote(s);
      return enter(s, 'verdict', now);
    case 'verdict':
      if (win()) return enter(s, 'end', now);
      return startNight(s, now);
    default:
      return 'finish';
  }
}

// Host clock work. Returns 'finish' when the closing line is done, true when anything changed.
export function mafiaTick(s, now) {
  const h = s.secret.host;
  if (!s.round.data.step || h.until == null || now < h.until) return false;
  return advance(s, now) === 'finish' ? 'finish' : true;
}

// Player actions. Returns false to reject, 'finish' to end the round, otherwise true.
export function mafiaAction(s, actorId, a, now) {
  const r = s.round;
  const d = r.data;
  const h = s.secret.host;
  const step = d.step?.kind;
  const alive = mafiaAlive(r);
  const me = roleOf(s, actorId);
  const living = (id) => alive.includes(id);
  if (!living(actorId) && a.type !== 'mafiaSkip') return false;

  switch (a.type) {
    case 'mafiaPick': {
      if (step !== 'mafia' || me !== 'mafia' || h.target || !living(a.id) || roleOf(s, a.id) === 'mafia') return false;
      h.picks[actorId] = a.id;
      delete h.locked[actorId];
      syncMafia(s);
      return true;
    }
    case 'mafiaConfirm': {
      if (step !== 'mafia' || me !== 'mafia' || h.target || !h.picks[actorId]) return false;
      h.locked[actorId] = true;
      // Done once every Mafia member still awake has locked in the same target.
      const awake = aliveWith(s, 'mafia').filter((id) => connected(s, id) || id === actorId);
      const choice = h.picks[actorId];
      if (awake.every((id) => h.locked[id] && h.picks[id] === choice)) {
        h.target = choice;
        h.until = now + 1500;
      }
      syncMafia(s);
      return true;
    }
    case 'mafiaProtect': {
      if (step !== 'doctor' || me !== 'doctor' || h.protect || !living(a.id)) return false;
      h.protect = a.id;
      s.secret.players[actorId] = { ...s.secret.players[actorId], picked: a.id };
      h.until = Math.max(now, h.minUntil);
      return true;
    }
    case 'mafiaCheck': {
      if (step !== 'detective' || me !== 'detective' || h.check || !living(a.id) || a.id === actorId) return false;
      h.check = a.id;
      const mafia = roleOf(s, a.id) === 'mafia';
      const mine = s.secret.players[actorId];
      s.secret.players[actorId] = { ...mine, picked: a.id, verdict: { id: a.id, mafia, until: now + MAFIA_TIMING.verdict }, checks: [...(mine.checks || []), { n: d.n, id: a.id, mafia }] };
      h.until = Math.max(now + MAFIA_TIMING.verdict, h.minUntil);
      return true;
    }
    case 'mafiaSkip': {
      // Host: end the discussion early and go to the vote.
      if (actorId !== s.hostId || step !== 'day') return false;
      return advance(s, now) === 'finish' ? 'finish' : true;
    }
    case 'mafiaVote': {
      if (step !== 'vote' || d.voted[actorId] || (a.id != null && (!living(a.id) || a.id === actorId))) return false;
      h.ballots[actorId] = a.id || null;
      d.voted = { ...d.voted, [actorId]: true };
      // Everyone still here has voted: reveal right away.
      if (alive.filter((id) => connected(s, id) || id === actorId).every((id) => d.voted[id])) {
        resolveVote(s);
        enter(s, 'verdict', now);
      }
      return true;
    }
    default:
      return false;
  }
}

// Lobby / briefing: the host picks the Storyteller phone and the narrator language.
export function mafiaSettings(s, a) {
  const valid = (id) => s.players.some((p) => p.id === id);
  if (s.phase === 'lobby') {
    const cur = s.settings.mafia || {};
    s.settings.mafia = { narrator: a.narrator === null ? null : valid(a.narrator) ? a.narrator : cur.narrator || null, lang: a.lang ? mafiaLang(a.lang) : mafiaLang(cur.lang) };
    return true;
  }
  const r = s.round;
  if (s.phase !== 'round' || r?.game !== 'mafia' || r.stage !== 'brief') return false;
  if (a.narrator && r.participants.includes(a.narrator)) r.data.narrator = a.narrator;
  if (a.lang) r.data.lang = mafiaLang(a.lang);
  if (a.narrator === null) r.data.narrator = s.hostId;
  return true;
}

/* --------------------------------- scoring -------------------------------- */

export function scoreMafia(s, add, winners) {
  const r = s.round;
  const d = r.data;
  const h = s.secret.host;
  const roles = h.roles;
  const winner = d.winner;
  const alive = mafiaAlive(r);
  r.participants.forEach((id) => {
    const mafia = roles[id] === 'mafia';
    if (winner === 'mafia' && mafia) add(id, XP.mafiaWin);
    if (winner === 'town' && !mafia) add(id, XP.townWin);
    if ((winner === 'mafia') === mafia && winner) winners.add(id);
    if (alive.includes(id) && winner) add(id, XP.mafiaSurvive);
  });
  const doctor = r.participants.find((id) => roles[id] === 'doctor');
  if (doctor && h.saves) add(doctor, h.saves * XP.doctorSave);
  const detective = r.participants.find((id) => roles[id] === 'detective');
  const found = new Set((s.secret.players[detective]?.checks || []).filter((c) => c.mafia).map((c) => c.id));
  if (detective && found.size) add(detective, found.size * XP.detectiveFind);
  d.log
    .filter((e) => e.kind === 'vote' && e.out && e.role === 'mafia')
    .forEach((e) => Object.entries(e.ballots).forEach(([voter, target]) => target === e.out && add(voter, XP.voteRight)));
  const headline = winner === 'mafia' ? 'The Mafia took over the city' : winner === 'town' ? 'The citizens caught the whole Mafia' : 'The night was cut short';
  return {
    headline,
    reveal: { roles: { ...roles }, log: d.log, winner, mafiaWon: winner === 'mafia', nights: d.n, checks: s.secret.players[detective]?.checks || [] },
  };
}
