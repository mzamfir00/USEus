import React, { useState } from 'react';
import { Ban, Check, ChevronRight, Cloud, FileText, Lock, LogOut, Shield, Trash2, Volume2 } from 'lucide-react';
import { DNA_STYLES } from '../../game/constants';
import { ageFromDob, cloudConfig, deleteAccount, setCloudConfig, setTheme, testCloud } from '../../lib/database';
import { LegalSheet } from '../Legal';
import { BlockedSheet, useBlocked } from '../Moderation';
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

// Apple 5.1.1 / Google Play: in-app account deletion, confirmed by typing DELETE.
function DeleteSheet({ account, onDeleted, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const armed = text.trim().toUpperCase() === 'DELETE';
  return (
    <Sheet title="Delete account" onClose={busy ? () => {} : onClose}>
      <p className="text-[15px] leading-relaxed">
        This permanently deletes <b>@{account.username}</b>. It can’t be undone.
      </p>
      <ul className="muted mt-3 list-disc space-y-1 pl-5 text-[14px] leading-snug">
        <li>Your login, profile, XP, stats and match history</li>
        <li>Your friends list and friendships</li>
        <li>Rooms you host and their match logs; your name in other rooms’ scores</li>
        <li>Reports you filed, and everything USEus saved on this phone</li>
      </ul>
      <label className="mt-5 block">
        <span className="text-[13px] font-medium">Type DELETE to confirm</span>
        <input
          className="field mt-2 tracking-[0.2em]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Type DELETE to confirm"
        />
      </label>
      {error && <div className="shake mt-3 text-[13.5px]">{error}</div>}
      <button
        type="button"
        className="btn btn-primary mt-5"
        disabled={!armed || busy}
        onClick={async () => {
          setBusy(true);
          try {
            onDeleted(await deleteAccount(account));
          } catch (e) {
            setBusy(false);
            setError('Something went wrong. Try again.');
          }
        }}
      >
        <Trash2 size={18} /> {busy ? 'Deleting…' : 'Delete Account Permanently'}
      </button>
      <button type="button" className="btn btn-ghost mt-1" disabled={busy} onClick={onClose}>
        Keep my account
      </button>
    </Sheet>
  );
}

export default function Profile({ account, onAccount, sound, setSound, onSignOut, onDeleted }) {
  const [sheet, setSheet] = useState(null);
  const blocked = useBlocked();
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
        <button type="button" onClick={() => setSheet('blocked')} className="card-press flex w-full items-center gap-3 px-5 py-4 text-left">
          <Ban size={18} />
          <span className="flex-1">Blocked players</span>
          <span className="muted text-[14px]">{Object.keys(blocked).length}</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <SectionLabel>Legal</SectionLabel>
      <div className="card divide overflow-hidden text-[15px]">
        <button type="button" onClick={() => setSheet('privacy')} className="card-press flex w-full items-center gap-3 px-5 py-4 text-left">
          <Shield size={18} />
          <span className="flex-1">Privacy Policy</span>
          <ChevronRight size={18} className="muted" />
        </button>
        <button type="button" onClick={() => setSheet('terms')} className="card-press flex w-full items-center gap-3 px-5 py-4 text-left">
          <FileText size={18} />
          <span className="flex-1">Terms of Use (16+)</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <button type="button" onClick={onSignOut} className="btn btn-secondary mt-8">
        <LogOut size={18} /> Sign out
      </button>
      <p className="muted mt-3 text-center text-[12.5px]">Signing out keeps your account — log back in any time.</p>

      <button type="button" onClick={() => setSheet('delete')} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] text-[14.5px] font-semibold">
        <Trash2 size={17} /> Delete Account Permanently
      </button>
      <div className="h-4" />

      {sheet === 'cloud' && <CloudSheet onClose={() => setSheet(null)} />}
      {sheet === 'blocked' && <BlockedSheet onClose={() => setSheet(null)} />}
      {(sheet === 'privacy' || sheet === 'terms') && <LegalSheet doc={sheet} onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet account={account} onDeleted={onDeleted} onClose={() => setSheet(null)} />}
    </div>
  );
}
