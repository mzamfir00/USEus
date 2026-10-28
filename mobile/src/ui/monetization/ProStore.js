// The Pro Host Pass store: our monochrome store sheet, RevenueCat's native paywall as a
// second way in, and Restore Purchases (required by the App Store and Google Play).
import React, { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Check, Radar, RotateCcw, Sparkles, Zap } from 'lucide-react-native';
import { GAMES } from '../../core';
import { PLANS } from '../../config/monetization';
import { activePro, closeStore, presentPaywall, purchase, radarLeft, restore, useMonetization } from '../../services/monetizationService';
import { useTheme } from '../../theme';
import { Button, Card, Divided, Eyebrow, Sheet, T } from '../primitives';

export const HOST_PITCH = `When you host a room with Pro, all ${Object.keys(GAMES).length} games, Halloween Rituals, and Ad-Free matches are unlocked for every friend in your lobby!`;

export function proLabel(pro, now = Date.now()) {
  const p = activePro(pro, now);
  if (!p) return null;
  if (p.plan === 'lifetime') return 'Pro Host · Lifetime';
  const h = Math.max(1, Math.ceil((p.until - now) / 3600000));
  return `Weekend Pass · ${h} h left`;
}

function PlanCard({ plan, price, owned, busy, disabled, onBuy }) {
  const t = useTheme();
  const best = plan.best;
  const fg = best ? '#000' : t.c.fg;
  const sub = best ? 'rgba(0,0,0,0.6)' : t.c.muted;
  return (
    <View
      testID={`plan-${plan.id}`}
      style={{ borderRadius: 22, borderWidth: 1, borderColor: best ? '#fff' : t.c.border, backgroundColor: best ? '#fff' : t.c.bg, padding: 18 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {best ? (
            <T size={10.5} w={800} ls={1.6} color={sub}>
              BEST VALUE · VIP
            </T>
          ) : null}
          <T size={17} w={700} color={fg} style={{ marginTop: best ? 2 : 0 }}>
            {plan.title}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T size={20} w={800} tnum color={fg}>
            {price}
          </T>
          <T size={11.5} color={sub}>
            {plan.term}
          </T>
        </View>
      </View>
      <View style={{ marginTop: 12, gap: 6 }}>
        {plan.perks.map((perk) => (
          <View key={perk} style={{ flexDirection: 'row', gap: 8 }}>
            <Check size={14} color={fg} style={{ marginTop: 2 }} />
            <T size={13.5} lh={1.35} color={fg} style={{ flex: 1 }}>
              {perk}
            </T>
          </View>
        ))}
      </View>
      <Button
        small
        title={owned ? 'Active' : busy ? 'Opening the store…' : `Get ${plan.title.split(' — ')[0]} · ${price}`}
        icon={owned ? Check : Zap}
        disabled={disabled || owned || busy}
        bg={best ? '#000' : '#fff'}
        color={best ? '#fff' : '#000'}
        onPress={onBuy}
        style={{ marginTop: 16 }}
        testID={`buy-${plan.id}`}
      />
    </View>
  );
}

function ProStore({ onClose }) {
  const t = useTheme();
  const m = useMonetization();
  const [busy, setBusy] = useState(null); // plan id | 'restore' | 'paywall'
  const [note, setNote] = useState('');
  const pro = activePro(m.pro);
  const status = proLabel(m.pro);
  const pings = radarLeft(m);

  const run = async (key, fn) => {
    setBusy(key);
    setNote('');
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const buy = (plan) =>
    run(plan.id, async () => {
      const r = await purchase(plan.id);
      if (r.ok) setNote(plan.id === 'radar' ? 'Radar Pack added to your account.' : 'Pro is on. Host a room and every friend plays free.');
      else if (!r.cancelled) setNote(r.error);
    });

  return (
    <Sheet title="Pro Host Pass" onClose={onClose} testID="pro-store">
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: '#fff', backgroundColor: '#000', padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Sparkles size={15} color="#fff" />
          <T size={12} w={800} ls={1.8} color="#fff">
            ONLY THE HOST NEEDS PRO
          </T>
        </View>
        <T size={15} lh={1.45} color="#fff" style={{ marginTop: 10 }} testID="host-pitch">
          {HOST_PITCH}
        </T>
      </View>

      {(status || pings > 0) && (
        <Card style={{ marginTop: 12 }}>
          <Divided>
            {status ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 }} testID="pro-status">
                <Zap size={16} color={t.c.fg} />
                <T size={14.5} w={600} style={{ flex: 1 }}>
                  {status}
                </T>
                <T muted size={12.5}>
                  Active
                </T>
              </View>
            ) : null}
            {pings > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
                <Radar size={16} color={t.c.fg} />
                <T size={14.5} style={{ flex: 1 }}>
                  Emergency radar pings
                </T>
                <T size={14.5} w={700} tnum>
                  {pings}
                </T>
              </View>
            ) : null}
          </Divided>
        </Card>
      )}

      <View style={{ marginTop: 16, gap: 12 }}>
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            price={m.prices[plan.product] || plan.price}
            owned={(plan.id === 'lifetime' && pro?.plan === 'lifetime') || (plan.id === 'weekend' && !!pro)}
            busy={busy === plan.id}
            disabled={!m.storeReady || !!busy}
            onBuy={() => buy(plan)}
          />
        ))}
      </View>

      {!m.storeReady && m.storeNote ? (
        <T muted size={13} lh={1.4} center style={{ marginTop: 16 }} testID="store-note">
          {m.storeNote}
        </T>
      ) : null}
      {note ? (
        <T size={13.5} lh={1.4} center style={{ marginTop: 16 }} testID="store-message">
          {note}
        </T>
      ) : null}

      {m.storeReady && (
        <Button
          variant="secondary"
          icon={Sparkles}
          title={busy === 'paywall' ? 'Opening…' : 'See all offers'}
          disabled={!!busy}
          style={{ marginTop: 20 }}
          onPress={() =>
            run('paywall', async () => {
              const result = await presentPaywall();
              if (result === 'error') setNote('The offers page couldn’t open. Use the cards above.');
            })
          }
          testID="open-paywall"
        />
      )}
      <Button
        variant="ghost"
        icon={RotateCcw}
        color={t.c.fg}
        title={busy === 'restore' ? 'Restoring…' : 'Restore Purchases'}
        disabled={!!busy}
        style={{ marginTop: 8 }}
        onPress={() =>
          run('restore', async () => {
            const r = await restore();
            setNote(r.ok ? (r.pro ? `Restored: ${proLabel(r.pro)}.` : 'No passes to restore on this account.') : r.error);
          })
        }
        testID="restore-purchases"
      />
      {busy ? <ActivityIndicator color={t.c.fg} style={{ marginTop: 8 }} /> : null}
      <Eyebrow style={{ marginTop: 16, textAlign: 'center', fontSize: 11.5, lineHeight: 16 }}>
        One-time purchases through {Platform.OS === 'ios' ? 'the App Store' : 'Google Play'} — nothing renews. Passes follow your USEus account.
      </Eyebrow>
    </Sheet>
  );
}

// Mounted once at the app root: any screen can open the store with openStore().
export default function ProStoreHost() {
  const { storeOpen } = useMonetization();
  return storeOpen ? <ProStore onClose={closeStore} /> : null;
}
