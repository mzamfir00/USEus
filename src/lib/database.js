// USEus persistent storage engine.
//
// Every account, friendship, room and mission log is written to:
//   1. Supabase Postgres — when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set at
//      build time (or a project is connected from Profile → Cloud database).
//   2. IndexedDB + LocalStorage — always, mirrored, so nothing vanishes on refresh,
//      session restart or a cleared LocalStorage. hydrate() restores whichever copy
//      survived.
// Accounts are kept until their owner deletes them (Profile → Delete Account
// Permanently): deleteAccount() erases the cloud copy through the owner-verified
// delete_account() RPC and wipes every local trace. The schema blocks any other delete.

const NS = 'useus.v3.';
const KEYS = {
  accounts: `${NS}accounts`, // id -> account (private, this device)
  session: `${NS}session`, // account id
  known: `${NS}known`, // id -> public profile of players met in rooms
  rooms: `${NS}rooms`, // code -> room record (hosted)
  visited: `${NS}visited`, // code -> { dna, at } rooms joined as a guest
  applied: `${NS}applied`, // round keys already counted
  logs: `${NS}missionLogs`,
  cloud: `${NS}cloud`,
  blocked: `${NS}blocked`, // username -> { id, name, at } hidden on this device
  reports: `${NS}reports`, // reports filed from this device (and not yet uploaded)
  deletions: `${NS}pendingDeletions`, // cloud deletions still to confirm (offline / old schema)
};

/* ------------------------------ local mirror ----------------------------- */

const IDB_NAME = 'useus';
const IDB_STORE = 'kv';
let idbPromise = null;

function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  return idbPromise;
}

async function idbGet(key) {
  const db = await idb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

async function idbSet(key, value) {
  const db = await idb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
    tx.onabort = resolve;
  });
}

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

// Writes both copies; await it when the IndexedDB copy must land before anything else.
const write = (key, value) => {
  const json = JSON.stringify(value);
  try {
    localStorage.setItem(key, json);
  } catch (e) {
    /* quota or private mode: IndexedDB copy still lands */
  }
  return idbSet(key, json);
};

// Restores LocalStorage from IndexedDB (and vice versa) before the app renders.
export async function hydrate() {
  try {
    await navigator.storage?.persist?.();
  } catch (e) {
    /* best effort */
  }
  await Promise.all(
    Object.values(KEYS).map(async (key) => {
      const local = localStorage.getItem(key);
      const mirrored = await idbGet(key);
      if (local == null && mirrored != null) {
        try {
          localStorage.setItem(key, mirrored);
        } catch (e) {
          /* ignore */
        }
      } else if (local != null && mirrored == null) {
        idbSet(key, local);
      } else if (key === KEYS.accounts && local != null && mirrored != null && local !== mirrored) {
        // Never lose an account: union both copies, newest record wins per id.
        const a = JSON.parse(local);
        const b = JSON.parse(mirrored);
        const merged = { ...b };
        Object.entries(a).forEach(([id, acc]) => {
          if (!merged[id] || (acc.updatedAt || 0) >= (merged[id].updatedAt || 0)) merged[id] = acc;
        });
        // …except accounts their owner deleted (a copy can outlive the delete on a crash).
        read(KEYS.deletions, []).forEach((j) => delete merged[j.id]);
        write(key, merged);
      }
    })
  );
}

/* -------------------------------- Supabase -------------------------------- */

export function cloudConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return { url, key, source: 'build' };
  const saved = read(KEYS.cloud, null);
  return saved?.url && saved?.key ? { ...saved, source: 'device' } : null;
}

export function setCloudConfig(cfg) {
  if (cfg) write(KEYS.cloud, { url: cfg.url.trim(), key: cfg.key.trim() });
  else {
    localStorage.removeItem(KEYS.cloud);
    idbSet(KEYS.cloud, null);
  }
  clientPromise = null;
}

export const isCloud = () => !!cloudConfig();

let clientPromise = null;

export function getSupabase() {
  const cfg = cloudConfig();
  if (!cfg) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(cfg.url, cfg.key, { auth: { persistSession: false } }))
      .catch(() => null);
  }
  return clientPromise;
}

async function cloud(fn) {
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    return await fn(sb);
  } catch (e) {
    console.warn('[database] cloud sync failed', e);
    return null;
  }
}

export async function testCloud(cfg) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(cfg.url.trim(), cfg.key.trim(), { auth: { persistSession: false } });
    const { error } = await sb.rpc('identity_available', { p_username: '__probe__', p_phone: null, p_email: null });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Could not reach Supabase' };
  }
}

/* ------------------------------- identity -------------------------------- */

export const MIN_AGE = 16;

export const normalizeUsername = (u) => (u || '').trim().replace(/^@+/, '').toLowerCase();
export const validUsername = (u) => /^[a-z0-9_.]{3,20}$/.test(u);
export const normalizeEmail = (e) => (e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const normalizePhone = (prefix, number) => {
  const digits = (number || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${prefix}${digits}` : '';
};
export const validPhone = (p) => /^\+\d{8,15}$/.test(p);

export function ageFromDob(dob) {
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

async function hashSecret(identifier, password) {
  const text = `useus:v1:${identifier}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `fnv${(h >>> 0).toString(16)}`;
}

const uuid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const emptyStats = () => ({ xp: 0, missions: 0, secretWins: 0, rounds: 0, chickened: 0 });

/* -------------------------------- accounts -------------------------------- */

const accounts = () => read(KEYS.accounts, {});

function saveLocal(account) {
  const stamped = { ...account, updatedAt: Date.now() };
  write(KEYS.accounts, { ...accounts(), [account.id]: stamped });
  return stamped;
}

export const publicProfile = (a) => ({ id: a.id, username: a.username, name: a.name });

const toRow = (a) => ({
  id: a.id,
  username: a.username,
  name: a.name,
  phone: a.phone || null,
  email: a.email || null,
  dob: a.dob,
  pass_hash: a.passHash,
  xp: a.stats.xp,
  missions_completed: a.stats.missions,
  secret_wins: a.stats.secretWins,
  rounds_played: a.stats.rounds,
  chickened: a.stats.chickened,
  squad_history: a.history,
  aesthetics: a.aesthetics,
  theme: a.theme,
  created_at: a.createdAt,
  updated_at: new Date().toISOString(),
});

const fromRow = (r, passHash) => ({
  id: r.id,
  username: r.username,
  name: r.name,
  phone: r.phone,
  email: r.email,
  dob: r.dob,
  passHash,
  createdAt: r.created_at,
  stats: {
    xp: r.xp || 0,
    missions: r.missions_completed || 0,
    secretWins: r.secret_wins || 0,
    rounds: r.rounds_played || 0,
    chickened: r.chickened || 0,
  },
  history: r.squad_history || [],
  aesthetics: r.aesthetics?.length ? r.aesthetics : ['none'],
  theme: r.theme || 'none',
  friends: [],
});

const identifierOf = (a) => a.phone || a.email;

async function pushAccount(account) {
  await cloud(async (sb) => {
    const { error } = await sb.from('accounts').update(toRow(account)).eq('id', account.id);
    if (error) throw error;
  });
}

export async function signUp({ name, username: rawUsername, method, phone, email, password, dob }) {
  const username = normalizeUsername(rawUsername);
  const cleanName = (name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (cleanName.length < 2) throw new Error('Enter your full name.');
  if (!validUsername(username)) throw new Error('Usernames are 3–20 characters: letters, numbers, _ or .');
  if (method === 'phone' && !validPhone(phone)) throw new Error('Enter a valid phone number.');
  if (method === 'email' && !validEmail(email)) throw new Error('Enter a valid email address.');
  if ((password || '').length < 4) throw new Error('Your PIN or password needs at least 4 characters.');
  if (!dob) throw new Error('Enter your date of birth.');
  if (ageFromDob(dob) < MIN_AGE) {
    const err = new Error(`You must be at least ${MIN_AGE} years old to play USEus.`);
    err.code = 'underage';
    throw err;
  }

  const identifier = method === 'phone' ? phone : email;
  const local = Object.values(accounts());
  if (local.some((a) => a.username === username)) throw new Error(`@${username} is already taken.`);
  if (local.some((a) => identifierOf(a) === identifier))
    throw new Error(`An account with this ${method === 'phone' ? 'phone number' : 'email'} already exists. Log in instead.`);
  if (Object.values(read(KEYS.known, {})).some((p) => p.username === username)) throw new Error(`@${username} is already taken.`);

  const taken = await cloud(async (sb) => {
    const { data, error } = await sb.rpc('identity_available', {
      p_username: username,
      p_phone: method === 'phone' ? phone : null,
      p_email: method === 'email' ? email : null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  });
  if (taken?.username_taken) throw new Error(`@${username} is already taken.`);
  if (taken?.phone_taken) throw new Error('An account with this phone number already exists. Log in instead.');
  if (taken?.email_taken) throw new Error('An account with this email already exists. Log in instead.');

  const account = {
    id: uuid(),
    username,
    name: cleanName,
    phone: method === 'phone' ? phone : null,
    email: method === 'email' ? email : null,
    dob,
    passHash: await hashSecret(identifier, password),
    createdAt: new Date().toISOString(),
    stats: emptyStats(),
    history: [],
    aesthetics: ['none'],
    theme: 'none',
    friends: [],
  };

  const sb = await getSupabase();
  if (sb) {
    let synced = false;
    try {
      const { error } = await sb.from('accounts').insert(toRow(account));
      if (error?.code === '23505') throw Object.assign(new Error('That username, phone or email is already registered.'), { duplicate: true });
      if (error) console.warn('[database] account insert failed', error);
      else synced = true;
    } catch (e) {
      if (e.duplicate) throw e;
      console.warn('[database] account insert failed', e);
    }
    // Cloud configured but unreachable: keep the account locally and sync it on next login.
    if (!synced) account.pendingSync = true;
  }

  const saved = saveLocal(account);
  write(KEYS.session, saved.id);
  return saved;
}

export async function logIn({ method, phone, email, password }) {
  const identifier = method === 'phone' ? phone : normalizeEmail(email);
  if (!identifier) throw new Error(method === 'phone' ? 'Enter your phone number.' : 'Enter your email.');
  const hash = await hashSecret(identifier, password);

  const row = await cloud(async (sb) => {
    const { data, error } = await sb.rpc('login_account', { p_identifier: identifier, p_pass_hash: hash });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  });

  let account = null;
  if (row) {
    const existing = accounts()[row.id];
    account = { ...existing, ...fromRow(row, hash), friends: existing?.friends || [] };
    account.friends = await loadFriendIds(account.id, account.friends);
  } else {
    account = Object.values(accounts()).find((a) => identifierOf(a) === identifier && a.passHash === hash) || null;
  }
  if (!account) {
    const exists = Object.values(accounts()).some((a) => identifierOf(a) === identifier);
    if (exists) throw new Error('Wrong PIN or password.');
    throw new Error(isCloud() ? 'No account matches those details.' : 'No account with those details on this device yet.');
  }
  if (account.pendingSync) await syncPending(account);
  const saved = saveLocal(account);
  write(KEYS.session, saved.id);
  return saved;
}

async function syncPending(account) {
  const ok = await cloud(async (sb) => {
    const { error } = await sb.from('accounts').upsert(toRow(account));
    if (error) throw error;
    return true;
  });
  if (ok) {
    delete account.pendingSync;
    const stored = accounts()[account.id];
    if (stored) {
      delete stored.pendingSync;
      write(KEYS.accounts, { ...accounts(), [account.id]: stored });
    }
  }
}

export const currentAccount = () => {
  const id = read(KEYS.session, null);
  return id ? accounts()[id] || null : null;
};

// Signing out only ends the session — the account itself stays until it is deleted.
export const signOut = () => write(KEYS.session, null);

/* ---------------------------- account deletion ---------------------------- */

// Cloud half of a deletion. true = erased (or never uploaded), null = try again later.
async function deleteCloudAccount(job) {
  const sb = await getSupabase();
  if (!sb) return true; // no cloud configured: nothing stored remotely
  try {
    const { data, error } = await sb.rpc('delete_account', { p_id: job.id, p_identifier: job.identifier, p_pass_hash: job.passHash });
    if (error) throw error;
    return data === true || data === false; // false: the cloud never had this account
  } catch (e) {
    console.warn('[database] cloud deletion pending', e);
    return null;
  }
}

// Permanently deletes an account: cloud row, friendships, hosted rooms and logs, and
// every local copy (LocalStorage + IndexedDB). Returns { cloud: 'done' | 'pending' }.
export async function deleteAccount(account) {
  const job = { id: account.id, identifier: identifierOf(account), passHash: account.passHash, username: account.username, at: Date.now() };
  const done = await deleteCloudAccount(job);
  if (!done) await write(KEYS.deletions, [...read(KEYS.deletions, []).filter((j) => j.id !== job.id), job]);

  const all = accounts();
  delete all[account.id];
  await Promise.all([write(KEYS.accounts, all), write(KEYS.session, null)]);
  write(
    KEYS.applied,
    read(KEYS.applied, []).filter((k) => !k.startsWith(`${account.id}|`))
  );
  const rooms = read(KEYS.rooms, {});
  const hosted = Object.keys(rooms).filter((code) => rooms[code].hostId === account.id);
  hosted.forEach((code) => delete rooms[code]);
  Object.values(rooms).forEach((r) => {
    if (r.scores) delete r.scores[account.username];
  });
  write(KEYS.rooms, rooms);
  write(
    KEYS.logs,
    read(KEYS.logs, [])
      .filter((l) => !hosted.includes(l.room))
      .map((l) => ({ ...l, players: (l.players || []).filter((u) => u !== account.username) }))
  );
  write(
    KEYS.reports,
    read(KEYS.reports, []).filter((r) => r.reporterId !== account.id)
  );
  // Last account on this phone: also clear what the device remembers about other players.
  if (!Object.keys(all).length) {
    await Promise.all([KEYS.known, KEYS.visited, KEYS.blocked].map((key) => write(key, {})));
  }
  return { cloud: done ? 'done' : 'pending' };
}

// Retries cloud deletions that couldn't finish (offline, or a project on the old schema).
export async function retryPendingDeletions() {
  const jobs = read(KEYS.deletions, []);
  if (!jobs.length) return;
  const left = [];
  for (const job of jobs) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await deleteCloudAccount(job))) left.push(job);
  }
  write(KEYS.deletions, left);
}

export const pendingDeletions = () => read(KEYS.deletions, []).length;

/* --------------------------- block / report ------------------------------ */

export const blockedUsers = () => read(KEYS.blocked, {});
export const isBlocked = (username) => !!username && !!blockedUsers()[username];

export function blockUser(player) {
  write(KEYS.blocked, { ...blockedUsers(), [player.username]: { id: player.id, name: player.name, at: Date.now() } });
}

export function unblockUser(username) {
  const all = blockedUsers();
  delete all[username];
  write(KEYS.blocked, all);
}

export const REPORT_REASONS = [
  ['harassment', 'Harassment or bullying'],
  ['inappropriate', 'Inappropriate or sexual content'],
  ['cheating', 'Cheating or griefing'],
  ['underage', 'Under 16'],
  ['spam', 'Spam or impersonation'],
  ['other', 'Something else'],
];

// Logs a report on this device and in the cloud `reports` table (write-only for clients).
export async function reportUser({ reporter, player, reason, details, room }) {
  const entry = {
    reporterId: reporter?.id || null,
    reporterUsername: reporter?.username || null,
    reportedId: player.id || null,
    reportedUsername: player.username,
    reason,
    details: (details || '').trim().slice(0, 500) || null,
    room: room || null,
    at: Date.now(),
    uploaded: false,
  };
  const ok = await cloud(async (sb) => {
    const { error } = await sb.from('reports').insert({
      reporter_id: entry.reporterId,
      reporter_username: entry.reporterUsername,
      reported_id: entry.reportedId,
      reported_username: entry.reportedUsername,
      reason: entry.reason,
      details: entry.details,
      room_code: entry.room,
    });
    if (error) throw error;
    return true;
  });
  entry.uploaded = !!ok;
  write(KEYS.reports, [entry, ...read(KEYS.reports, [])].slice(0, 100));
  return entry;
}

// Re-reads the account from the cloud (another phone may have played since).
export async function refreshAccount(account) {
  const identifier = identifierOf(account);
  const row = await cloud(async (sb) => {
    const { data, error } = await sb.rpc('login_account', { p_identifier: identifier, p_pass_hash: account.passHash });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  });
  // `undefined` = the cloud answered but has no such account (created before the cloud
  // was connected): upload it so the same login works on every device. `null` = offline.
  if (account.pendingSync || (row === undefined && isCloud())) await syncPending(account);
  if (!row) return accounts()[account.id] || account;
  const friends = await loadFriendIds(account.id, account.friends || []);
  return saveLocal({ ...accounts()[account.id], ...fromRow(row, account.passHash), friends });
}

export async function setTheme(account, theme) {
  if (!account.aesthetics.includes(theme)) return account;
  const saved = saveLocal({ ...account, theme });
  await pushAccount(saved);
  return saved;
}

// Applies one round's results to an account exactly once.
export async function applyRoundStats(accountId, roundKey, delta, entry, unlock) {
  const applied = read(KEYS.applied, []);
  const key = `${accountId}|${roundKey}`;
  if (applied.includes(key)) return null;
  write(KEYS.applied, [...applied, key].slice(-300));
  const account = accounts()[accountId];
  if (!account) return null;
  const stats = { ...emptyStats(), ...account.stats };
  Object.entries(delta).forEach(([k, v]) => {
    stats[k] = (stats[k] || 0) + v;
  });
  const aesthetics = unlock && !account.aesthetics.includes(unlock) ? [...account.aesthetics, unlock] : account.aesthetics;
  const saved = saveLocal({ ...account, stats, aesthetics, history: [entry, ...(account.history || [])].slice(0, 50) });
  await pushAccount(saved);
  return saved;
}

/* ------------------------------ squad / friends --------------------------- */

export function rememberPlayers(players, myId) {
  const known = read(KEYS.known, {});
  players
    .filter((p) => p.id !== myId)
    .forEach((p) => {
      known[p.id] = { ...publicProfile(p), seenAt: Date.now() };
    });
  write(KEYS.known, known);
}

export const knownPlayers = () => Object.values(read(KEYS.known, {})).sort((a, b) => b.seenAt - a.seenAt);

async function loadFriendIds(accountId, fallback) {
  const rows = await cloud(async (sb) => {
    const { data, error } = await sb.from('friendships').select('friend_id').eq('account_id', accountId);
    if (error) throw error;
    return data;
  });
  if (!rows) return fallback;
  return [...new Set([...fallback, ...rows.map((r) => r.friend_id)])];
}

// Public profiles for a list of ids (cloud first, then players met in rooms).
export async function profilesFor(ids) {
  if (!ids.length) return [];
  const known = read(KEYS.known, {});
  const rows = await cloud(async (sb) => {
    const { data, error } = await sb.from('accounts').select('id,username,name').in('id', ids);
    if (error) throw error;
    return data;
  });
  const byId = Object.fromEntries((rows || []).map((r) => [r.id, r]));
  return ids.map((id) => byId[id] || known[id]).filter(Boolean);
}

export async function searchPeople(query, me) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const asPhone = q.replace(/[^\d+]/g, '');
  const results = new Map();
  knownPlayers()
    .filter((p) => p.username.includes(normalizeUsername(q)) || p.name.toLowerCase().includes(q))
    .forEach((p) => results.set(p.id, p));
  const rows = await cloud(async (sb) => {
    const { data, error } = await sb.rpc('find_accounts', { p_query: q.startsWith('+') ? asPhone : q });
    if (error) throw error;
    return data;
  });
  (rows || []).forEach((r) => results.set(r.id, { id: r.id, username: r.username, name: r.name }));
  results.delete(me.id);
  return [...results.values()].slice(0, 20);
}

export async function addFriend(account, person) {
  if (account.friends?.includes(person.id)) return account;
  const known = read(KEYS.known, {});
  if (!known[person.id]) write(KEYS.known, { ...known, [person.id]: { ...publicProfile(person), seenAt: Date.now() } });
  const saved = saveLocal({ ...account, friends: [...(account.friends || []), person.id] });
  await cloud(async (sb) => {
    const { error } = await sb.from('friendships').upsert(
      [
        { account_id: account.id, friend_id: person.id },
        { account_id: person.id, friend_id: account.id },
      ],
      { onConflict: 'account_id,friend_id', ignoreDuplicates: true }
    );
    if (error) throw error;
  });
  return saved;
}

/* ---------------------------------- rooms --------------------------------- */

export const getRoom = (code) => read(KEYS.rooms, {})[code] || null;

export async function loadRoom(code) {
  const local = getRoom(code);
  if (local) return local;
  const row = await cloud(async (sb) => {
    const { data, error } = await sb.from('rooms').select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    return data;
  });
  return row
    ? { hostId: row.host_id, dna: row.dna, scores: row.scores, category: row.category, packName: row.pack_name, updatedAt: Date.parse(row.updated_at) }
    : null;
}

export async function saveRoom(code, data) {
  const rooms = read(KEYS.rooms, {});
  const record = { ...rooms[code], ...data, updatedAt: Date.now() };
  write(KEYS.rooms, { ...rooms, [code]: record });
  await cloud(async (sb) => {
    const { error } = await sb.from('rooms').upsert({
      code,
      host_id: record.hostId,
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

export function rememberVisit(code, dna) {
  const visited = read(KEYS.visited, {});
  write(KEYS.visited, { ...visited, [code]: { dna, at: Date.now() } });
}

// Rooms this player hosted or joined, newest first.
export function roomBadges(accountId) {
  const hosted = Object.entries(read(KEYS.rooms, {}))
    .filter(([, r]) => r.hostId === accountId)
    .map(([code, r]) => ({ code, dna: r.dna, at: r.updatedAt, hosted: true }));
  const visited = Object.entries(read(KEYS.visited, {})).map(([code, r]) => ({ code, dna: r.dna, at: r.at, hosted: false }));
  const byCode = new Map();
  [...visited, ...hosted].forEach((r) => byCode.set(r.code, r));
  return [...byCode.values()].sort((a, b) => b.at - a.at);
}

export async function recordMission(entry) {
  write(KEYS.logs, [entry, ...read(KEYS.logs, [])].slice(0, 200));
  await cloud(async (sb) => {
    const { error } = await sb.from('mission_logs').insert({
      room_code: entry.room,
      mission_id: entry.missionId,
      game: entry.game,
      location: entry.location,
      category: entry.category,
      outcome: entry.outcome,
      saboteur_won: entry.saboteurWon,
      players: entry.players,
    });
    if (error) throw error;
  });
}
