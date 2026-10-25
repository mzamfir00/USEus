// Player safety: block (hidden on this phone), report (logged for moderation) and, for the
// host, remove from the room.
import React, { useState, useSyncExternalStore } from 'react';
import { Ban, Check, Flag, UserMinus } from 'lucide-react';
import { blockedUsers, blockUser, REPORT_REASONS, reportUser, unblockUser } from '../lib/database';
import { Avatar, Sheet } from './primitives';

// Re-render whenever the blocklist changes on this phone.
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
let snapshot = JSON.stringify(blockedUsers());
export function useBlocked() {
  const raw = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => snapshot
  );
  return JSON.parse(raw);
}
const refresh = () => {
  snapshot = JSON.stringify(blockedUsers());
  emit();
};

export function ReportForm({ player, reporter, room, onDone }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  if (state === 'sent') {
    return (
      <div className="py-4 text-center" data-report-sent>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
          <Check size={22} />
        </div>
        <div className="headline mt-4 text-[20px]">Report sent</div>
        <p className="muted mt-2 text-[14px] leading-relaxed">Thanks. We review every report within 24 hours. You can also block @{player.username} so you never see them again.</p>
        <button type="button" className="btn btn-primary mt-6" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        await reportUser({ reporter, player, reason, details, room });
        setState('sent');
      }}
    >
      <p className="muted -mt-2 mb-4 text-[14px]">What’s wrong with @{player.username}?</p>
      <div className="card divide overflow-hidden">
        {REPORT_REASONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setReason(id)}
            className={`card-press flex w-full items-center justify-between px-5 py-3.5 text-left text-[15px] ${reason === id ? 'bg-[var(--fg)] text-[var(--bg)]' : ''}`}
          >
            {label}
            {reason === id && <Check size={16} />}
          </button>
        ))}
      </div>
      <textarea
        className="field mt-3 !h-24 resize-none py-3 text-[15px]"
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 500))}
        placeholder="Details (optional)"
        aria-label="Report details"
      />
      <button type="submit" className="btn btn-primary mt-4" disabled={!reason || state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}

// Actions sheet for one player. `onRemove` is only passed to the host.
export function PlayerActions({ player, reporter, room, onRemove, onClose }) {
  const blocked = useBlocked();
  const [mode, setMode] = useState('menu'); // menu | report | block
  const isBlockedNow = !!blocked[player.username];
  return (
    <div className="text-[var(--fg)]">
      <Sheet title={mode === 'report' ? 'Report player' : mode === 'block' ? 'Block player' : null} onClose={onClose}>
        {mode === 'menu' && (
          <>
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={player.name} size={44} />
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold">{player.name}</div>
                <div className="muted text-[14px]">@{player.username}</div>
              </div>
            </div>
            <div className="card divide overflow-hidden text-[15px]">
              {onRemove && (
                <button
                  type="button"
                  className="card-press flex w-full items-center gap-3 px-5 py-4 text-left"
                  onClick={() => {
                    onRemove(player);
                    onClose();
                  }}
                >
                  <UserMinus size={18} /> Remove from room
                </button>
              )}
              <button type="button" className="card-press flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setMode('report')}>
                <Flag size={18} /> Report @{player.username}
              </button>
              <button
                type="button"
                className="card-press flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => {
                  if (isBlockedNow) {
                    unblockUser(player.username);
                    refresh();
                    onClose();
                  } else setMode('block');
                }}
              >
                <Ban size={18} /> {isBlockedNow ? `Unblock @${player.username}` : `Block @${player.username}`}
              </button>
            </div>
          </>
        )}
        {mode === 'report' && <ReportForm player={player} reporter={reporter} room={room} onDone={onClose} />}
        {mode === 'block' && (
          <div>
            <p className="muted -mt-2 text-[14.5px] leading-relaxed">
              @{player.username} will be hidden on this phone: their name, photos and friend requests disappear
              {onRemove ? ', and they are removed from your room and can’t rejoin it' : ''}. They aren’t notified.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-6"
              onClick={() => {
                blockUser(player);
                refresh();
                if (onRemove) onRemove(player);
                onClose();
              }}
            >
              <Ban size={18} /> Block @{player.username}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function BlockedSheet({ onClose }) {
  const blocked = useBlocked();
  const list = Object.entries(blocked);
  return (
    <Sheet title="Blocked players" onClose={onClose}>
      {list.length ? (
        <div className="card divide overflow-hidden">
          {list.map(([username]) => (
            <div key={username} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[15px] font-medium">@{username}</span>
              <button
                type="button"
                className="pill"
                onClick={() => {
                  unblockUser(username);
                  refresh();
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted py-6 text-center text-[14.5px]">Nobody is blocked. Block players from a room’s player list.</p>
      )}
    </Sheet>
  );
}
