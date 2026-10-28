// Mafia briefing pieces: the hold-to-reveal secret role card, the Storyteller phone picker
// (lobby and briefing) and the public role guide.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Eye, Volume2 } from 'lucide-react-native';
import { BRIEFINGS, GAMES, MAFIA_LANGS, mafiaCount, mafiaLine, storytellerOf } from '../../core';
import { hasVoice, narrate } from '../../lib/storyteller';
import { haptic } from '../../lib/sound';
import { useTheme } from '../../theme';
import { Button, Card, Divided, Eyebrow, Pill, SectionLabel, Segmented, T, Title } from '../primitives';

const ROLES = GAMES.mafia.roles;
const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
export const roleTitle = (role) => `${ROLES[role]?.icon || ''} ${(ROLES[role]?.label || '').toUpperCase()}`.trim();

// Press and hold to see your secret role; let go and it hides again.
export function RoleCard({ view, compact = false }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const mine = view.mine || {};
  const role = mine.role;
  const team = (mine.team || []).filter((id) => id !== view.me);
  const checks = mine.checks || [];
  return (
    <Pressable
      onPressIn={() => {
        haptic.tick();
        setOpen(true);
      }}
      onPressOut={() => setOpen(false)}
      accessibilityRole="button"
      accessibilityLabel="Hold to reveal your role"
      testID="role-card"
      style={{ borderRadius: 24, borderWidth: 1, borderColor: open ? '#fff' : t.c.border, backgroundColor: open ? '#fff' : t.c.card, padding: compact ? 16 : 24, minHeight: compact ? 0 : 168, justifyContent: 'center' }}
    >
      {open && role ? (
        <View testID="role-revealed">
          <T size={11.5} w={700} ls={1.6} color="rgba(0,0,0,0.5)">
            YOUR SECRET ROLE
          </T>
          <T size={compact ? 24 : 32} w={800} ls={-0.6} color="#000" style={{ marginTop: 6 }} testID="role-name">
            {roleTitle(role)}
          </T>
          <T size={14.5} lh={1.4} color="#000" style={{ marginTop: 8 }}>
            {ROLES[role].brief}
          </T>
          {team.length > 0 && (
            <T size={13.5} w={600} color="#000" style={{ marginTop: 10 }}>
              Your Mafia partner{team.length > 1 ? 's' : ''}: {team.map((id) => nameOf(view, id)).join(', ')}
            </T>
          )}
          {checks.length > 0 && (
            <T size={13.5} color="#000" style={{ marginTop: 10 }}>
              Your findings: {checks.map((c) => `${nameOf(view, c.id)} ${c.mafia ? '= MAFIA' : '= innocent'}`).join(' · ')}
            </T>
          )}
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Eye size={compact ? 20 : 26} color={t.c.fg} />
          <T size={compact ? 14 : 16} w={700} ls={0.6} center style={{ marginTop: 8 }}>
            {role ? 'HOLD TO SEE YOUR SECRET ROLE' : 'YOU’RE WATCHING THIS ONE'}
          </T>
          {!compact && (
            <T muted size={13} center style={{ marginTop: 4 }}>
              Shield your screen. Let go and it hides again.
            </T>
          )}
        </View>
      )}
    </Pressable>
  );
}

// Host picks the phone that speaks and the narrator language. `where`: lobby (room settings)
// or brief (this game's briefing, where the chosen phone can also test its voice).
export function StorytellerSetup({ view, intent, where }) {
  const t = useTheme();
  const isHost = view.hostId === view.me;
  const online = view.players.filter((p) => p.connected);
  const s = where === 'lobby' ? view.settings.mafia || {} : view.round.data;
  const narrator = where === 'lobby' ? s.narrator || view.hostId : s.narrator;
  const lang = s.lang || 'ro';
  const speaking = where === 'brief' ? storytellerOf(view) : narrator;
  const mine = speaking === view.me;
  const [voice, setVoice] = useState(null);
  useEffect(() => {
    let live = true;
    if (mine) hasVoice(lang).then((v) => live && setVoice(v));
    return () => {
      live = false;
    };
  }, [mine, lang]);
  const set = (patch) => intent({ type: 'mafiaSettings', ...patch });

  return (
    <View testID="storyteller-setup">
      <SectionLabel>🔊 Storyteller speaker</SectionLabel>
      <Card inner={{ padding: 16 }}>
        <T size={14} lh={1.4} muted>
          One phone reads the whole game out loud. Its owner still plays — the phone does the narrating.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {online.map((p) => (
            <Pill
              key={p.id}
              label={`${p.name.split(' ')[0]}${p.id === view.hostId ? ' (host)' : ''}`}
              icon={p.id === narrator ? Volume2 : undefined}
              on={p.id === narrator}
              onPress={() => isHost && set({ narrator: p.id })}
              testID={`narrator-${p.username}`}
            />
          ))}
        </View>
        <View pointerEvents={isHost ? 'auto' : 'none'} style={{ marginTop: 12, opacity: isHost ? 1 : 0.7 }}>
          <Segmented
            value={lang}
            onChange={(l) => set({ lang: l })}
            options={Object.entries(MAFIA_LANGS).map(([id, l]) => ({ value: id, label: `${l.short} ${l.label}`, testID: `narrator-lang-${id}` }))}
          />
        </View>
        {mine && (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.c.border, paddingTop: 12 }}>
            <T size={13.5} w={600}>
              Your phone is the Storyteller. Turn the volume all the way up.
            </T>
            {voice === false && (
              <T size={13} lh={1.35} muted style={{ marginTop: 4 }} testID="voice-missing">
                No {MAFIA_LANGS[lang].label} voice found on this phone. Install it in Settings → Text-to-speech, or switch the narrator language.
              </T>
            )}
            <Button small variant="secondary" icon={Volume2} title="Test the voice" style={{ marginTop: 10 }} onPress={() => narrate(mafiaLine('sleep', lang), lang)} testID="test-voice" />
          </View>
        )}
      </Card>
    </View>
  );
}

// The public role guide: what every role does (nobody's own role is highlighted).
export function MafiaRules({ view }) {
  const t = useTheme();
  const n = view.round?.participants?.length || view.players.filter((p) => p.connected).length;
  const m = view.round?.data?.counts?.mafia || mafiaCount(n);
  return (
    <View testID="mafia-rules">
      <SectionLabel>{`This game · ${m} Mafia · 1 Doctor · 1 Detective · ${Math.max(0, n - m - 2)} Citizens`}</SectionLabel>
      <Card>
        <Divided>
          {['mafia', 'doctor', 'detective', 'citizen'].map((id) => (
            <View key={id} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <T size={15} w={700}>
                {roleTitle(id)}
              </T>
              <T muted size={13.5} lh={1.4} style={{ marginTop: 4 }}>
                {ROLES[id].brief}
              </T>
            </View>
          ))}
        </Divided>
      </Card>
      <SectionLabel>How a round flows</SectionLabel>
      <Card>
        <Divided>
          {BRIEFINGS.mafia.setup.concat(['Most votes is out and their role is revealed. A tie, or as many skips, saves everyone.', 'Citizens win when every Mafia member is out. The Mafia wins once they equal the rest.']).map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.c.fg, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} w={700} color={t.c.bg} tnum>
                  {i + 1}
                </T>
              </View>
              <T size={14} lh={1.35} style={{ flex: 1 }}>
                {step}
              </T>
            </View>
          ))}
        </Divided>
      </Card>
    </View>
  );
}

// The ready-up gate for Mafia: secret role card, Storyteller setup, the rules. `footer` is the
// ready bar (owned by the generic briefing).
export function MafiaBriefing({ view, intent, footer }) {
  return (
    <View style={{ flex: 1 }} testID="briefing">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 230 }}>
        <Eyebrow style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.7 }}>Mission briefing · secret roles</Eyebrow>
        <Title style={{ marginTop: 8 }}>{GAMES.mafia.name}</Title>
        <T muted size={15} lh={1.4} style={{ marginTop: 8 }}>
          Everyone plays. Hold the card to see your secret role — keep it to yourself. When everyone is ready, Night 1 begins and the Storyteller phone takes over.
        </T>
        <View style={{ marginTop: 20 }}>
          <RoleCard view={view} />
        </View>
        <StorytellerSetup view={view} intent={intent} where="brief" />
        <MafiaRules view={view} />
      </ScrollView>
      {footer}
    </View>
  );
}
