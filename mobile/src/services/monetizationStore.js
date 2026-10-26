// Shared monetization state for both platforms: the player's own passes, emergency radar pings,
// store availability, and the in-app Sponsor Break that stands in for a rewarded ad when none
// is ready. monetizationService.js (native) and monetizationService.web.js feed it.
import { useSyncExternalStore } from 'react';
import { ENTITLEMENT_ID, PRODUCTS, RADAR_PACK_PINGS, SPONSOR_BREAK_S, WEEKEND_PASS_MS } from '../config/monetization';
import { hydrateStorage, readJSON, writeJSON } from '../lib/storage';

const KEY = 'useus.monetization.v1'; // userId -> { radarUsed }

let state = {
  storeReady: false, // RevenueCat configured and answering
  storeNote: '', // why purchases are unavailable, shown in the store
  adsReady: false, // consent gathered and the AdMob SDK initialised
  privacyOptions: false, // AdMob consent: show "Ad privacy choices" in Profile
  pro: null, // this player's own pass: { plan: 'weekend' | 'lifetime', until }
  proLoaded: false, // the store has answered at least once
  radarBought: 0, // emergency pings bought, all time
  radarTx: [], // Radar Pack transaction ids (each grants its XP boost once)
  radarUsed: 0,
  prices: {}, // product id -> localized price
  sponsor: null, // { id, placement, endsAt } while the in-app sponsor break runs
  storeOpen: false, // the Pro Pass store sheet
};
let userId = null;
const listeners = new Set();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useMonetization = () => useSyncExternalStore(subscribe, getState);

export const hydrateMonetization = () => hydrateStorage([KEY]);
const saved = () => readJSON(KEY, {});
const mine = () => saved()[userId || 'guest'] || { radarUsed: 0 };
const saveMine = (patch) => writeJSON(KEY, { ...saved(), [userId || 'guest']: { ...mine(), ...patch } });

export function setUser(id) {
  userId = id || null;
  setState({ radarUsed: mine().radarUsed || 0 });
}

export const openStore = () => setState({ storeOpen: true });
export const closeStore = () => setState({ storeOpen: false });

/* ---------------------------------- passes -------------------------------- */

export const activePro = (pro, now = Date.now()) => (pro && (pro.until == null || pro.until > now) ? pro : null);
export const radarLeft = (s = state) => Math.max(0, s.radarBought - s.radarUsed);

// RevenueCat grants non-subscription products forever, so the 48-hour window of the Weekend
// Pass is measured from its newest purchase, whatever the dashboard attaches it to.
export function proFromCustomerInfo(info, now = Date.now()) {
  const tx = info?.nonSubscriptionTransactions || [];
  const of = (id) => tx.filter((t) => t.productIdentifier === id);
  const ent = info?.entitlements?.active?.[ENTITLEMENT_ID];
  if (of(PRODUCTS.lifetime).length) return { plan: 'lifetime', until: null };
  if (ent && ent.productIdentifier !== PRODUCTS.weekend && ent.productIdentifier !== PRODUCTS.radar) {
    return { plan: 'lifetime', until: ent.expirationDate ? Date.parse(ent.expirationDate) || null : null };
  }
  const last = Math.max(0, ...of(PRODUCTS.weekend).map((t) => Date.parse(t.purchaseDate) || 0));
  return last && last + WEEKEND_PASS_MS > now ? { plan: 'weekend', until: last + WEEKEND_PASS_MS } : null;
}

let expiry = null;
export function setCustomerInfo(info) {
  const pro = proFromCustomerInfo(info);
  const packs = (info?.nonSubscriptionTransactions || []).filter((t) => t.productIdentifier === PRODUCTS.radar);
  const radarTx = packs.map((t) => t.transactionIdentifier).filter(Boolean);
  setState({ pro, proLoaded: true, radarBought: packs.length * RADAR_PACK_PINGS, ...(radarTx.join() !== state.radarTx.join() && { radarTx }) });
  clearTimeout(expiry); // the Weekend Pass ends on its own
  if (pro?.until) expiry = setTimeout(() => setCustomerInfo(info), Math.min(2 ** 31 - 1, Math.max(1000, pro.until - Date.now() + 1000)));
}

export function consumeRadarPing() {
  const used = (mine().radarUsed || 0) + 1;
  saveMine({ radarUsed: used });
  setState({ radarUsed: used });
}

/* ------------------------------- ad guard --------------------------------- */

// Rooms switch ads off for the countdown and live play (camera, flashlight and mic in use).
let adsAllowed = true;
export const adsAllowedNow = () => adsAllowed;
export function setAdsAllowed(on) {
  adsAllowed = on;
  if (!on && state.sponsor) endSponsorBreak(false);
}

/* ------------------------------ sponsor break ----------------------------- */

let sponsorDone = null;
const sponsorSeconds = () => globalThis.__USEUS_TEST_SPONSOR_S__ || SPONSOR_BREAK_S; // test seam

// The in-app countdown that grants a reward when no rewarded ad could be shown.
export function startSponsorBreak(placement) {
  if (!adsAllowed) return Promise.resolve(false);
  sponsorDone?.(false);
  return new Promise((resolve) => {
    sponsorDone = resolve;
    setState({ sponsor: { id: Date.now(), placement, endsAt: Date.now() + sponsorSeconds() * 1000 } });
  });
}

export function endSponsorBreak(rewarded) {
  const done = sponsorDone;
  sponsorDone = null;
  setState({ sponsor: null });
  done?.(!!rewarded);
}
