import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ban, Check, ChevronRight, Cloud, FileText, Lock, LogOut, RotateCcw, Shield, ShieldCheck, Trash2, Volume2, Zap } from 'lucide-react-native';
import { DNA_STYLES } from '../../core';
import { VIP_STYLE } from '../../config/monetization';
import { activePro, openStore, restore, showPrivacyOptions, useMonetization } from '../../services/monetizationService';
import { HOST_PITCH, proLabel } from '../monetization/ProStore';
import { ageFromDob, cloudConfig, deleteAccount, setCloudConfig, setTheme, testCloud } from '../../lib/database';
import { MONTH_NAMES } from '../../lib/format';
import { useTheme } from '../../theme';
import { LegalSheet } from '../Legal';
import { BlockedSheet, useBlocked } from '../Moderation';
import { Avatar, Button, Card, Divided, Field, Screen, ScreenHeader, SectionLabel, Sheet, Switch, T, Title } from '../primitives';

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
      <T muted size={14} lh={1.5}>
        {cfg
          ? 'Connected. Accounts, friends, rooms and missions sync to Supabase so you can log in on any device.'
          : 'Accounts are saved permanently on this device. Connect a Supabase project to log in from any device and find friends by phone or email.'}
      </T>
      <T muted size={13} lh={1.5} style={{ marginTop: 12 }}>
        {cfg?.source === 'device' ? 'Using your own Supabase project.' : 'Using the USEus project. You can point this phone at your own Supabase project instead:'}
      </T>
      <View style={{ marginTop: 20, gap: 12 }}>
        <Field value={url} onChangeText={setUrl} placeholder="https://project.supabase.co" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Supabase URL" />
        <Field value={key} onChangeText={setKey} placeholder="Anon public key" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Supabase anon key" />
        {state.msg ? <T size={13.5}>{state.msg}</T> : null}
        <Button
          title={state.busy ? 'Connecting…' : 'Connect'}
          disabled={!url || !key || state.busy}
          style={{ marginTop: 8 }}
          onPress={async () => {
            setState({ busy: true, msg: '' });
            const r = await testCloud({ url, key });
            if (!r.ok) {
              setState({ busy: false, msg: r.error });
              return;
            }
            setCloudConfig({ url, key });
            onClose();
          }}
        />
        {cfg?.source === 'device' ? (
          <Button
            variant="ghost"
            title="Use the USEus project"
            onPress={() => {
              setCloudConfig(null);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

// Apple 5.1.1 / Google Play: in-app account deletion, confirmed by typing DELETE.
function DeleteSheet({ account, onDeleted, onClose }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const armed = text.trim().toUpperCase() === 'DELETE';
  const items = [
    'Your login, profile, XP, stats and match history',
    'Your friends list and friendships',
    'Rooms you host and their match logs; your name in other rooms’ scores',
    'Reports you filed, and everything USEus saved on this phone',
  ];
  return (
    <Sheet title="Delete account" onClose={onClose} dismissable={!busy} testID="delete-sheet">
      <T size={15} lh={1.5}>
        This permanently deletes <T w={700}>@{account.username}</T>. It can’t be undone.
      </T>
      <View style={{ marginTop: 12, gap: 4 }}>
        {items.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
            <T muted size={14}>
              •
            </T>
            <T muted size={14} lh={1.35} style={{ flex: 1 }}>
              {line}
            </T>
          </View>
        ))}
      </View>
      <T size={13} w={500} style={{ marginTop: 20 }}>
        Type DELETE to confirm
      </T>
      <Field
        style={{ marginTop: 8 }}
        inputStyle={{ letterSpacing: 3 }}
        value={text}
        onChangeText={setText}
        placeholder="DELETE"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel="Type DELETE to confirm"
        testID="delete-confirm"
      />
      {error ? (
        <T size={13.5} style={{ marginTop: 12 }}>
          {error}
        </T>
      ) : null}
      <Button
        title={busy ? 'Deleting…' : 'Delete Account Permanently'}
        icon={Trash2}
        disabled={!armed || busy}
        testID="delete-account"
        style={{ marginTop: 20 }}
        onPress={async () => {
          setBusy(true);
          try {
            onDeleted(await deleteAccount(account));
          } catch (e) {
            setBusy(false);
            setError('Something went wrong. Try again.');
          }
        }}
      />
      <Button variant="ghost" title="Keep my account" disabled={busy} onPress={onClose} style={{ marginTop: 4 }} color={t.c.fg} />
    </Sheet>
  );
}

function SettingRow({ icon: Icon, label, value, onPress, right, testID }) {
  const t = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} testID={testID} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
      <Icon size={18} color={t.c.fg} />
      <T size={15} style={{ flex: 1 }}>
        {label}
      </T>
      {value != null ? (
        <T muted size={14}>
          {value}
        </T>
      ) : null}
      {right || <ChevronRight size={18} color={t.c.muted} />}
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
      <T muted size={15}>
        {label}
      </T>
      <T size={15} tnum>
        {value}
      </T>
    </View>
  );
}

// ⚡ PRO PASS: status, the store, Restore Purchases and (EEA/UK) the ad privacy choices.
function ProPass() {
  const m = useMonetization();
  const pro = activePro(m.pro);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SectionLabel>Pro Pass</SectionLabel>
      <TouchableOpacity
        onPress={openStore}
        activeOpacity={0.85}
        accessibilityRole="button"
        testID="pro-pass-profile"
        style={{ borderRadius: 22, borderWidth: 1, borderColor: '#fff', backgroundColor: pro ? '#fff' : '#000', padding: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color={pro ? '#000' : '#fff'} fill={pro ? '#000' : 'transparent'} />
          <T size={14} w={800} ls={1.2} color={pro ? '#000' : '#fff'} style={{ flex: 1 }}>
            {pro ? proLabel(m.pro).toUpperCase() : 'PRO PASS'}
          </T>
          <ChevronRight size={18} color={pro ? '#000' : '#fff'} />
        </View>
        <T size={13.5} lh={1.4} color={pro ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.7)'} style={{ marginTop: 8 }}>
          {pro ? 'Every room you host is unlocked and ad-free for the whole squad.' : `Only the host needs Pro. ${HOST_PITCH}`}
        </T>
      </TouchableOpacity>
      <Card style={{ marginTop: 12 }}>
        <Divided>
          <SettingRow
            icon={RotateCcw}
            label={busy ? 'Restoring…' : 'Restore Purchases'}
            testID="profile-restore"
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              const r = await restore();
              setBusy(false);
              setNote(r.ok ? (r.pro ? `Restored: ${proLabel(r.pro)}.` : 'No passes to restore on this account.') : r.error);
            }}
          />
          {m.privacyOptions ? <SettingRow icon={ShieldCheck} label="Ad privacy choices" onPress={showPrivacyOptions} /> : null}
        </Divided>
      </Card>
      {note ? (
        <T muted size={13} center style={{ marginTop: 8 }} testID="profile-restore-note">
          {note}
        </T>
      ) : null}
    </>
  );
}

export default function Profile({ account, onAccount, sound, setSound, onSignOut, onDeleted }) {
  const t = useTheme();
  const [sheet, setSheet] = useState(null);
  const [, bump] = useState(0);
  const blocked = useBlocked();
  const s = account.stats;
  const created = new Date(account.createdAt);
  const joined = `${MONTH_NAMES[created.getMonth()]} ${created.getFullYear()}`;
  const closeSheet = () => {
    setSheet(null);
    bump((n) => n + 1);
  };

  return (
    <Screen testID="tab-profile">
      <ScreenHeader title="Profile" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar name={account.name} size={64} inverted />
        <View style={{ flexShrink: 1 }}>
          <Title size={24} numberOfLines={1}>
            {account.name}
          </Title>
          <T muted size={15} style={{ marginTop: 2 }}>
            @{account.username}
          </T>
        </View>
      </View>

      <Card style={{ marginTop: 24 }} inner={{ flexDirection: 'row', paddingVertical: 16 }}>
        {[
          ['XP', s.xp],
          ['Missions', s.missions],
          ['Secret wins', s.secretWins],
        ].map(([label, value], i) => (
          <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: t.c.border }}>
            <T size={24} w={700} tnum>
              {value}
            </T>
            <T muted size={12.5} style={{ marginTop: 2 }}>
              {label}
            </T>
          </View>
        ))}
      </Card>

      <ProPass />

      <SectionLabel>Room aesthetic</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[...Object.entries(DNA_STYLES), [VIP_STYLE.id, VIP_STYLE]].map(([id, style]) => {
          const vip = id === VIP_STYLE.id;
          const unlocked = account.aesthetics.includes(id) && (!vip || account.pro?.plan === 'lifetime');
          const active = account.theme === id;
          return (
            <Card
              key={id}
              style={{ width: '47.5%', opacity: unlocked ? 1 : 0.5 }}
              inner={{ padding: 16, borderColor: active ? t.c.fg : t.c.border, minHeight: 112 }}
              disabled={!unlocked && !vip}
              onPress={async () => (unlocked ? onAccount(await setTheme(account, id)) : openStore())}
              accessibilityLabel={style.name}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={15} w={600} style={{ flexShrink: 1 }}>
                  {style.name}
                </T>
                {active ? <Check size={16} color={t.c.fg} /> : !unlocked ? <Lock size={14} color={t.c.muted} /> : null}
              </View>
              <T muted size={12.5} lh={1.35} style={{ marginTop: 8 }}>
                {unlocked ? style.motto : vip ? '⚡ Lifetime Pro Host exclusive.' : 'Evolve a room into this style to unlock.'}
              </T>
            </Card>
          );
        })}
      </View>

      <SectionLabel>Account</SectionLabel>
      <Card>
        <Divided>
          <InfoRow label={account.phone ? 'Phone' : 'Email'} value={mask(account)} />
          <InfoRow label="Age" value={String(ageFromDob(account.dob))} />
          <InfoRow label="Member since" value={joined} />
        </Divided>
      </Card>

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <Divided>
          <SettingRow icon={Volume2} label="Sound effects" onPress={() => setSound(!sound)} right={<Switch value={sound} onChange={setSound} label="Sound effects" />} />
          <SettingRow icon={Cloud} label="Cloud database" value={cloudConfig() ? 'On' : 'Off'} onPress={() => setSheet('cloud')} />
          <SettingRow icon={Ban} label="Blocked players" value={String(Object.keys(blocked).length)} onPress={() => setSheet('blocked')} testID="blocked-players" />
        </Divided>
      </Card>

      <SectionLabel>Legal</SectionLabel>
      <Card>
        <Divided>
          <SettingRow icon={Shield} label="Privacy Policy" onPress={() => setSheet('privacy')} testID="open-privacy" />
          <SettingRow icon={FileText} label="Terms of Use (16+)" onPress={() => setSheet('terms')} testID="open-terms" />
        </Divided>
      </Card>

      <Button variant="secondary" title="Sign out" icon={LogOut} onPress={onSignOut} style={{ marginTop: 32 }} testID="sign-out" />
      <T muted size={12.5} center style={{ marginTop: 12 }}>
        Signing out keeps your account — log back in any time.
      </T>

      <TouchableOpacity
        onPress={() => setSheet('delete')}
        activeOpacity={0.7}
        testID="open-delete"
        accessibilityRole="button"
        style={{ marginTop: 32, height: 48, borderRadius: 999, borderWidth: 1, borderColor: t.c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Trash2 size={17} color={t.c.fg} />
        <T size={14.5} w={600}>
          Delete Account Permanently
        </T>
      </TouchableOpacity>
      <View style={{ height: 16 }} />

      {sheet === 'cloud' && <CloudSheet onClose={closeSheet} />}
      {sheet === 'blocked' && <BlockedSheet onClose={closeSheet} />}
      {(sheet === 'privacy' || sheet === 'terms') && <LegalSheet doc={sheet} onClose={closeSheet} />}
      {sheet === 'delete' && <DeleteSheet account={account} onDeleted={onDeleted} onClose={closeSheet} />}
    </Screen>
  );
}
