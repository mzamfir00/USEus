import { useCallback, useEffect, useRef, useState } from 'react';
import { openClient, openHost } from '../lib/net';
import {
  applyRoundStats,
  loadRoom,
  publicProfile,
  recordMission,
  rememberPlayers,
  rememberVisit,
  saveRoom,
} from '../lib/database';
import { createRoom, reduce, viewFor } from '../game/engine';
import { GAMES } from '../game/games';
import { MAX_PLAYERS } from '../game/constants';

const HEARTBEAT_MS = 3000;
const PEER_TIMEOUT_MS = 15000;
const HOST_SILENCE_MS = 11000;

const randomCode = () => String(1000 + Math.floor(Math.random() * 9000));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ERRORS = {
  'no-room': 'No room with that code is live right now.',
  full: 'That room is full (8 players max).',
  'same-account': 'You are already in this room on another phone.',
  timeout: 'Could not reach the room. Check your connection and try again.',
};

export const errorText = (reason) =>
  ERRORS[reason] || (reason?.startsWith('p2p:') ? `Connection failed (${reason.slice(4)}).` : reason || 'Something went wrong.');

// status: idle | connecting | live | reconnecting | ended | kicked | error
export function useRoom(profile, onProfileUpdate) {
  const [status, setStatus] = useState('idle');
  const [role, setRole] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [transport, setTransport] = useState(null);
  const [media, setMedia] = useState({}); // shot id -> image data URL
  const mediaSpin = useRef(null);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const onProfileRef = useRef(onProfileUpdate);
  onProfileRef.current = onProfileUpdate;

  const sessionRef = useRef(0); // invalidates callbacks from a previous room
  const offsetRef = useRef(0);
  const host = useRef(null); // { bus, game, conns, lastSeen, timers, savedKey }
  const client = useRef(null); // { bus, code, lastStateAt, timers, closing }

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  /* ------------------------------ shared ---------------------------------- */

  const seenRef = useRef({ players: '', roundKey: null, dna: '' });
  const afterView = useCallback((v) => {
    const me = profileRef.current;
    const sig = v.players.map((p) => p.id).join(',');
    if (sig !== seenRef.current.players) {
      seenRef.current.players = sig;
      rememberPlayers(v.players, me?.id);
    }
    const dnaSig = `${v.code}:${v.dna.completed}`;
    if (v.hostId !== me?.id && dnaSig !== seenRef.current.dna) {
      seenRef.current.dna = dnaSig;
      rememberVisit(v.code, v.dna);
    }
    const res = v.results;
    if (me && res?.stats?.[me.id] && res.roundKey !== seenRef.current.roundKey) {
      seenRef.current.roundKey = res.roundKey;
      const r = v.round;
      const entry = {
        room: v.code,
        mission: GAMES[r.game]?.name,
        game: r.game,
        location: r.location || null,
        result: res.headline,
        won: res.winners.includes(me.id),
        at: Date.now(),
        squad: v.players.filter((p) => r.participants.includes(p.id)).map((p) => p.name),
      };
      applyRoundStats(me.id, res.roundKey, res.stats[me.id], entry, res.unlock).then((updated) => {
        if (updated) onProfileRef.current?.(updated);
      });
    }
  }, []);

  /* ------------------------------- host ----------------------------------- */

  const broadcast = useCallback(() => {
    const h = host.current;
    if (!h) return;
    const now = Date.now();
    h.conns.forEach((pid, connId) => h.bus.send(connId, { t: 'state', v: viewFor(h.game, pid, now) }));
    setView(viewFor(h.game, h.game.hostId, now));
  }, []);

  const persist = useCallback((prev, next) => {
    const me = profileRef.current;
    const h = host.current;
    if (h && next.round?.spinId !== prev.round?.spinId) {
      h.media.clear();
      setMedia({});
    }
    const record = { hostId: me.id, dna: next.dna, scores: next.scores, settings: { ...next.settings, starter: null } };
    if (next.results && next.results.roundKey !== prev.results?.roundKey) {
      const r = next.round;
      saveRoom(next.code, record);
      recordMission({
        room: next.code,
        missionId: r.data.missionId || null,
        game: r.game,
        location: r.location || null,
        category: r.arena,
        outcome: next.results.outcome,
        saboteurWon: !!next.results.reveal?.saboteur && next.results.winners.includes(next.results.reveal.saboteur),
        players: next.players.filter((p) => r.participants.includes(p.id)).map((p) => p.username),
      });
    } else if (JSON.stringify(next.settings) !== JSON.stringify(prev.settings)) {
      saveRoom(next.code, record);
    }
  }, []);

  const dispatch = useCallback(
    (actorId, action) => {
      const h = host.current;
      if (!h) return;
      if (action.type === 'remove') {
        h.conns.forEach((pid, connId) => {
          if (pid === action.id) {
            h.bus.send(connId, { t: 'kicked' });
            h.conns.delete(connId);
          }
        });
      }
      const next = reduce(h.game, actorId, action);
      if (next === h.game) return;
      const prev = h.game;
      h.game = next;
      persist(prev, next);
      broadcast();
    },
    [broadcast, persist]
  );

  // Photos travel once as separate media messages instead of inside every state heartbeat.
  const hostIntent = useCallback(
    (actorId, action) => {
      const h = host.current;
      if (!h) return;
      // Any intent carrying a photo (paparazzi shots, lava proofs): strip the image, apply
      // the intent, and only if it was accepted share the photo once with every phone.
      if (typeof action.img === 'string') {
        const { img, ...rest } = action;
        const id = String(rest.mediaId || rest.id || '').slice(0, 32);
        const before = h.game.seq;
        dispatch(actorId, { ...rest, ...(rest.type === 'shot' ? { id } : { mediaId: id }) });
        if (id && img.length < 400000 && h.game.seq !== before && !h.media.has(id)) {
          h.media.set(id, img);
          h.conns.forEach((pid, connId) => h.bus.send(connId, { t: 'media', id, img }));
          setMedia((m) => ({ ...m, [id]: img }));
        }
        return;
      }
      dispatch(actorId, action);
    },
    [dispatch]
  );

  const onHostData = useCallback(
    (connId, msg) => {
      const h = host.current;
      if (!h || !msg) return;
      if (msg.t === 'hello' && msg.player?.id && msg.player?.username) {
        const p = msg.player;
        if (p.id === profileRef.current.id) {
          h.bus.send(connId, { t: 'denied', reason: 'same-account' });
          return;
        }
        const known = h.game.players.some((x) => x.id === p.id);
        if (!known && h.game.players.length >= MAX_PLAYERS) {
          h.bus.send(connId, { t: 'denied', reason: 'full' });
          return;
        }
        // A rejoin replaces the player's old connection.
        h.conns.forEach((pid, cid) => pid === p.id && cid !== connId && h.conns.delete(cid));
        h.conns.set(connId, p.id);
        h.lastSeen.set(p.id, Date.now());
        dispatch(p.id, {
          type: 'join',
          player: { id: p.id, username: p.username, name: p.name },
        });
        broadcast(); // make sure the newcomer gets a view even if nothing changed
        h.media.forEach((img, id) => h.bus.send(connId, { t: 'media', id, img }));
        return;
      }
      const pid = h.conns.get(connId);
      if (!pid) return;
      h.lastSeen.set(pid, Date.now());
      if (msg.t === 'intent' && msg.a?.type) hostIntent(pid, msg.a);
      if (msg.t === 'bye') {
        h.conns.delete(connId);
        dispatch(pid, { type: 'leave', id: pid });
      }
    },
    [broadcast, dispatch, hostIntent]
  );

  const stopHost = useCallback(() => {
    const h = host.current;
    if (!h) return;
    h.timers.forEach(clearInterval);
    h.bus?.close();
    host.current = null;
  }, []);

  const tryHost = useCallback(
    (code, session) =>
      new Promise((resolve) => {
        let p2p = null; // 'ok' | 'taken' | 'error'
        let cloud = false;
        const kinds = new Set();
        const attempt = host.current;
        let settled = false;
        const settle = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const check = () => {
          if (p2p === 'ok') settle('ok');
          else if (p2p === 'taken') settle('taken');
          else if (p2p === 'error' && cloud) settle('ok');
          else if (p2p === 'error' && !cloud) setTimeout(() => settle(cloud ? 'ok' : 'error'), 4000);
        };
        const handlers = {
          onReady: (kind) => {
            if (sessionRef.current !== session) return;
            if (kind === 'p2p') p2p = 'ok';
            else cloud = true;
            kinds.add(kind);
            setTransport([...kinds].sort().reverse().join('+'));
            check();
          },
          onError: (reason) => {
            if (sessionRef.current !== session) return;
            if (!settled) {
              p2p = reason === 'taken' ? 'taken' : 'error';
              check();
            } else console.warn('[room] host transport error', reason);
          },
          onConnect: () => {},
          onData: (connId, msg) => sessionRef.current === session && onHostData(connId, msg),
          onClose: (connId) => {
            const h = host.current;
            if (!h || sessionRef.current !== session) return;
            const pid = h.conns.get(connId);
            h.conns.delete(connId);
            if (pid && ![...h.conns.values()].includes(pid)) dispatch(pid, { type: 'disconnect', id: pid });
          },
        };
        attempt.bus = openHost(code, handlers);
        setTimeout(() => settle(cloud ? 'ok' : p2p === 'taken' ? 'taken' : 'error'), 12000);
      }),
    [dispatch, onHostData]
  );

  const createAndHost = useCallback(
    async (preferredCode) => {
      const me = profileRef.current;
      sessionRef.current += 1;
      const session = sessionRef.current;
      setRole('host');
      setStatus('connecting');
      setError('');
      setView(null);
      setTransport(null);
      offsetRef.current = 0;

      let code = preferredCode || randomCode();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const saved = await loadRoom(code);
        const mine = saved && saved.hostId === me.id ? saved : null;
        if (saved && !mine) {
          code = randomCode(); // someone else's room code
          continue;
        }
        host.current = {
          bus: null,
          game: createRoom({ code, host: publicProfile(me), saved: mine }),
          conns: new Map(),
          lastSeen: new Map(),
          media: new Map(),
          timers: [],
        };
        const result = await tryHost(code, session);
        if (sessionRef.current !== session) return;
        if (result === 'ok') {
          const h = host.current;
          saveRoom(code, { hostId: me.id, dna: h.game.dna, scores: h.game.scores, category: h.game.category, packName: h.game.packName });
          h.timers.push(
            setInterval(() => {
              dispatch(h.game.hostId, { type: 'tick' });
              const now = Date.now();
              h.game.players.forEach((p) => {
                if (!p.isHost && p.connected && now - (h.lastSeen.get(p.id) || 0) > PEER_TIMEOUT_MS) {
                  dispatch(p.id, { type: 'disconnect', id: p.id });
                }
              });
            }, 1000),
            setInterval(broadcast, HEARTBEAT_MS)
          );
          setStatus('live');
          broadcast();
          return;
        }
        stopHost();
        if (result === 'taken') {
          // Our own room may still be registered from a previous session: retry briefly.
          if (preferredCode && attempt < 2) await wait(3000);
          else code = randomCode();
          continue;
        }
        setStatus('error');
        setError('Could not open a room. The P2P signalling server is unreachable — check your connection.');
        return;
      }
      setStatus('error');
      setError('Could not reserve a room code. Try again.');
    },
    [broadcast, dispatch, stopHost, tryHost]
  );

  /* ------------------------------- client --------------------------------- */

  const stopClient = useCallback((sayBye) => {
    const c = client.current;
    if (!c) return;
    c.closing = true;
    c.timers.forEach(clearInterval);
    if (sayBye) c.bus?.send({ t: 'bye' });
    const bus = c.bus;
    setTimeout(() => bus?.close(), sayBye ? 300 : 0);
    client.current = null;
  }, []);

  const connectClient = useCallback(
    async (code, session, isRetry) => {
      const me = profileRef.current;
      const c = { bus: null, code, lastStateAt: Date.now(), timers: [], closing: false, opened: false };
      client.current = c;

      const reconnect = () => {
        if (c.closing || sessionRef.current !== session) return;
        c.closing = true;
        c.timers.forEach(clearInterval);
        c.bus?.close();
        setStatus('reconnecting');
        setTimeout(() => sessionRef.current === session && connectClient(code, session, true), 2500);
      };

      const bus = await openClient(code, {
        onOpen: (kind) => {
          c.opened = true;
          setTransport(kind);
          setTimeout(() => c.bus?.send({ t: 'hello', player: publicProfile(me) }), 0);
        },
        onData: (msg) => {
          if (c.closing || sessionRef.current !== session || !msg) return;
          if (msg.t === 'state') {
            c.lastStateAt = Date.now();
            offsetRef.current = msg.v.now - Date.now();
            if (msg.v.round?.spinId !== mediaSpin.current) {
              mediaSpin.current = msg.v.round?.spinId;
              setMedia({});
            }
            setView(msg.v);
            setStatus('live');
            afterView(msg.v);
          } else if (msg.t === 'media' && typeof msg.img === 'string') {
            setMedia((m) => ({ ...m, [msg.id]: msg.img }));
          } else if (msg.t === 'denied') {
            stopClient(false);
            setStatus('error');
            setError(errorText(msg.reason));
          } else if (msg.t === 'kicked') {
            stopClient(false);
            setStatus('kicked');
          }
        },
        onClose: reconnect,
        onError: (reason) => {
          if (sessionRef.current !== session || c.closing) return;
          if (!c.opened && !isRetry) {
            stopClient(false);
            setStatus('error');
            setError(errorText(reason));
          } else if (!c.opened && reason === 'no-room') {
            stopClient(false);
            setStatus('ended');
          } else reconnect();
        },
      });
      if (c.closing || sessionRef.current !== session) {
        bus.close();
        return;
      }
      c.bus = bus;
      c.timers.push(
        setInterval(() => {
          c.bus?.send({ t: 'ping' });
          if (c.opened && Date.now() - c.lastStateAt > HOST_SILENCE_MS) reconnect();
        }, HEARTBEAT_MS)
      );
    },
    [afterView, stopClient]
  );

  const join = useCallback(
    (code) => {
      sessionRef.current += 1;
      setRole('client');
      setStatus('connecting');
      setError('');
      setView(null);
      setTransport(null);
      connectClient(code, sessionRef.current, false);
    },
    [connectClient]
  );

  /* ------------------------------- public --------------------------------- */

  const leave = useCallback(() => {
    sessionRef.current += 1;
    stopHost();
    stopClient(true);
    setStatus('idle');
    setRole(null);
    setView(null);
    setMedia({});
    setError('');
  }, [stopClient, stopHost]);

  const intent = useCallback(
    (action) => {
      if (host.current) hostIntent(host.current.game.hostId, action);
      else client.current?.bus?.send({ t: 'intent', a: action });
    },
    [hostIntent]
  );

  // Host: same bookkeeping as clients (known players, own stats once per round).
  useEffect(() => {
    if (role === 'host' && view) afterView(view);
  }, [role, view, afterView]);

  useEffect(() => {
    const bye = () => client.current?.bus?.send({ t: 'bye' });
    window.addEventListener('pagehide', bye);
    return () => {
      window.removeEventListener('pagehide', bye);
      sessionRef.current += 1;
      stopHost();
      stopClient(true);
    };
  }, [stopClient, stopHost]);

  return { status, role, view, media, error, transport, serverNow, host: createAndHost, join, leave, intent };
}
