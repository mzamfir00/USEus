// Account + room persistence.
// - Local mode (default, zero-config): accounts, rooms and history live in localStorage;
//   profiles of players met in rooms are cached in a P2P-synced "known players" registry.
// - Cloud mode: when a Supabase URL + anon key are configured (VITE_SUPABASE_URL /
//   VITE_SUPABASE_ANON_KEY at build time, or pasted in the in-app settings), profiles,
//   rooms, room_players and mission_history are also written to Postgres
//   (see supabase/schema.sql). Local copies are always kept so the app works offline.

const KEYS = {
  accounts: 'sr.accounts',
  session: 'sr.session',
  rooms: 'sr.rooms',
  known: 'sr.known',
  applied: 'sr.applied',
  missions: 'sr.missions',
  cfg: 'sr.supabase',
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage full or blocked */
  }
};

/* ------------------------------ Supabase --------------------------------- */

export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey, source: 'env' };
  const cfg = read(KEYS.cfg, null);
  return cfg?.url && cfg?.key ? { ...cfg, source: 'settings' } : null;
}

export function setSupabaseConfig(cfg) {
  if (cfg) write(KEYS.cfg, { url: cfg.url.trim(), key: cfg.key.trim() });
  else localStorage.removeItem(KEYS.cfg);
  clientPromise = null;
}

export const dbMode = () => (getSupabaseConfig() ? 'cloud' : 'local');

let clientPromise = null;

export function getSupabase() {
  const cfg = getSupabaseConfig();
  if (!cfg) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(cfg.url, cfg.key, { auth: { persistSession: true } }))
      .catch(() => null);
  }
  return clientPromise;
}

// Runs a cloud write without ever breaking the local flow.
async function cloud(fn) {
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    return await fn(sb);
  } catch (e) {
    console.warn('[db] cloud sync failed', e);
    return null;
  }
}

export async function testSupabase(cfg) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(cfg.url.trim(), cfg.key.trim(), { auth: { persistSession: false } });
    const { error } = await sb.from('profiles').select('username').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Could not reach Supabase' };
  }
}

/* ------------------------------- Accounts -------------------------------- */

export const normalizeUsername = (u) => (u || '').trim().replace(/^@+/, '').toLowerCase();
export const validUsername = (u) => /^[a-z0-9_]{3,16}$/.test(u);

async function hashPin(username, pin) {
  const text = `squadroulette:${username}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `fnv${(h >>> 0).toString(16)}`;
}

const uuid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const emptyStats = () => ({ xp: 0, missions: 0, secretWins: 0, rounds: 0, chickened: 0 });

const accounts = () => read(KEYS.accounts, {});
const saveAccount = (profile) => write(KEYS.accounts, { ...accounts(), [profile.username]: profile });

export const publicProfile = (p) => ({ id: p.id, username: p.username, name: p.name, age: p.age, archetype: p.archetype });

// pin_hash is never selected by clients; logins are verified by the login_profile() RPC.
const PROFILE_COLS =
  'id,username,name,age,archetype,xp,missions_completed,secret_wins,rounds_played,chickened,squad_history,created_at';

const toRow = (p) => ({
  id: p.id,
  username: p.username,
  name: p.name,
  age: p.age,
  archetype: p.archetype,
  pin_hash: p.pinHash,
  xp: p.stats.xp,
  missions_completed: p.stats.missions,
  secret_wins: p.stats.secretWins,
  rounds_played: p.stats.rounds,
  chickened: p.stats.chickened,
  squad_history: p.history,
  updated_at: new Date().toISOString(),
});

const fromRow = (r) => ({
  id: r.id,
  username: r.username,
  name: r.name,
  age: r.age,
  archetype: r.archetype,
  pinHash: r.pin_hash,
  createdAt: r.created_at,
  stats: {
    xp: r.xp || 0,
    missions: r.missions_completed || 0,
    secretWins: r.secret_wins || 0,
    rounds: r.rounds_played || 0,
    chickened: r.chickened || 0,
  },
  history: r.squad_history || [],
});

export async function isUsernameTaken(username) {
  if (accounts()[username] || read(KEYS.known, {})[username]) return true;
  const row = await cloud(async (sb) => {
    const { data } = await sb.from('profiles').select('username').eq('username', username).maybeSingle();
    return data;
  });
  return !!row;
}

export async function signUp({ name, username: rawUsername, age, archetype, pin }) {
  const username = normalizeUsername(rawUsername);
  const cleanName = (name || '').trim().slice(0, 24);
  const ageNum = Number(age);
  if (!cleanName) throw new Error('Enter your name or nickname.');
  if (!validUsername(username)) throw new Error('Username: 3–16 characters, letters, numbers or _.');
  if (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 99) throw new Error('You must be 13 or older to play.');
  if (!archetype) throw new Error('Pick your playstyle archetype.');
  if (!/^\d{4}$/.test(pin || '')) throw new Error('Choose a 4-digit PIN.');
  if (await isUsernameTaken(username)) throw new Error(`@${username} is already taken.`);

  const profile = {
    id: uuid(),
    username,
    name: cleanName,
    age: ageNum,
    archetype,
    pinHash: await hashPin(username, pin),
    createdAt: new Date().toISOString(),
    stats: emptyStats(),
    history: [],
  };
  saveAccount(profile);
  write(KEYS.session, username);
  await cloud(async (sb) => {
    // Anonymous auth gives the row an auth identity when the project allows it.
    try {
      if (!(await sb.auth.getSession()).data.session) await sb.auth.signInAnonymously();
    } catch (e) {
      /* anonymous sign-ins disabled: anon key writes still work with the bundled policies */
    }
    const { error } = await sb.from('profiles').insert(toRow(profile));
    if (error) throw error;
  });
  return profile;
}

export async function logIn(rawUsername, pin) {
  const username = normalizeUsername(rawUsername);
  const hash = await hashPin(username, pin);
  let profile = accounts()[username];
  if (!profile) {
    const row = await cloud(async (sb) => {
      const { data, error } = await sb.rpc('login_profile', { p_username: username, p_pin_hash: hash });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    });
    if (row) profile = { ...fromRow(row), pinHash: hash };
  }
  if (!profile) throw new Error(dbMode() === 'cloud' ? 'Unknown username or wrong PIN.' : `No account @${username} on this device.`);
  if (profile.pinHash !== hash) throw new Error('Wrong PIN.');
  saveAccount(profile);
  write(KEYS.session, username);
  return profile;
}

export const currentUser = () => {
  const username = read(KEYS.session, null);
  return username ? accounts()[username] || null : null;
};

export const logOut = () => localStorage.removeItem(KEYS.session);

export const deviceAccounts = () =>
  Object.values(accounts()).sort((a, b) => (b.stats?.xp || 0) - (a.stats?.xp || 0));

// Pulls the freshest stats from the cloud (another device may have played since).
export async function refreshProfile(username) {
  const row = await cloud(async (sb) => {
    const { data } = await sb.from('profiles').select(PROFILE_COLS).eq('username', username).maybeSingle();
    return data;
  });
  if (!row) return accounts()[username] || null;
  const merged = { ...accounts()[username], ...fromRow(row), pinHash: accounts()[username]?.pinHash };
  saveAccount(merged);
  return merged;
}

// Applies one round's stats to the signed-in account exactly once per round.
export async function applyRoundStats(username, roundKey, delta, historyEntry) {
  const applied = read(KEYS.applied, []);
  const key = `${username}|${roundKey}`;
  if (applied.includes(key)) return accounts()[username];
  write(KEYS.applied, [...applied, key].slice(-200));

  const profile = accounts()[username];
  if (!profile) return null;
  const stats = { ...emptyStats(), ...profile.stats };
  Object.keys(delta).forEach((k) => {
    stats[k] = (stats[k] || 0) + delta[k];
  });
  const updated = { ...profile, stats, history: [historyEntry, ...(profile.history || [])].slice(0, 30) };
  saveAccount(updated);
  await cloud(async (sb) => {
    const { error } = await sb.from('profiles').update(toRow(updated)).eq('username', username);
    if (error) throw error;
  });
  return updated;
}

/* ------------------------- Known players (P2P) --------------------------- */

export function rememberPlayers(players) {
  const known = read(KEYS.known, {});
  players.filter((p) => !p.isBot).forEach((p) => {
    known[p.username] = { ...publicProfile(p), seenAt: Date.now() };
  });
  write(KEYS.known, known);
}

/* --------------------------------- Rooms --------------------------------- */

export const getRoom = (code) => read(KEYS.rooms, {})[code] || null;

export const myRooms = (hostUsername) =>
  Object.entries(read(KEYS.rooms, {}))
    .filter(([, r]) => r.host === hostUsername)
    .map(([code, r]) => ({ code, ...r }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

export async function loadRoom(code) {
  const local = getRoom(code);
  if (local) return local;
  const row = await cloud(async (sb) => {
    const { data } = await sb.from('rooms').select('*').eq('code', code).maybeSingle();
    return data;
  });
  return row ? { host: row.host_username, dna: row.dna, scores: row.scores, category: row.category, packName: row.pack_name, updatedAt: Date.parse(row.updated_at) } : null;
}

export async function saveRoom(code, data) {
  const rooms = read(KEYS.rooms, {});
  const record = { ...rooms[code], ...data, updatedAt: Date.now() };
  write(KEYS.rooms, { ...rooms, [code]: record });
  await cloud(async (sb) => {
    const { error } = await sb.from('rooms').upsert({
      code,
      host_username: record.host,
      dna: record.dna,
      scores: record.scores,
      category: record.category,
      pack_name: record.packName,
      missions_completed: record.dna?.completed || 0,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  });
}

export async function recordRoomPlayers(code, players) {
  await cloud(async (sb) => {
    const rows = players.filter((p) => !p.isBot).map((p) => ({ room_code: code, username: p.username }));
    if (!rows.length) return;
    const { error } = await sb.from('room_players').upsert(rows, { onConflict: 'room_code,username', ignoreDuplicates: true });
    if (error) throw error;
  });
}

export async function recordMission(entry) {
  write(KEYS.missions, [entry, ...read(KEYS.missions, [])].slice(0, 100));
  await cloud(async (sb) => {
    const { error } = await sb.from('mission_history').insert({
      room_code: entry.room,
      mission_id: entry.missionId,
      category: entry.category,
      outcome: entry.outcome,
      players: entry.players,
      saboteur_won: entry.saboteurWon,
    });
    if (error) throw error;
  });
}
