import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { CATEGORIES } from '../../game/constants';
import { Avatar, SectionLabel } from '../primitives';

export default function Lobby({ view, intent, onInvite }) {
  const me = view.me;
  const isHost = view.hostId === me;
  const host = view.players.find((p) => p.isHost);
  const online = view.players.filter((p) => p.connected);
  const [editingPack, setEditingPack] = useState(false);
  const [pack, setPack] = useState(view.packName);

  return (
    <div className="enter flex flex-1 flex-col">
      <button type="button" onClick={onInvite} className="mt-2 text-center" aria-label="Share room code">
        <div className="eyebrow">Room code</div>
        <div className="tnum mt-1 text-[76px] font-bold leading-none tracking-[0.12em]">{view.code}</div>
        <div className="muted mt-3 text-[14px]">Tap to share or show QR</div>
      </button>

      <SectionLabel right={<span className="muted text-[13px]">{online.length} here</span>}>Players</SectionLabel>
      <div className="card divide overflow-hidden">
        {view.players.map((p) => (
          <div key={p.id} className={`enter flex items-center gap-3 px-5 py-3.5 ${p.connected ? '' : 'opacity-40'}`}>
            <Avatar name={p.name} size={40} inverted={p.id === me} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">
                {p.name}
                {p.id === me && <span className="muted font-normal"> (you)</span>}
              </div>
              <div className="muted truncate text-[13.5px]">
                @{p.username}
                {p.isHost ? ' · Host' : ''}
                {!p.connected ? ' · Reconnecting' : ''}
              </div>
            </div>
            {isHost && !p.isHost && (
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => intent({ type: 'remove', id: p.id })} className="muted grid h-9 w-9 place-items-center">
                <X size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      {online.length < 2 && <p className="muted mt-3 px-1 text-[13.5px]">Waiting for friends to join with code {view.code}.</p>}

      <SectionLabel>{isHost ? 'Vibe' : 'Vibe · picked by host'}</SectionLabel>
      <div className="noscroll -mx-6 flex gap-2 overflow-x-auto px-6">
        {Object.values(CATEGORIES).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!isHost && view.category !== c.id}
            onClick={() => isHost && intent({ type: 'category', category: c.id })}
            className={`pill ${view.category === c.id ? 'pill-on' : ''} disabled:opacity-40`}
          >
            {c.id === 'creator' ? 'Creator pack' : c.label.split(' / ')[0]}
          </button>
        ))}
      </div>
      {view.category === 'creator' && (
        <div className="mt-3">
          {editingPack ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                intent({ type: 'pack', name: pack });
                setEditingPack(false);
              }}
            >
              <input className="field !h-12 uppercase" value={pack} onChange={(e) => setPack(e.target.value)} maxLength={28} autoFocus aria-label="Creator pack name" />
              <button type="submit" className="icon-btn !h-12 !w-12" aria-label="Save pack name">
                <Check size={18} />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between px-1">
              <span className="text-[14px] font-medium">{view.packName}</span>
              {isHost && (
                <button
                  type="button"
                  aria-label="Rename creator pack"
                  className="muted flex items-center gap-1.5 text-[13px]"
                  onClick={() => {
                    setPack(view.packName);
                    setEditingPack(true);
                  }}
                >
                  <Pencil size={13} /> Rename
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="h-32" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(20px+var(--safe-bottom))]">
          {isHost ? (
            <button type="button" className="btn btn-primary" disabled={online.length < 2} onClick={() => intent({ type: 'spin' })}>
              Start mission
            </button>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> Waiting for {host?.name.split(' ')[0] || 'the host'} to start
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
