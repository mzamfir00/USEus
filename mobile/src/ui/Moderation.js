// Player safety: block (hidden on this phone), report (logged for moderation) and, for the
// host, remove from the room.
import React, { useState, useSyncExternalStore } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Ban, Check, Flag, UserMinus } from 'lucide-react-native';
import { blockedUsers, blockUser, REPORT_REASONS, reportUser, unblockUser } from '../lib/database';
import { inter, useTheme } from '../theme';
import { Avatar, Button, Card, Divided, Pill, Sheet, T, Title } from './primitives';

// Re-render whenever the blocklist changes on this phone.
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
let snapshot = null;
export function useBlocked() {
  const raw = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => {
      if (snapshot == null) snapshot = JSON.stringify(blockedUsers());
      return snapshot;
    }
  );
  return JSON.parse(raw);
}
const refresh = () => {
  snapshot = JSON.stringify(blockedUsers());
  emit();
};

function ActionRow({ icon: Icon, label, onPress, testID }) {
  const t = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
      <Icon size={18} color={t.c.fg} />
      <T size={15}>{label}</T>
    </TouchableOpacity>
  );
}

export function ReportForm({ player, reporter, room, onDone }) {
  const t = useTheme();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  if (state === 'sent') {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }} testID="report-sent">
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.c.fg, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={22} color={t.c.bg} />
        </View>
        <Title size={20} style={{ marginTop: 16 }}>
          Report sent
        </Title>
        <T muted size={14} lh={1.5} center style={{ marginTop: 8 }}>
          Thanks. We review every report within 24 hours. You can also block @{player.username} so you never see them again.
        </T>
        <Button title="Done" onPress={onDone} style={{ marginTop: 24, alignSelf: 'stretch' }} />
      </View>
    );
  }
  return (
    <View>
      <T muted size={14} style={{ marginBottom: 16, marginTop: -8 }}>
        What’s wrong with @{player.username}?
      </T>
      <Card>
        <Divided>
          {REPORT_REASONS.map(([id, label]) => (
            <TouchableOpacity
              key={id}
              onPress={() => setReason(id)}
              activeOpacity={0.7}
              testID={`reason-${id}`}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: reason === id ? t.c.fg : 'transparent' }}
            >
              <T size={15} color={reason === id ? t.c.bg : t.c.fg}>
                {label}
              </T>
              {reason === id && <Check size={16} color={t.c.bg} />}
            </TouchableOpacity>
          ))}
        </Divided>
      </Card>
      <TextInput
        value={details}
        onChangeText={(v) => setDetails(v.slice(0, 500))}
        placeholder="Details (optional)"
        placeholderTextColor={t.c.faint}
        accessibilityLabel="Report details"
        multiline
        textAlignVertical="top"
        style={{ marginTop: 12, height: 96, borderRadius: 14, backgroundColor: t.c.card, borderWidth: 1, borderColor: t.c.border, color: t.c.fg, fontSize: 15, fontFamily: inter(400), padding: 14 }}
      />
      <Button
        title={state === 'sending' ? 'Sending…' : 'Send report'}
        disabled={!reason || state === 'sending'}
        testID="send-report"
        style={{ marginTop: 16 }}
        onPress={async () => {
          setState('sending');
          await reportUser({ reporter, player, reason, details, room });
          setState('sent');
        }}
      />
    </View>
  );
}

// Actions sheet for one player. `onRemove` is only passed to the host.
export function PlayerActions({ player, reporter, room, onRemove, onClose }) {
  const blocked = useBlocked();
  const [mode, setMode] = useState('menu'); // menu | report | block
  const isBlockedNow = !!blocked[player.username];
  return (
    <Sheet title={mode === 'report' ? 'Report player' : mode === 'block' ? 'Block player' : null} onClose={onClose} testID="player-actions">
      {mode === 'menu' && (
        <>
          <View style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={player.name} size={44} />
            <View style={{ flexShrink: 1 }}>
              <T size={17} w={600} numberOfLines={1}>
                {player.name}
              </T>
              <T muted size={14}>
                @{player.username}
              </T>
            </View>
          </View>
          <Card>
            <Divided>
              {onRemove ? (
                <ActionRow
                  icon={UserMinus}
                  label="Remove from room"
                  testID="remove-player"
                  onPress={() => {
                    onRemove(player);
                    onClose();
                  }}
                />
              ) : null}
              <ActionRow icon={Flag} label={`Report @${player.username}`} testID="report-player" onPress={() => setMode('report')} />
              <ActionRow
                icon={Ban}
                testID="block-player"
                label={isBlockedNow ? `Unblock @${player.username}` : `Block @${player.username}`}
                onPress={() => {
                  if (isBlockedNow) {
                    unblockUser(player.username);
                    refresh();
                    onClose();
                  } else setMode('block');
                }}
              />
            </Divided>
          </Card>
        </>
      )}
      {mode === 'report' && <ReportForm player={player} reporter={reporter} room={room} onDone={onClose} />}
      {mode === 'block' && (
        <View>
          <T muted size={14.5} lh={1.5} style={{ marginTop: -8 }}>
            @{player.username} will be hidden on this phone: their name, photos and friend requests disappear
            {onRemove ? ', and they are removed from your room and can’t rejoin it' : ''}. They aren’t notified.
          </T>
          <Button
            title={`Block @${player.username}`}
            icon={Ban}
            testID="confirm-block"
            style={{ marginTop: 24 }}
            onPress={() => {
              blockUser(player);
              refresh();
              if (onRemove) onRemove(player);
              onClose();
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

export function BlockedSheet({ onClose }) {
  const blocked = useBlocked();
  const list = Object.entries(blocked);
  return (
    <Sheet title="Blocked players" onClose={onClose}>
      {list.length ? (
        <Card>
          <Divided>
            {list.map(([username]) => (
              <View key={username} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
                <T size={15} w={500}>
                  @{username}
                </T>
                <Pill
                  label="Unblock"
                  onPress={() => {
                    unblockUser(username);
                    refresh();
                  }}
                />
              </View>
            ))}
          </Divided>
        </Card>
      ) : (
        <T muted size={14.5} center style={{ paddingVertical: 24 }}>
          Nobody is blocked. Block players from a room’s player list.
        </T>
      )}
    </Sheet>
  );
}
