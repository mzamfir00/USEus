// The in-app Sponsor Break: when no rewarded ad is ready (new AdMob units can take an hour to
// fill), a 10-second monochrome countdown plays instead and grants the reward at zero, so a
// rewarded button always works.
import React, { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { endSponsorBreak, useMonetization } from '../../services/monetizationService';
import { T } from '../primitives';

function Countdown({ sponsor }) {
  const [now, setNow] = useState(Date.now());
  const total = Math.max(1, Math.round((sponsor.endsAt - sponsor.id) / 1000));
  const left = Math.max(0, Math.ceil((sponsor.endsAt - now) / 1000));

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (left === 0) endSponsorBreak(true);
  }, [left]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} testID="sponsor-break">
      <T size={12.5} w={700} ls={2.2} color="#fff" center accessibilityLiveRegion="polite" testID="sponsor-label">
        {`SPONSOR BREAK • UNLOCKING REWARD IN ${left}s...`}
      </T>
      <T size={112} w={800} tnum color="#fff" style={{ marginTop: 24, lineHeight: 120 }}>
        {left}
      </T>
      <View style={{ marginTop: 24, width: '100%', maxWidth: 320, height: 4, borderRadius: 2, backgroundColor: '#262626', overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%`, height: 4, backgroundColor: '#fff' }} />
      </View>
      {sponsor.placement ? (
        <T size={14} color="rgba(255,255,255,0.6)" center style={{ marginTop: 20, maxWidth: 300 }} lh={1.4}>
          {sponsor.placement}
        </T>
      ) : null}
      <TouchableOpacity onPress={() => endSponsorBreak(false)} style={{ position: 'absolute', bottom: 48, paddingHorizontal: 20, paddingVertical: 12 }} testID="sponsor-skip" accessibilityRole="button">
        <T size={13} w={500} color="rgba(255,255,255,0.45)">
          Skip — no reward
        </T>
      </TouchableOpacity>
    </View>
  );
}

export default function SponsorBreakHost() {
  const { sponsor } = useMonetization();
  if (!sponsor) return null;
  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => endSponsorBreak(false)}>
      <Countdown key={sponsor.id} sponsor={sponsor} />
    </Modal>
  );
}
