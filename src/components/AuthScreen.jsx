import React, { useState } from 'react';
import { ArrowRight, Cloud, HardDrive } from 'lucide-react';
import { ARCHETYPES, archetypeLabel } from '../game/constants';
import { dbMode, deviceAccounts, logIn, signUp } from '../lib/db';
import { Synth } from '../lib/sound';

export default function AuthScreen({ onAuthed, pendingRoom }) {
  const accounts = deviceAccounts();
  const [tab, setTab] = useState(accounts.length ? 'login' : 'signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', username: '', age: '', archetype: '', pin: '' });
  const [login, setLogin] = useState({ username: accounts[0]?.username || '', pin: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (fn) => {
    Synth.unlock();
    setBusy(true);
    setError('');
    try {
      const profile = await fn();
      Synth.success();
      onAuthed(profile);
    } catch (e) {
      Synth.fail();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="hdr relative flex items-center justify-between border-b border-[var(--line)] pb-3">
        <span className="label">Squad Roulette / v2</span>
        <span className="label flex items-center gap-1.5">
          {dbMode() === 'cloud' ? <Cloud size={12} /> : <HardDrive size={12} />}
          {dbMode() === 'cloud' ? 'Cloud DB' : 'On-device'}
        </span>
      </header>

      <div className="mt-10">
        <h1 className="display text-[clamp(48px,16vw,64px)]">
          Squad
          <br />
          Roulette
        </h1>
        <p className="mt-4 max-w-[30ch] text-[15px] leading-snug text-[var(--zinc)]">
          An IRL party game. Every player on their own phone. Spin, get cast, film the chaos.
        </p>
        {pendingRoom && (
          <div className="panel mt-6 px-4 py-3">
            <div className="label">Invitation</div>
            <div className="mt-1 text-[15px] font-bold">Create an account or log in to join room #{pendingRoom}.</div>
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 border border-[var(--line-strong)]">
        {[
          ['signup', 'Sign up'],
          ['login', 'Log in'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setError('');
            }}
            className={`tap h-12 text-[13px] font-extrabold uppercase tracking-[0.14em] ${tab === id ? 'selected' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'signup' ? (
        <form
          className="rise mt-8 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => signUp(form));
          }}
        >
          <label className="block">
            <span className="label">01 — Full name / nickname</span>
            <input className="input" value={form.name} onChange={set('name')} maxLength={24} placeholder="Alex Rivera" autoComplete="nickname" />
          </label>
          <label className="block">
            <span className="label">02 — Unique @username</span>
            <div className="flex items-baseline">
              <span className="display mr-1 text-[22px] text-[var(--zinc)]">@</span>
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                maxLength={16}
                placeholder="alexr"
                autoCapitalize="none"
                autoComplete="username"
              />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-5">
            <label className="block">
              <span className="label">03 — Age</span>
              <input className="input tnum" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value.replace(/\D/g, '').slice(0, 2) }))} inputMode="numeric" placeholder="21" />
            </label>
            <label className="block">
              <span className="label">04 — 4-digit PIN</span>
              <input
                className="input pin tnum"
                type="password"
                value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                inputMode="numeric"
                placeholder="••••"
                autoComplete="new-password"
              />
            </label>
          </div>
          <div>
            <span className="label">05 — Playstyle archetype</span>
            <div className="mt-3 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
              {ARCHETYPES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    Synth.click();
                    setForm((f) => ({ ...f, archetype: a.id }));
                  }}
                  className={`tap bg-[var(--bg)] p-3.5 text-left ${form.archetype === a.id ? 'selected' : ''}`}
                >
                  <div className="text-[15px] font-extrabold uppercase tracking-tight">{a.label}</div>
                  <div className="muted mt-1 text-[12px] leading-snug">{a.blurb}</div>
                </button>
              ))}
            </div>
          </div>
          {error && <div className="shake border border-[var(--paper)] px-3 py-2 text-[14px] font-bold">{error}</div>}
          <button type="submit" disabled={busy} className="btn btn-lg w-full">
            {busy ? 'Creating…' : 'Create account'} <ArrowRight size={18} />
          </button>
          <p className="mono text-[10.5px] leading-relaxed text-[var(--zinc)]">
            {dbMode() === 'cloud'
              ? 'Your profile is stored in the squad’s cloud database.'
              : 'Your profile is stored on this device. Add a Supabase database later in Settings to sync across devices.'}{' '}
            13+ only.
          </p>
        </form>
      ) : (
        <form
          className="rise mt-8 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => logIn(login.username, login.pin));
          }}
        >
          {accounts.length > 0 && (
            <div>
              <span className="label">Accounts on this device</span>
              <div className="mt-3 border border-[var(--line)]">
                {accounts.map((a) => (
                  <button
                    key={a.username}
                    type="button"
                    onClick={() => setLogin({ username: a.username, pin: '' })}
                    className={`tap flex w-full items-center justify-between border-b border-[var(--line)] px-4 py-3 text-left last:border-b-0 ${login.username === a.username ? 'selected' : ''}`}
                  >
                    <span>
                      <span className="block text-[16px] font-extrabold">{a.name}</span>
                      <span className="mono muted block text-[11px]">
                        @{a.username} · {archetypeLabel(a.archetype)}
                      </span>
                    </span>
                    <span className="mono tnum text-[12px]">{a.stats?.xp || 0} XP</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="label">@username</span>
            <input
              className="input"
              value={login.username}
              onChange={(e) => setLogin((l) => ({ ...l, username: e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '') }))}
              placeholder="alexr"
              autoCapitalize="none"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="label">PIN</span>
            <input
              className="input pin tnum"
              type="password"
              value={login.pin}
              onChange={(e) => setLogin((l) => ({ ...l, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              inputMode="numeric"
              placeholder="••••"
              autoComplete="current-password"
            />
          </label>
          {error && <div className="shake border border-[var(--paper)] px-3 py-2 text-[14px] font-bold">{error}</div>}
          <button type="submit" disabled={busy || !login.username || login.pin.length !== 4} className="btn btn-lg w-full">
            {busy ? 'Checking…' : 'Log in'} <ArrowRight size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
