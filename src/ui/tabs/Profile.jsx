import React, { useState } from 'react';
import { Check, ChevronRight, Cloud, Lock, LogOut, Volume2 } from 'lucide-react';
import { DNA_STYLES } from '../../game/constants';
import { ageFromDob, cloudConfig, setCloudConfig, setTheme, testCloud } from '../../lib/database';
import { Avatar, ScreenHeader, SectionLabel, Sheet } from '../primitives';

const mask = (account) => {
  if (account.phone) return `${account.phone.slice(0, -6)} ••• ${account.phone.slice(-3)}`;
  const [user, domain] = account.email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
};

function CloudSheet({ onClose }) {
  const cfg = cloudConfig();
  const [url, setUrl] = useState(cfg?.source === 'device' ? cfg.url : '');
  const [key, setKey] = useState(cfg?.source === 'device' ? cfg.key : '');
  const [state, setState] = useState({ busy: false, msg: '' });

  return (
    <Sheet title="Cloud database" onClose={onClose}>
      <p className="muted text-[14px] leading-relaxed">
        {cfg
          ? 'Connected. Accounts, friends, rooms and missions sync to Supabase so you can log in on any device.'
          : 'Accounts are saved permanently on this device. Connect a Supabase project to log in from any device and find friends by phone or email.'}
      </p>
      {cfg?.source === 'build' ? null : (
        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState({ busy: true, msg: '' });
            const r = await testCloud({ url, key });
            if (!r.ok) {
              setState({ busy: false, msg: r.error });
              return;
            }
            setCloudConfig({ url, key });
            window.location.reload();
          }}
        >
          <input className="field text-[15px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://project.supabase.co" autoCapitalize="none" aria-label="Supabase URL" />
          <input className="field text-[15px]" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Anon public key" autoCapitalize="none" aria-label="Supabase anon key" />
          {state.msg && <div className="shake text-[13.5px]">{state.msg}</div>}
          <button type="submit" className="btn btn-primary !mt-5" disabled={!url || !key || state.busy}>
            {state.busy ? 'Connecting…' : 'Connect'}
          </button>
          {cfg && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setCloudConfig(null);
                window.location.reload();
              }}
            >
              Disconnect
            </button>
          )}
        </form>
      )}
    </Sheet>
  );
}

export default function Profile({ account, onAccount, sound, setSound, onSignOut }) {
  const [sheet, setSheet] = useState(null);
  const s = account.stats;
  const joined = new Date(account.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="enter">
      <ScreenHeader title="Profile" />

      <div className="flex items-center gap-4">
        <Avatar name={account.name} size={64} inverted />
        <div className="min-w-0">
          <div className="headline truncate text-[24px]">{account.name}</div>
          <div className="muted mt-0.5 text-[15px]">@{account.username}</div>
        </div>
      </div>

      <div className="card mt-6 grid grid-cols-3 divide-x divide-[var(--border)] py-4 text-center">
        {[
          ['XP', s.xp],
          ['Missions', s.missions],
          ['Secret wins', s.secretWins],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="tnum text-[24px] font-bold">{value}</div>
            <div className="muted mt-0.5 text-[12.5px]">{label}</div>
          </div>
        ))}
      </div>

      <SectionLabel>Room aesthetic</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(DNA_STYLES).map(([id, style]) => {
          const unlocked = account.aesthetics.includes(id);
          const active = account.theme === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!unlocked}
              onClick={async () => onAccount(await setTheme(account, id))}
              className={`card card-press p-4 text-left ${active ? '!border-[var(--fg)]' : ''} ${unlocked ? '' : 'opacity-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">{style.name}</span>
                {active ? <Check size={16} /> : !unlocked && <Lock size={14} className="muted" />}
              </div>
              <div className="muted mt-2 text-[12.5px] leading-snug">{unlocked ? style.motto : 'Evolve a room into this style to unlock.'}</div>
            </button>
          );
        })}
      </div>

      <SectionLabel>Account</SectionLabel>
      <div className="card divide overflow-hidden text-[15px]">
        <div className="flex justify-between px-5 py-4">
          <span className="muted">{account.phone ? 'Phone' : 'Email'}</span>
          <span className="tnum">{mask(account)}</span>
        </div>
        <div className="flex justify-between px-5 py-4">
          <span className="muted">Age</span>
          <span>{ageFromDob(account.dob)}</span>
        </div>
        <div className="flex justify-between px-5 py-4">
          <span className="muted">Member since</span>
          <span>{joined}</span>
        </div>
      </div>

      <SectionLabel>Settings</SectionLabel>
      <div className="card divide overflow-hidden text-[15px]">
        <button type="button" onClick={() => setSound(!sound)} className="card-press flex w-full items-center gap-3 px-5 py-4 text-left">
          <Volume2 size={18} />
          <span className="flex-1">Sound effects</span>
          <span className={`relative h-[30px] w-[50px] rounded-full transition-colors ${sound ? 'bg-[var(--fg)]' : 'bg-[var(--border)]'}`}>
            <span className={`absolute top-[3px] h-6 w-6 rounded-full transition-all ${sound ? 'left-[23px] bg-[var(--bg)]' : 'left-[3px] bg-[var(--fg)]'}`} />
          </span>
        </button>
        <button type="button" onClick={() => setSheet('cloud')} className="card-press flex w-full items-center gap-3 px-5 py-4 text-left">
          <Cloud size={18} />
          <span className="flex-1">Cloud database</span>
          <span className="muted text-[14px]">{cloudConfig() ? 'On' : 'Off'}</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <button type="button" onClick={onSignOut} className="btn btn-secondary mt-8">
        <LogOut size={18} /> Sign out
      </button>
      <p className="muted mt-3 text-center text-[12.5px]">Signing out never deletes your account.</p>

      {sheet === 'cloud' && <CloudSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
