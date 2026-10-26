import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { openClient, openHost } from '../lib/net';
import { isOnline, onNetworkChange } from '../lib/network';
import {
  applyRoundStats,
  grantXp,
  isBlocked,
  loadRoom,
  publicProfile,
  recordMission,
  rememberPlayers,
  rememberVisit,
  saveRoom,
} from '../lib/database';
import { GAMES, MAX_PLAYERS, createRoom, reduce, viewFor } from '../core';

const HEARTBEAT_MS = 3000;
const PEER_TIMEOUT_MS = 15000;
const HOST_SILENCE_MS = 11000;
const ROOM_GONE_MS = 60000; // a reachable network and no host this long = the room is gone
const RETRY_MS = 2500;

// Player profiles arrive from other phones: keep them to plain, short strings.
const cleanPlayer = (p) => ({
  id: String(p.id).slice(0, 64),
  username: String(p.username).slice(0, 32),
  name: String(p.name || p.username).slice(0, 40),
});
const validView = (v) => !!v && Array.isArray(v.players) && typeof v.code === 'string' && !!v.dna;

const randomCode = () => String(1000 + Math.floor(Math.random() * 9000));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ERRORS = {
  'no-room': 'No room with that code is live right now.',
  full: 'That room is full (8 players max).',
  'same-account': 'You are already in this room on another phone.',
  removed: 'The host removed you from this room.',
  timeout: 'Could not reach the room. Check your connection and try again.',
  offline: 'USEus could not reach the room server. Check your connection and try again.',
};

export const errorText = (reason) => ERRORS[reason] || reason || 'Something went wrong.';

// status: idle | connecting | live | reconnecting | ended | kicked | error
export function useRoom(profile, onProfileUpdate) {
  const [status, setStatus] = useState('idle');
  const [role, setRole] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [transport, setTransport] = useState(null);
  const [media, setMedia] = useState({}); // shot id -> image data URI (base64 JPEG)
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
    if (!validView(v)) return;
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
    // Post-round 2x XP claim, once the host has credited it.
    const bonus = me && v.bonus?.ids?.[me.id];
    if (bonus) {
      grantXp(me.id, `bonus:${v.bonus.key}`, bonus).then((updated) => {
        if (updated) onProfileRef.current?.(updated);
      });
    }
  }, []);

  /* ------------------------------- host ----------------------------------- */

  const broadcast = useCallback(() => {
    const h = host.current;
    if (!h) return;
    const now = Date.now();
    h.conns.forEach((pid, connId) => {
      try {
        h.bus.send(connId, { t: 'state', v: viewFor(h.game, pid, now) });
      } catch (e) {
        console.warn('[room] view for player failed', e);
      }
    });
    setView(viewFor(h.game, h.game.hostId, now));
  }, []);

  const persist = useCallback((prev, next) => {
    const me = profileRef.current;
    const h = host.current;
    if (h && next.round?.spinId !== prev.round?.spinId) {
      h.media.clear();
      setMedia({});
    }
    // The GPS zone centre is the host's exact position: never persisted (it's re-locked each session).
    const zone = next.settings.zone && { ...next.settings.zone, center: null, sim: false };
    const record = { hostId: me.id, dna: next.dna, scores: next.scores, settings: { ...next.settings, starter: null, zone } };
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
    } else if (JSON.stringify(next.settings) !== JSON.stringify(prev.settings) || JSON.stringify(next.scores) !== JSON.stringify(prev.scores)) {
      saveRoom(next.code, record); // settings changes and post-round 2x XP claims
    }
  }, []);

  const dispatch = useCallback(
    (actorId, action) => {
      const h = host.current;
      if (!h || !action || typeof action.type !== 'string') return;
      if (action.type === 'remove') {
        h.conns.forEach((pid, connId) => {
          if (pid === action.id) {
            h.bus.send(connId, { t: 'kicked' });
            h.conns.delete(connId);
          }
        });
      }
      // One malformed intent (another app version, a bad packet) must never take the room down.
      let next;
      try {
        next = reduce(h.game, actorId, action);
      } catch (e) {
        console.warn('[room] rejected intent', action.type, e);
        return;
      }
      if (!next || next === h.game) return;
      const prev = h.game;
      // Host-only bookkeeping (GPS fixes nobody else can see) skips the broadcast;
      // the 3 s heartbeat still carries it.
      const quiet = next.quiet;
      delete next.quiet;
      h.game = next;
      persist(prev, next);
      if (!quiet) broadcast();
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
        const p = cleanPlayer(msg.player);
        if (p.id === profileRef.current.id) {
          h.bus.send(connId, { t: 'denied', reason: 'same-account' });
          return;
        }
        // Removed by the host, or blocked by the host: not allowed back in.
        if (h.game.banned?.includes(p.id) || isBlocked(p.username)) {
          h.bus.send(connId, { t: 'denied', reason: 'removed' });
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
      if (msg.t === 'intent' && typeof msg.a?.type === 'string') hostIntent(pid, msg.a);
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
    clearTimeout(h.rebindTimer);
    // Tell connected phones the room is closing so they don't wait to reconnect.
    h.conns.forEach((pid, connId) => h.bus?.send(connId, { t: 'closed' }));
    const bus = h.bus;
    setTimeout(() => bus?.close(), h.conns.size ? 300 : 0);
    host.current = null;
  }, []);

  // New network (Wi-Fi → 4G/5G) or back from the background: rebuild the host's channels.
  // Phones keep their connection ids, so play continues as soon as their next message lands.
  const rebindRef = useRef(null);
  const rebindHost = useCallback(() => {
    const h = host.current;
    if (!h?.handlers) return;
    clearTimeout(h.rebindTimer);
    try {
      h.bus?.close();
    } catch (e) {
      /* already closed */
    }
    h.bus = openHost(h.code, {
      ...h.handlers,
      // Still no network (or the server is unreachable): try again shortly.
      onError: (reason) => {
        if (host.current !== h) return;
        console.warn('[room] host channels not back yet', reason);
        h.rebindTimer = setTimeout(() => rebindRef.current?.(), 3000);
      },
    });
  }, []);
  rebindRef.current = rebindHost;

  const tryHost = useCallback(
    (code, session) =>
      new Promise((resolve) => {
        const attempt = host.current;
        let settled = false;
        const settle = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const handlers = {
          onReady: (kind) => {
            if (sessionRef.current !== session) return;
            setTransport(kind);
            settle('ok');
          },
          onError: (reason) => {
            if (sessionRef.current !== session) return;
            if (!settled) settle(reason === 'taken' ? 'taken' : 'error');
            else console.warn('[room] host transport error', reason);
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
        attempt.code = code;
        attempt.handlers = handlers;
        attempt.bus = openHost(code, handlers);
        setTimeout(() => settle('error'), 15000);
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
          game: createRoom({ code, host: publicProfile(me), saved: mine, monetized: true }),
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
        setError(errorText('offline'));
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
    async (code, session, isRetry, retrySince = null) => {
      const me = profileRef.current;
      const c = { bus: null, code, lastStateAt: Date.now(), timers: [], closing: false, opened: false, synced: false };
      client.current = c;

      // Keeps trying (same player id, so the host restores the role, score and timer) until
      // the host answers again. Only a reachable network with no host for a minute ends it.
      const reconnect = (delay = RETRY_MS) => {
        if (c.closing || sessionRef.current !== session) return;
        c.closing = true;
        c.timers.forEach(clearInterval);
        c.bus?.close();
        setStatus('reconnecting');
        const since = c.synced ? Date.now() : retrySince || Date.now();
        setTimeout(() => sessionRef.current === session && connectClient(code, session, true, since), delay);
      };
      c.reconnect = reconnect;

      const bus = await openClient(code, {
        onOpen: (kind) => {
          c.opened = true;
          setTransport(kind);
          setTimeout(() => c.bus?.send({ t: 'hello', player: publicProfile(me) }), 0);
        },
        onData: (msg) => {
          if (c.closing || sessionRef.current !== session || !msg) return;
          if (msg.t === 'state') {
            if (!validView(msg.v)) return;
            c.synced = true;
            c.lastStateAt = Date.now();
            offsetRef.current = msg.v.now - Date.now();
            if (msg.v.round?.spinId !== mediaSpin.current) {
              mediaSpin.current = msg.v.round?.spinId;
              setMedia({});
            }
            setView(msg.v);
            setStatus('live');
            afterView(msg.v);
          } else if (msg.t === 'media' && typeof msg.id === 'string' && typeof msg.img === 'string' && msg.img.length < 400000) {
            setMedia((m) => ({ ...m, [msg.id]: msg.img }));
          } else if (msg.t === 'denied') {
            stopClient(false);
            setStatus('error');
            setError(errorText(msg.reason));
          } else if (msg.t === 'kicked') {
            stopClient(false);
            setStatus('kicked');
          } else if (msg.t === 'closed') {
            stopClient(false);
            setStatus('ended');
          }
        },
        onClose: () => reconnect(),
        onError: (reason) => {
          if (sessionRef.current !== session || c.closing) return;
          if (!c.opened && !isRetry) {
            stopClient(false);
            setStatus('error');
            setError(errorText(reason));
          } else if (!c.opened && reason === 'no-room' && isOnline() && Date.now() - (retrySince || Date.now()) > ROOM_GONE_MS) {
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

  // Force a fresh sync: clients rebuild their channels, hosts rebuild theirs and re-send.
  const resync = useCallback(() => {
    if (host.current) {
      rebindHost();
      broadcast();
    } else client.current?.reconnect?.(0);
  }, [broadcast, rebindHost]);

  useEffect(() => {
    const offNet = onNetworkChange(() => resync());
    let hiddenAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') hiddenAt = Date.now();
      else if (state === 'active' && hiddenAt && Date.now() - hiddenAt > 5000) {
        // The OS may have dropped our sockets while we were away.
        if (host.current) resync();
        else if (client.current && Date.now() - client.current.lastStateAt > HEARTBEAT_MS + 1000) resync();
      }
    });
    return () => {
      offNet();
      sub.remove();
    };
  }, [resync]);

  // Host: same bookkeeping as clients (known players, own stats once per round).
  useEffect(() => {
    if (role === 'host' && view) afterView(view);
  }, [role, view, afterView]);

  useEffect(
    () => () => {
      sessionRef.current += 1;
      stopHost();
      stopClient(true);
    },
    [stopClient, stopHost]
  );

  return { status, role, view, media, error, transport, serverNow, host: createAndHost, join, leave, intent, resync };
}
