// Host taps a Pro game (or the closing ring) without a Pro Pass: watch a short ad to unlock it
// for everyone in the room for one match, or get the Pro Host Pass.
import React, { useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { PLANS } from '../../config/monetization';
import { openStore, useMonetization } from '../../services/monetizationService';
import { T } from '../primitives';

const priceOf = (m, id) => {
  const plan = PLANS.find((p) => p.id === id);
  return m.prices[plan.product] || plan.price;
};

function Option({ inverted, title, sub, onPress, disabled, testID }) {
  const fg = inverted ? '#000' : '#fff';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={{ borderRadius: 20, borderWidth: 1, borderColor: '#fff', backgroundColor: inverted ? '#fff' : '#000', paddingHorizontal: 18, paddingVertical: 16, opacity: disabled ? 0.4 : 1 }}
    >
      <T size={14} w={800} ls={0.3} lh={1.3} color={fg}>
        {title}
      </T>
      <T size={12.5} lh={1.35} color={inverted ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.65)'} style={{ marginTop: 4 }}>
        {sub}
      </T>
    </TouchableOpacity>
  );
}

// gate: { title, what, ids } — `what` names the unlock ("Sardines", "the closing ring").
export default function ProGate({ gate, onWatch, onClose }) {
  const m = useMonetization();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!gate) return null;

  const watch = async () => {
    setBusy(true);
    setNote('');
    const ok = await onWatch(gate);
    setBusy(false);
    if (ok) onClose();
    else setNote('No reward this time: the ad was skipped.');
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }} testID="pro-gate">
        <View style={{ width: '100%', maxWidth: 400, borderRadius: 28, borderWidth: 1, borderColor: '#fff', backgroundColor: '#000', padding: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Zap size={12} color="rgba(255,255,255,0.6)" />
            <T size={11.5} w={800} ls={2} color="rgba(255,255,255,0.6)">
              PRO / AD-UNLOCKABLE
            </T>
          </View>
          <T size={24} w={800} ls={-0.4} color="#fff" center style={{ marginTop: 8 }}>
            {gate.title}
          </T>
          <T size={13.5} lh={1.4} color="rgba(255,255,255,0.65)" center style={{ marginTop: 8 }}>
            Free hosts unlock {gate.what} for one match with a short ad. Pro hosts play everything, ad-free.
          </T>
          <View style={{ marginTop: 20, gap: 10 }}>
            <Option
              inverted
              testID="gate-watch"
              disabled={busy}
              title={busy ? 'STARTING THE AD…' : '🎬 WATCH SHORT AD — UNLOCK FOR THIS ROUND'}
              sub="Unlocks it for every player in this room for 1 match."
              onPress={watch}
            />
            <Option
              testID="gate-pro"
              disabled={busy}
              title={`⚡ GET PRO HOST PASS (${priceOf(m, 'weekend')} Weekend / ${priceOf(m, 'lifetime')} Lifetime)`}
              sub="Unlock Everything & Remove Ads for Your Whole Squad"
              onPress={() => {
                onClose();
                openStore();
              }}
            />
          </View>
          {note ? (
            <T size={13} color="rgba(255,255,255,0.7)" center style={{ marginTop: 12 }}>
              {note}
            </T>
          ) : null}
          <TouchableOpacity onPress={onClose} disabled={busy} style={{ marginTop: 10, height: 44, alignItems: 'center', justifyContent: 'center' }} testID="gate-close">
            <T size={14} w={500} color="rgba(255,255,255,0.6)">
              Not now
            </T>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
