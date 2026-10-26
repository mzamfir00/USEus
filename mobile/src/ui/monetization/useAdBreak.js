// Room-aware ad breaks. While a phone shows an ad it tells the host it's busy, so the
// countdown can't start without it, and ads never open during a countdown or live round.
import { useCallback, useRef } from 'react';
import { roomPro } from '../../core';
import { INTERSTITIAL_EVERY } from '../../config/monetization';
import { activePro, showInterstitial, showRewarded, useMonetization } from '../../services/monetizationService';

// Post-round interstitial is due after every 3rd completed round, unless the host has Pro.
export const interstitialDue = (view) => !!view?.monetized && !roomPro(view) && view.completedRounds > 0 && view.completedRounds % INTERSTITIAL_EVERY === 0;

const until = async (check, ms) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 120));
  }
  return true;
};

// `free`: the player or the room's host has Pro, so rewards come without an ad.
export function useAdBreak(view, intent) {
  const { pro } = useMonetization();
  const free = !!activePro(pro) || roomPro(view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const me = () => viewRef.current?.me;

  // Back from a full-screen ad the room connection may be rebuilding: re-send an action until
  // the host's state shows it (or give up after a while).
  const confirm = useCallback(
    async (action, check, ms = 12000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        intent(action);
        if (await until(() => check(viewRef.current), 1500)) return true;
      }
      return false;
    },
    [intent]
  );

  // Resolves true when the reward is earned, false when skipped, null when the room
  // couldn't confirm the hold in time (the ad is not shown).
  const rewarded = useCallback(
    async (placement, { hold = false } = {}) => {
      if (free) return true;
      intent({ type: 'busy', on: true });
      let shown = false;
      try {
        if (hold && !(await until(() => !!viewRef.current?.busy?.[me()], 2500))) return null;
        shown = true;
        return await showRewarded(placement);
      } finally {
        if (shown) confirm({ type: 'busy', on: false }, (v) => !v?.busy?.[me()]);
        else intent({ type: 'busy', on: false });
      }
    },
    [free, intent, confirm]
  );

  const interstitial = useCallback(
    async ({ hold = false } = {}) => {
      if (free) return false;
      if (hold) intent({ type: 'busy', on: true });
      try {
        return await showInterstitial();
      } finally {
        if (hold) confirm({ type: 'busy', on: false }, (v) => !v?.busy?.[me()]);
      }
    },
    [free, intent, confirm]
  );

  // Host-side one-match unlock of a Pro game or feature: { title, what, ids, after }.
  const unlock = useCallback(
    async (gate) => {
      const ok = await rewarded(`Unlocking ${gate.what} for this round`);
      if (ok) {
        intent({ type: 'unlock', ids: gate.ids });
        gate.after?.();
      }
      return ok;
    },
    [rewarded, intent]
  );

  return { free, rewarded, interstitial, confirm, unlock };
}
