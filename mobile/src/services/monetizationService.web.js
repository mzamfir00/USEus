// Web build of the monetization service (Expo web preview / test harness): no ad SDK and no
// store. Rewarded placements run the in-app Sponsor Break, so every flow stays playable.
import { getState, hydrateMonetization, setState, setUser, startSponsorBreak, adsAllowedNow } from './monetizationStore';

export * from './monetizationStore';

const NOTE = 'In-app purchases are available in the USEus app for Android and iOS.';

export async function initAds() {}
export const showPrivacyOptions = async () => {};

export const showRewarded = (placement) => (adsAllowedNow() ? startSponsorBreak(placement) : Promise.resolve(false));
export const showInterstitial = async () => false;

export async function initPurchases(accountId) {
  await hydrateMonetization();
  setUser(accountId);
  // Test seam: the harness can play as a Pro host.
  const testPro = globalThis.__USEUS_TEST_PRO__;
  setState({ storeNote: NOTE, pro: testPro ? { plan: testPro, until: testPro === 'weekend' ? Date.now() + 48 * 3600e3 : null } : getState().pro });
}

export async function identify(accountId) {
  setUser(accountId);
}

export const purchase = async () => ({ ok: false, error: NOTE });
export const restore = async () => ({ ok: false, error: NOTE });
export const presentPaywall = async () => 'unavailable';
