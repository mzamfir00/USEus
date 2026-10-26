// Monetization config: RevenueCat in-app purchases and Google AdMob ad units.
//
// RevenueCat refuses to run a Test Store key (test_…) in a release build: the SDK crashes the
// app on purpose. Development builds use the Test Store key below; release builds use the store
// keys CI injects (EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = goog_…, EXPO_PUBLIC_REVENUECAT_IOS_KEY =
// appl_…) and keep purchases switched off until those exist.
import { Platform } from 'react-native';

const pick = (ios, android) => (Platform.OS === 'ios' ? ios : android);

/* ------------------------------- RevenueCat ------------------------------- */

export const REVENUECAT_TEST_API_KEY = 'test_ZVrtCfKVBMZUoqZPnveXZKdQIUI';
export const REVENUECAT_API_KEY = pick(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) || REVENUECAT_TEST_API_KEY;
export const ENTITLEMENT_ID = 'pro';

export const PRODUCTS = {
  weekend: 'useus_weekend_pass',
  lifetime: 'useus_pro_host_lifetime',
  radar: 'useus_radar_pack',
};

export const WEEKEND_PASS_MS = 48 * 3600 * 1000;
export const RADAR_PACK_PINGS = 10;
export const RADAR_PACK_XP = 1000;

// Store cards, in display order. Prices are replaced by the store's localized price when known.
export const PLANS = [
  {
    id: 'weekend',
    product: PRODUCTS.weekend,
    title: 'Weekend Pass',
    price: '€0.99',
    term: '48 hours',
    perks: ['Every Pro & Halloween game for your whole room', 'No ads for anyone in your room', 'Starts the moment you buy'],
  },
  {
    id: 'lifetime',
    product: PRODUCTS.lifetime,
    title: 'Pro Host — Lifetime',
    price: '€4.99',
    term: 'forever',
    best: true,
    perks: ['Every game & pack, forever, in any room you host', 'Zero ads — for you and your whole squad', 'Exclusive Monochrome VIP room theme'],
  },
  {
    id: 'radar',
    product: PRODUCTS.radar,
    title: 'Radar Pack',
    price: '€0.99',
    term: 'one-time',
    perks: [`+${RADAR_PACK_PINGS} Emergency Radar Pings for GPS hunts`, `+${RADAR_PACK_XP.toLocaleString('en-US')} XP boost on your profile`],
  },
];

/* --------------------------------- AdMob ---------------------------------- */

export const ADMOB_APP_ID = pick('ca-app-pub-5297692661147791~8667723772', 'ca-app-pub-5297692661147791~7933848729');
export const REWARDED_AD_UNIT_ID = pick('ca-app-pub-5297692661147791/1560012063', 'ca-app-pub-5297692661147791/2042005674');
export const INTERSTITIAL_AD_UNIT_ID = pick('ca-app-pub-5297692661147791/3934271847', 'ca-app-pub-5297692661147791/1015544595');

export const INTERSTITIAL_EVERY = 3; // completed rounds between post-round interstitials
export const SPONSOR_BREAK_S = 10; // in-app fallback when no rewarded ad is ready

/* ------------------------------ Monochrome VIP ---------------------------- */

// The lifetime pass's exclusive room theme (native app only).
export const VIP_STYLE = { id: 'vip', name: 'Monochrome VIP', short: 'VIP', motto: 'Pro hosts only: deep black, silver hairlines and stamped capitals.' };
