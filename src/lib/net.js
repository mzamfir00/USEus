// Room transport. The host phone listens on every available transport at once:
//   1. PeerJS (WebRTC data channels, zero-config, always on)
//   2. Supabase Realtime broadcast (only when Supabase is configured)
// A joining phone tries Supabase first (if configured and a host answers), else PeerJS.
// Both expose the same tiny interface, so the game layer never knows which one is used.

import Peer from 'peerjs';
import { getSupabase } from './db';

const PREFIX = 'squadroulette-v2-room-';

// STUN for direct connections plus a public TURN relay as a fallback for strict
// mobile-carrier NATs.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

// Optional self-hosted PeerServer, e.g. localStorage['sr.peerServer'] =
// '{"host":"localhost","port":9000,"path":"/","secure":false}'
function peerOptions() {
  let server = null;
  try {
    server = JSON.parse(localStorage.getItem('sr.peerServer') || 'null');
  } catch (e) {
    server = null;
  }
  return { ...(server || {}), debug: 0, config: { iceServers: ICE_SERVERS } };
}

/* -------------------------------- PeerJS --------------------------------- */

function hostPeer(code, h) {
  const peer = new Peer(PREFIX + code, peerOptions());
  const conns = new Map();
  let destroyed = false;

  peer.on('open', () => h.onReady('p2p'));
  peer.on('error', (err) => h.onError(err.type === 'unavailable-id' ? 'taken' : `p2p:${err.type || 'error'}`));
  peer.on('disconnected', () => {
    if (!destroyed) setTimeout(() => !destroyed && peer.reconnect(), 1500);
  });
  peer.on('connection', (conn) => {
    const id = `p:${conn.connectionId}`;
    conn.on('open', () => {
      conns.set(id, conn);
      h.onConnect(id);
    });
    conn.on('data', (d) => h.onData(id, d));
    conn.on('close', () => {
      conns.delete(id);
      h.onClose(id);
    });
    conn.on('error', () => {});
  });

  return {
    send(id, msg) {
      const c = conns.get(id);
      if (c?.open) c.send(msg);
    },
    owns: (id) => id.startsWith('p:'),
    close() {
      destroyed = true;
      peer.destroy();
    },
  };
}

function joinPeer(code, h) {
  const peer = new Peer(undefined, peerOptions());
  let conn = null;
  let opened = false;
  const timeout = setTimeout(() => !opened && h.onError('timeout'), 15000);

  peer.on('open', () => {
    conn = peer.connect(PREFIX + code, { reliable: true });
    conn.on('open', () => {
      opened = true;
      clearTimeout(timeout);
      h.onOpen('p2p');
    });
    conn.on('data', h.onData);
    conn.on('close', h.onClose);
    conn.on('error', () => {});
  });
  peer.on('error', (err) => {
    clearTimeout(timeout);
    h.onError(err.type === 'peer-unavailable' ? 'no-room' : `p2p:${err.type || 'error'}`);
  });

  return {
    kind: 'p2p',
    send(msg) {
      if (conn?.open) conn.send(msg);
    },
    close() {
      clearTimeout(timeout);
      peer.destroy();
    },
  };
}

/* --------------------------- Supabase Realtime --------------------------- */

const subscribe = (channel) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('subscribe timeout')), 8000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t);
        reject(new Error(status));
      }
    });
  });

async function hostSupabase(sb, code, h) {
  const main = sb.channel(`sr-${code}`, { config: { broadcast: { self: false } } });
  const privates = new Map();

  main.on('broadcast', { event: 'probe' }, () => main.send({ type: 'broadcast', event: 'here', payload: {} }));
  main.on('broadcast', { event: 'c2h' }, async ({ payload }) => {
    const id = `s:${payload.cid}`;
    if (!privates.has(id)) {
      const ch = sb.channel(`sr-${code}-${payload.cid}`, { config: { broadcast: { self: false } } });
      privates.set(id, ch);
      try {
        await subscribe(ch);
        h.onConnect(id);
      } catch (e) {
        privates.delete(id);
        return;
      }
    }
    h.onData(id, payload.msg);
    if (payload.msg?.t === 'bye') {
      sb.removeChannel(privates.get(id));
      privates.delete(id);
      h.onClose(id);
    }
  });

  await subscribe(main);
  h.onReady('cloud');

  return {
    send(id, msg) {
      privates.get(id)?.send({ type: 'broadcast', event: 'h2c', payload: msg });
    },
    owns: (id) => id.startsWith('s:'),
    close() {
      sb.removeChannel(main);
      privates.forEach((ch) => sb.removeChannel(ch));
    },
  };
}

// Resolves to a client, or null when no host answers on Supabase.
async function joinSupabase(sb, code, h) {
  const cid = Math.random().toString(36).slice(2, 12);
  const main = sb.channel(`sr-${code}`, { config: { broadcast: { self: false } } });
  const found = new Promise((resolve) => {
    main.on('broadcast', { event: 'here' }, () => resolve(true));
    setTimeout(() => resolve(false), 2500);
  });
  try {
    await subscribe(main);
  } catch (e) {
    sb.removeChannel(main);
    return null;
  }
  main.send({ type: 'broadcast', event: 'probe', payload: {} });
  if (!(await found)) {
    sb.removeChannel(main);
    return null;
  }
  const mine = sb.channel(`sr-${code}-${cid}`, { config: { broadcast: { self: false } } });
  mine.on('broadcast', { event: 'h2c' }, ({ payload }) => h.onData(payload));
  try {
    await subscribe(mine);
  } catch (e) {
    sb.removeChannel(main);
    return null;
  }
  h.onOpen('cloud');
  return {
    kind: 'cloud',
    send(msg) {
      main.send({ type: 'broadcast', event: 'c2h', payload: { cid, msg } });
    },
    close() {
      sb.removeChannel(mine);
      sb.removeChannel(main);
    },
  };
}

/* -------------------------------- Public --------------------------------- */

// handlers: onReady(kind), onError(reason), onConnect(connId), onData(connId, msg), onClose(connId)
// Returns synchronously so connections arriving over P2P are handled while the
// optional Supabase transport is still subscribing.
export function openHost(code, handlers) {
  const buses = [hostPeer(code, handlers)];
  let closed = false;
  getSupabase().then(async (sb) => {
    if (!sb || closed) return;
    try {
      const bus = await hostSupabase(sb, code, handlers);
      if (closed) bus.close();
      else buses.push(bus);
    } catch (e) {
      console.warn('[net] Supabase realtime unavailable, P2P only', e);
    }
  });
  return {
    send: (id, msg) => buses.find((b) => b.owns(id))?.send(id, msg),
    close: () => {
      closed = true;
      buses.forEach((b) => b.close());
    },
  };
}

// handlers: onOpen(kind), onData(msg), onClose(), onError(reason)
export async function openClient(code, handlers) {
  const sb = await getSupabase();
  if (sb) {
    const viaCloud = await joinSupabase(sb, code, handlers).catch(() => null);
    if (viaCloud) return viaCloud;
  }
  return joinPeer(code, handlers);
}
