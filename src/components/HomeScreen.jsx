import React, { useState } from 'react';
import { ArrowRight, Database, LogOut, Menu, Plus, RotateCcw } from 'lucide-react';
import { archetypeLabel, DNA_STYLES } from '../game/constants';
import { dnaInfo } from '../game/engine';
import { dbMode, getSupabaseConfig, myRooms, setSupabaseConfig, testSupabase } from '../lib/db';
import { Synth } from '../lib/sound';
import { IconBtn, Sheet, Stat } from './ui';

export function SettingsSheet({ onClose }) {
  const cfg = getSupabaseConfig();
  const fromEnv = cfg?.source === 'env';
  const [url, setUrl] = useState(cfg?.url || '');
  const [key, setKey] = useState(cfg?.source === 'settings' ? cfg.key : '');
  const [state, setState] = useState({ busy: false, msg: '', ok: null });

  const test = async () => {
    setState({ busy: true, msg: 'Testing…', ok: null });
    const r = await testSupabase({ url, key });
    setState({ busy: false, ok: r.ok, msg: r.ok ? 'Connected. Tables found.' : r.error });
    return r.ok;
  };

  return (
    <Sheet title="Database / Cloud settings" onClose={onClose}>
      <div className="panel px-4 py-3" data-tag="MODE">
        <div className="label">Current storage</div>
        <div className="display mt-1 text-[22px]">{dbMode() === 'cloud' ? 'Supabase Cloud' : 'On-device + P2P'}</div>
        <p className="muted mt-1 text-[13px] leading-snug">
          {dbMode() === 'cloud'
            ? 'Profiles, rooms and mission history sync to your Postgres database. Rooms also sync over Supabase Realtime.'
            : 'Accounts live on this device; squad profiles are exchanged peer-to-peer when you play together.'}
        </p>
      </div>

      {fromEnv ? (
        <p className="mono mt-5 text-[12px] text-[var(--zinc)]">This build has Supabase configured via environment variables.</p>
      ) : (
        <form
          className="mt-6 space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await test()) {
              setSupabaseConfig({ url, key });
              window.location.reload();
            }
          }}
        >
          <label className="block">
            <span className="label">Supabase project URL</span>
            <input className="input text-[15px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xyzcompany.supabase.co" autoCapitalize="none" />
          </label>
          <label className="block">
            <span className="label">Anon public key</span>
            <input className="input mono text-[13px]" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" autoCapitalize="none" />
          </label>
          {state.msg && <div className={`border px-3 py-2 text-[13px] font-bold ${state.ok === false ? 'shake border-[var(--paper)]' : 'border-[var(--line)]'}`}>{state.msg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-ghost" disabled={state.busy || !url || !key} onClick={test}>
              Test
            </button>
            <button type="submit" className="btn" disabled={state.busy || !url || !key}>
              Save & switch
            </button>
          </div>
          {cfg && (
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => {
                setSupabaseConfig(null);
                window.location.reload();
              }}
            >
              Disconnect cloud → on-device
            </button>
          )}
          <p className="mono text-[10.5px] leading-relaxed text-[var(--zinc)]">
            Run supabase/schema.sql from the repo in your project’s SQL editor first. The key is stored only on this phone.
          </p>
        </form>
      )}
    </Sheet>
  );
}

export function ProfileMenu({ profile, onClose, onSettings, onLogout }) {
  return (
    <Sheet title="Profile" onClose={onClose}>
      <div className="display text-[30px]">{profile.name}</div>
      <div className="mono muted mt-1 text-[12px]">
        @{profile.username} · {profile.age} · {archetypeLabel(profile.archetype)}
      </div>
      <div className="mt-6 space-y-3">
        <button type="button" className="btn-ghost w-full justify-between" onClick={onSettings}>
          <span className="flex items-center gap-3">
            <Database size={18} /> Database / Cloud settings
          </span>
          <span className="mono text-[11px] text-[var(--zinc)]">{dbMode() === 'cloud' ? 'CLOUD' : 'LOCAL'}</span>
        </button>
        <button type="button" className="btn-ghost w-full justify-start" onClick={onLogout}>
          <LogOut size={18} /> Log out / switch account
        </button>
      </div>
    </Sheet>
  );
}

export default function HomeScreen({ profile, onCreate, onJoin, onMenu, notice }) {
  const [code, setCode] = useState('');
  const rooms = myRooms(profile.username);
  const s = profile.stats || {};

  return (
    <div className="content mx-auto min-h-[100dvh] max-w-md px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="hdr relative flex items-center justify-between border-b border-[var(--line)] pb-3">
        <span className="label">Squad Roulette</span>
        <IconBtn label="Profile menu" onClick={onMenu}>
          <Menu size={18} />
        </IconBtn>
      </header>

      <section className="rise mt-8">
        <div className="label">Signed in</div>
        <h1 className="display mt-2 text-[clamp(32px,11vw,46px)] break-words">{profile.name}</h1>
        <div className="mono muted mt-2 text-[12px]">
          @{profile.username} · AGE {profile.age} · {archetypeLabel(profile.archetype).toUpperCase()}
        </div>
        <div className="panel mt-6 grid grid-cols-4 gap-3 px-4 py-4" data-tag="STATS">
          <Stat label="XP" value={s.xp || 0} />
          <Stat label="Missions" value={s.missions || 0} />
          <Stat label="Secret" value={s.secretWins || 0} />
          <Stat label="Rounds" value={s.rounds || 0} />
        </div>
      </section>

      {notice && <div className="shake mt-6 border border-[var(--paper)] px-4 py-3 text-[14px] font-bold">{notice}</div>}

      <section className="mt-8 space-y-3">
        <button
          type="button"
          className="btn btn-lg w-full"
          onClick={() => {
            Synth.unlock();
            Synth.click();
            onCreate();
          }}
        >
          <Plus size={20} strokeWidth={2.5} /> Create room
        </button>

        <form
          className="panel flex items-end gap-3 px-4 pb-4 pt-3"
          data-tag="JOIN"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 4) {
              Synth.unlock();
              Synth.click();
              onJoin(code);
            }
          }}
        >
          <label className="flex-1">
            <span className="label">Join room — 4-digit code</span>
            <input
              className="input tnum text-[34px] tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="0000"
              aria-label="Room code"
            />
          </label>
          <button type="submit" className="btn h-[52px] w-[52px] !px-0" disabled={code.length !== 4} aria-label="Join room">
            <ArrowRight size={20} />
          </button>
        </form>
      </section>

      {rooms.length > 0 && (
        <section className="mt-10">
          <div className="label">Your rooms — Room DNA is kept</div>
          <div className="mt-3 border border-[var(--line)]">
            {rooms.map((r) => {
              const info = dnaInfo(r.dna);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => onCreate(r.code)}
                  className="tap flex w-full items-center justify-between border-b border-[var(--line)] px-4 py-3 text-left last:border-b-0"
                >
                  <span>
                    <span className="display block text-[22px]">#{r.code}</span>
                    <span className="mono muted block text-[11px]">
                      LV.{info.stage} {DNA_STYLES[info.style].name.toUpperCase()} · {info.completed} cleared
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider">
                    <RotateCcw size={14} /> Reopen
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {profile.history?.length > 0 && (
        <section className="mt-10">
          <div className="label">Squad history</div>
          <div className="mt-3 space-y-px">
            {profile.history.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold">{h.mission}</div>
                  <div className="mono muted truncate text-[11px]">
                    #{h.room} · {h.squad.join(', ')}
                  </div>
                </div>
                <span className="mono shrink-0 text-[11px] uppercase">{h.outcome === 'complete' ? 'Cleared' : 'Chickened'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
