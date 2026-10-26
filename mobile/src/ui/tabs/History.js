import React from 'react';
import { ScrollView, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { DNA_STYLES, dnaInfo } from '../../core';
import { roomBadges } from '../../lib/database';
import { Card, Divided, Empty, LevelDots, Screen, ScreenHeader, SectionLabel, T, Title } from '../primitives';

const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const when = (ts) => {
  const d = new Date(ts);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export default function History({ account }) {
  const rooms = roomBadges(account.id).filter((r) => (r.dna?.completed || 0) > 0);
  const missions = account.history || [];

  return (
    <Screen testID="tab-history">
      <ScreenHeader title="History" />

      {rooms.length > 0 && (
        <>
          <SectionLabel>Room evolution</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingBottom: 4 }}>
            {rooms.map((r) => {
              const info = dnaInfo(r.dna);
              return (
                <Card key={r.code} style={{ width: 156 }} inner={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T size={15} w={600} ls={1.2} tnum>
                      {r.code}
                    </T>
                    <LevelDots stage={info.stage} />
                  </View>
                  <Title size={17} style={{ marginTop: 24 }}>
                    {DNA_STYLES[info.style].name}
                  </Title>
                  <T muted size={12.5} style={{ marginTop: 4 }}>
                    Level {info.stage} · {info.completed} mission{info.completed === 1 ? '' : 's'}
                  </T>
                </Card>
              );
            })}
          </ScrollView>
        </>
      )}

      <SectionLabel>Missions</SectionLabel>
      {missions.length > 0 ? (
        <Card>
          <Divided>
            {missions.map((h, i) => (
              <View key={`${h.at}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}>
                <View style={{ flex: 1 }}>
                  <T size={16} w={600} numberOfLines={1}>
                    {h.mission}
                  </T>
                  <T muted size={13.5} numberOfLines={1} style={{ marginTop: 2 }}>
                    {h.location ? `${h.location} · ` : ''}with {(h.squad || []).filter((n) => n !== account.name).join(', ') || 'the squad'}
                  </T>
                  {h.result ? (
                    <T muted size={12.5} numberOfLines={1} style={{ marginTop: 2 }}>
                      {h.result}
                    </T>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={13} w={500}>
                    {'won' in h ? (h.won ? 'Won' : 'Lost') : h.outcome === 'complete' ? 'Completed' : 'Chickened'}
                  </T>
                  <T muted size={12}>
                    {when(h.at)}
                  </T>
                </View>
              </View>
            ))}
          </Divided>
        </Card>
      ) : (
        <Empty icon={Clock} title="No missions yet" body="Rounds you play show up here, along with the rooms you’ve evolved." />
      )}
    </Screen>
  );
}
