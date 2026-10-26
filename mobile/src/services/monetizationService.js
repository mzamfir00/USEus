// Native monetization: Google AdMob (rewarded + post-round interstitial) and RevenueCat
// in-app purchases (react-native-purchases, paywall from react-native-purchases-ui).
// Ads are preloaded in the background and reloaded after every display. A rewarded placement
// never gets stuck: with no ad ready (new units can take an hour to fill) the in-app Sponsor
// Break counts down and grants the reward instead.
import mobileAds, { AdEventType, AdsConsent, InterstitialAd, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import Purchases, { PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_ID, INTERSTITIAL_AD_UNIT_ID, PRODUCTS, REVENUECAT_API_KEY, REWARDED_AD_UNIT_ID } from '../config/monetization';
import { adsAllowedNow, getState, hydrateMonetization, setCustomerInfo, setState, setUser, startSponsorBreak } from './monetizationStore';

export * from './monetizationStore';

// Development builds request Google's test ads; never click your own live ads.
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : REWARDED_AD_UNIT_ID;
const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : INTERSTITIAL_AD_UNIT_ID;
const RETRY_MS = 30000;
const LOAD_WAIT_MS = 2500;

/* ---------------------------------- ads ----------------------------------- */

// One preloaded full-screen ad that reloads itself after it is shown or fails.
function adSlot(create, loadedEvent) {
  const slot = { ad: null, loaded: false, loading: false, retry: null, onClose: null, onReward: null, earned: false };
  const settle = (shown) => {
    const done = slot.onClose;
    slot.onClose = null;
    slot.onReward = null;
    done?.(shown);
  };
  slot.load = () => {
    if (!getState().adsReady || slot.loaded || slot.loading) return;
    clearTimeout(slot.retry);
    if (!slot.ad) {
      slot.ad = create();
      slot.ad.addAdEventListener(loadedEvent, () => {
        slot.loading = false;
        slot.loaded = true;
      });
      slot.ad.addAdEventListener(AdEventType.ERROR, (e) => {
        console.warn('[ads] no ad', e?.code || e?.message || e);
        slot.loading = false;
        slot.loaded = false;
        settle(false);
        slot.retry = setTimeout(slot.load, RETRY_MS); // no fill yet: try again in the background
      });
      slot.ad.addAdEventListener(AdEventType.CLOSED, () => {
        slot.loaded = false;
        settle(true);
        slot.load();
      });
      if (loadedEvent === RewardedAdEventType.LOADED) {
        slot.ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          slot.earned = true;
        });
      }
    }
    slot.loading = true;
    try {
      slot.ad.load();
    } catch (e) {
      slot.loading = false;
    }
  };
  // Shows the ad if it's ready; resolves to whether it was shown (and closed).
  slot.show = () =>
    new Promise((resolve) => {
      if (!slot.loaded || !slot.ad) {
        resolve(false);
        return;
      }
      slot.earned = false;
      slot.onClose = resolve;
      slot.ad.show().catch(() => {
        slot.loaded = false;
        settle(false);
        slot.load();
      });
    });
  slot.waitLoaded = async (ms) => {
    const until = Date.now() + ms;
    while (slot.loading && !slot.loaded && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
    return slot.loaded;
  };
  return slot;
}

const rewarded = adSlot(() => RewardedAd.createForAdRequest(REWARDED_ID), RewardedAdEventType.LOADED);
const interstitial = adSlot(() => InterstitialAd.createForAdRequest(INTERSTITIAL_ID), AdEventType.LOADED);

let adsStarted = false;

// GDPR / US-state consent first (Google's UMP form, when the AdMob account has one), then the
// SDK, then both ads start preloading.
export async function initAds() {
  if (adsStarted) return;
  adsStarted = true;
  try {
    const consent = await AdsConsent.gatherConsent().catch((e) => {
      console.warn('[ads] consent', e);
      return null;
    });
    if (consent && consent.canRequestAds === false) return;
    await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.T });
    await mobileAds().initialize();
    setState({ adsReady: true, privacyOptions: consent?.privacyOptionsRequirementStatus === 'REQUIRED' });
    rewarded.load();
    interstitial.load();
  } catch (e) {
    console.warn('[ads] init failed', e);
    adsStarted = false;
  }
}

export const showPrivacyOptions = () => AdsConsent.showPrivacyOptionsForm().catch(() => {});

// Rewarded placement: resolves true once the player has earned the reward.
export async function showRewarded(placement) {
  if (!adsAllowedNow()) return false;
  if (getState().adsReady) {
    if (!rewarded.loaded) rewarded.load();
    if (rewarded.loaded || (await rewarded.waitLoaded(LOAD_WAIT_MS))) {
      const shown = await rewarded.show();
      if (shown) return rewarded.earned;
    }
  }
  return startSponsorBreak(placement); // not loaded yet / no fill / failed to show
}

// Post-round interstitial: resolves once it closes (or right away when none is ready).
export async function showInterstitial() {
  if (!adsAllowedNow() || !getState().adsReady) return false;
  if (!interstitial.loaded) {
    interstitial.load();
    return false;
  }
  return interstitial.show();
}

/* -------------------------------- purchases ------------------------------- */

// RevenueCat crashes a release build configured with a Test Store key: only use it in dev.
const keyUsable = !REVENUECAT_API_KEY.startsWith('test_') || __DEV__;
let configured = false;

async function refreshCustomerInfo() {
  try {
    setCustomerInfo(await Purchases.getCustomerInfo());
  } catch (e) {
    console.warn('[purchases] customer info', e);
  }
}

async function loadPrices() {
  try {
    const products = await Purchases.getProducts(Object.values(PRODUCTS), PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    setState({ prices: Object.fromEntries(products.map((p) => [p.identifier, p.priceString])) });
  } catch (e) {
    console.warn('[purchases] prices', e);
  }
}

export async function initPurchases(accountId) {
  await hydrateMonetization();
  setUser(accountId);
  if (configured) return;
  if (!keyUsable) {
    setState({ storeNote: 'Purchases open as soon as this build is connected to Google Play.' });
    return;
  }
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: accountId || undefined });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    setState({ storeReady: true, storeNote: '' });
    await Promise.all([refreshCustomerInfo(), loadPrices()]);
  } catch (e) {
    console.warn('[purchases] configure failed', e);
    setState({ storeNote: 'The store isn’t reachable right now. Try again later.' });
  }
}

// Purchases follow the USEus account, so a pass bought on one phone restores on another.
export async function identify(accountId) {
  setUser(accountId);
  if (!configured) return;
  try {
    if (accountId) setCustomerInfo((await Purchases.logIn(accountId)).customerInfo);
    else if (!(await Purchases.isAnonymous())) setCustomerInfo(await Purchases.logOut());
  } catch (e) {
    console.warn('[purchases] identify', e);
  }
}

const cancelled = (e) => e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;

export async function purchase(planId) {
  if (!configured) return { ok: false, error: getState().storeNote || 'The store isn’t available on this phone.' };
  try {
    const [product] = await Purchases.getProducts([PRODUCTS[planId]], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (!product) return { ok: false, error: 'This item isn’t in the store yet.' };
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    setCustomerInfo(customerInfo);
    return { ok: true };
  } catch (e) {
    if (cancelled(e)) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message || 'The purchase didn’t go through.' };
  }
}

// Required by the App Store and Google Play: bring back purchases on a new phone.
export async function restore() {
  if (!configured) return { ok: false, error: getState().storeNote || 'The store isn’t available on this phone.' };
  try {
    setCustomerInfo(await Purchases.restorePurchases());
    return { ok: true, pro: getState().pro };
  } catch (e) {
    return { ok: false, error: e?.message || 'Couldn’t restore purchases.' };
  }
}

// RevenueCat's native paywall (configured in the RevenueCat dashboard).
export async function presentPaywall() {
  if (!configured) return 'unavailable';
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT_ID });
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) await refreshCustomerInfo();
    return result;
  } catch (e) {
    console.warn('[purchases] paywall', e);
    return 'error';
  }
}
