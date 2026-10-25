import React, { useState } from 'react';
import { Check, Dices, Pencil, Plus, QrCode, X } from 'lucide-react';
import { archetypeLabel, CATEGORIES, MAX_PLAYERS } from '../game/constants';
import { buzz, Synth } from '../lib/sound';

export default function Lobby({ view, intent, onQr }) {
  const me = view.me;
  const isHost = view.hostId === me;
  const host = view.players.find((p) => p.isHost);
  const active = view.players.filter((p) => p.connected || p.isBot);
  const canSpin = active.length >= 2;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(view.packName);

  return (
    <div className="pb-32">
      <button type="button" onClick={onQr} className="panel tap mt-6 flex w-full items-center justify-between px-4 py-4 text-left" data-tag="INVITE">
        <span>
          <span className="label">Room code — scan or type to join</span>
          <span className="display tnum mt-1 block text-[54px] tracking-[0.06em]">{view.code}</span>
        </span>
        <span className="grid h-14 w-14 place-items-center border border-[var(--line-strong)]">
          <QrCode size={26} />
        </span>
      </button>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <div className="label">Squad roster — live</div>
          <div className="mono text-[11px] text-[var(--zinc)]">
            {view.players.length}/{MAX_PLAYERS}
          </div>
        </div>
        <div className="mt-3 border-t border-[var(--line)]">
          {view.players.map((p, i) => (
            <div key={p.id} className={`rise flex items-center gap-3 border-b border-[var(--line)] py-3 ${p.connected || p.isBot ? '' : 'opacity-40'}`} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="mono w-6 text-[11px] text-[var(--zinc)]">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[19px] font-extrabold">{p.name}</span>
                  {p.id === me && <span className="mono bg-[var(--paper)] px-1.5 text-[9.5px] font-bold text-[var(--ink)]">YOU</span>}
                  {p.isHost && <span className="mono border border-[var(--line-strong)] px-1.5 text-[9.5px]">HOST</span>}
                  {p.isBot && <span className="mono border border-dashed border-[var(--line-strong)] px-1.5 text-[9.5px]">PASS-THE-PHONE</span>}
                </div>
                <div className="mono muted mt-0.5 truncate text-[11px]">
                  {p.isBot ? 'Simulated on host phone' : `@${p.username}`} · {archetypeLabel(p.archetype)}
                </div>
              </div>
              {p.age && (
                <span className="mono grid h-8 w-8 shrink-0 place-items-center border border-[var(--line-strong)] text-[11px]" title="Age">
                  {p.age}
                </span>
              )}
              <span className={`dot shrink-0 ${p.connected || p.isBot ? '' : 'bg-transparent border border-[var(--zinc)]'}`} title={p.connected ? 'Connected' : 'Offline'} />
              {isHost && !p.isHost && (
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => {
                    Synth.click();
                    intent({ type: 'remove', id: p.id });
                  }}
                  className="tap grid h-8 w-8 shrink-0 place-items-center border border-[var(--line)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {isHost && view.players.length < MAX_PLAYERS && (
          <button
            type="button"
            onClick={() => {
              Synth.click();
              buzz(10);
              intent({ type: 'addBot' });
            }}
            className="mono mt-3 flex w-full items-center justify-center gap-2 border border-dashed border-[var(--line-strong)] py-3 text-[11px] uppercase tracking-[0.16em] text-[var(--zinc)]"
          >
            <Plus size={13} /> Add simulated bot / pass-the-phone player
          </button>
        )}
        {view.players.length === 1 && (
          <p className="muted mt-3 text-[13px] leading-snug">Friends: open the app, log in, tap Join room and enter {view.code} — or scan the QR code.</p>
        )}
      </section>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <div className="label">Vibe</div>
          {!isHost && <div className="mono text-[10.5px] text-[var(--zinc)]">Host picks</div>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
          {Object.values(CATEGORIES).map((c) => {
            const selected = view.category === c.id;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={isHost ? 0 : -1}
                onClick={() => {
                  if (!isHost || selected) return;
                  Synth.click();
                  buzz(8);
                  intent({ type: 'category', category: c.id });
                }}
                className={`flex min-h-[132px] flex-col justify-between bg-[var(--bg)] p-3.5 ${selected ? 'selected' : ''} ${isHost ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <span className="mono text-[11px] opacity-60">{c.index}</span>
                  {selected && <Check size={15} strokeWidth={3} />}
                </div>
                {c.id === 'creator' ? (
                  <div>
                    <span className="mono inline-block border border-current px-1 text-[9px] font-bold tracking-[0.15em]">SPONSORED</span>
                    {editing ? (
                      <form
                        className="mt-1.5 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => {
                          e.preventDefault();
                          intent({ type: 'pack', name: draft });
                          setEditing(false);
                        }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          maxLength={28}
                          onChange={(e) => setDraft(e.target.value)}
                          className="w-full min-w-0 border border-current bg-transparent px-1.5 py-1 text-[11px] font-extrabold uppercase outline-none"
                        />
                        <button type="submit" aria-label="Save pack name" className="grid h-7 w-7 shrink-0 place-items-center border border-current">
                          <Check size={13} />
                        </button>
                      </form>
                    ) : (
                      <div className="mt-1.5 flex items-start gap-1">
                        <div className="display text-[14px] leading-tight">{view.packName}</div>
                        {isHost && (
                          <button
                            type="button"
                            aria-label="Edit pack name"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraft(view.packName);
                              setEditing(true);
                              if (!selected) intent({ type: 'category', category: 'creator' });
                            }}
                            className="grid h-6 w-6 shrink-0 place-items-center border border-current"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-[15px] font-extrabold uppercase leading-tight tracking-tight">{c.label}</div>
                    <div className="muted mt-1 text-[12px]">{c.tagline}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-md bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          {isHost ? (
            <>
              <button
                type="button"
                disabled={!canSpin}
                onClick={() => {
                  Synth.unlock();
                  Synth.whoosh();
                  intent({ type: 'spin' });
                }}
                className="btn btn-lg w-full"
              >
                <Dices size={20} /> Spin the mission wheel
              </button>
              {!canSpin && <div className="mono mt-2 text-center text-[10.5px] uppercase tracking-[0.16em] text-[var(--zinc)]">Need 2+ players — invite a friend or add a bot</div>}
            </>
          ) : (
            <div className="mono flex items-center justify-center gap-2 border border-[var(--line)] bg-[var(--bg)] py-4 text-[11px] uppercase tracking-[0.18em] text-[var(--zinc)]">
              <span className="dot blink" /> Waiting for {host?.name || 'the host'} to spin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
