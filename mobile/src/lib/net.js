// Room transport over Supabase Realtime broadcast — the same channels and events the web
// app uses, so phones running the native app and browsers can share one room.
//   main channel  sr-<code>        probe → here (host discovery), c2h (client → host)
//   per client    sr-<code>-<cid>  h2c (host → that client)
import { getSupabase } from './database';

const realtime = async () => globalThis.__USEUS_TEST_SB__ || getSupabase();

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

const channelFor = (sb, name) => sb.channel(name, { config: { broadcast: { self: false } } });

// Asks the main channel whether a host already answers for this code.
async function codeTaken(main) {
  const answered = new Promise((resolve) => {
    main.on('broadcast', { event: 'here' }, () => resolve(true));
    setTimeout(() => resolve(false), 1800);
  });
  main.send({ type: 'broadcast', event: 'probe', payload: {} });
  return answered;
}

// handlers: onReady(kind), onError(reason), onConnect(connId), onData(connId, msg), onClose(connId)
export function openHost(code, h) {
  let closed = false;
  let sb = null;
  let main = null;
  const privates = new Map();

  (async () => {
    sb = await realtime();
    if (closed) return;
    if (!sb) {
      h.onError('offline');
      return;
    }
    main = channelFor(sb, `sr-${code}`);
    let hosting = false;
    main.on('broadcast', { event: 'probe' }, () => hosting && main.send({ type: 'broadcast', event: 'here', payload: {} }));
    main.on('broadcast', { event: 'c2h' }, async ({ payload }) => {
      if (!hosting || !payload?.cid) return;
      const id = `s:${payload.cid}`;
      if (!privates.has(id)) {
        const ch = channelFor(sb, `sr-${code}-${payload.cid}`);
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
    try {
      await subscribe(main);
    } catch (e) {
      if (!closed) h.onError('offline');
      return;
    }
    if (closed) return;
    if (await codeTaken(main)) {
      if (!closed) h.onError('taken');
      return;
    }
    if (closed) return;
    hosting = true;
    h.onReady('cloud');
  })();

  return {
    send(id, msg) {
      privates.get(id)?.send({ type: 'broadcast', event: 'h2c', payload: msg });
    },
    close() {
      closed = true;
      if (!sb) return;
      if (main) sb.removeChannel(main);
      privates.forEach((ch) => sb.removeChannel(ch));
      privates.clear();
    },
  };
}

// handlers: onOpen(kind), onData(msg), onClose(), onError(reason)
export async function openClient(code, h) {
  const sb = await realtime();
  const noop = { kind: 'cloud', send() {}, close() {} };
  if (!sb) {
    setTimeout(() => h.onError('offline'), 0);
    return noop;
  }
  const cid = Math.random().toString(36).slice(2, 12);
  const main = channelFor(sb, `sr-${code}`);
  const found = new Promise((resolve) => {
    main.on('broadcast', { event: 'here' }, () => resolve(true));
    setTimeout(() => resolve(false), 3500);
  });
  let mine = null;
  const close = () => {
    if (mine) sb.removeChannel(mine);
    sb.removeChannel(main);
  };
  try {
    await subscribe(main);
  } catch (e) {
    close();
    setTimeout(() => h.onError('timeout'), 0);
    return noop;
  }
  main.send({ type: 'broadcast', event: 'probe', payload: {} });
  if (!(await found)) {
    close();
    setTimeout(() => h.onError('no-room'), 0);
    return noop;
  }
  mine = channelFor(sb, `sr-${code}-${cid}`);
  mine.on('broadcast', { event: 'h2c' }, ({ payload }) => h.onData(payload));
  try {
    await subscribe(mine);
  } catch (e) {
    close();
    setTimeout(() => h.onError('timeout'), 0);
    return noop;
  }
  setTimeout(() => h.onOpen('cloud'), 0);
  return {
    kind: 'cloud',
    send(msg) {
      main.send({ type: 'broadcast', event: 'c2h', payload: { cid, msg } });
    },
    close,
  };
}
