// Geodesy helpers for the GPS Playzone (all distances in metres, angles in degrees).

const R = 6371008.8; // mean Earth radius
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Great-circle distance between two { lat, lng } points.
export function haversine(a, b) {
  if (!a || !b) return Infinity;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Initial compass bearing from a to b (0 = north, clockwise).
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// The point `dist` metres from `p` along compass bearing `brg`.
export function destination(p, dist, brg) {
  const d = dist / R;
  const t = rad(brg);
  const lat1 = rad(p.lat);
  const lng1 = rad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(t));
  const lng2 = lng1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 };
}

// Uniformly random point inside a circle.
export const randomInCircle = (center, radius, rand = Math.random) => destination(center, radius * Math.sqrt(rand()), rand() * 360);

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const cardinal = (brg) => CARDINALS[Math.round((((brg % 360) + 360) % 360) / 45) % 8];

export const formatDistance = (m) => (!Number.isFinite(m) ? '—' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/* ------------------------------- the zone -------------------------------- */

export const ZONE_BUFFER = 5; // GPS jitter allowance before you count as outside
export const ZONE_RETURN = 2; // must come back this close to the edge to count as inside
export const SHRINK_EVERY = 45000;
export const SHRINK_FACTOR = 0.8;
export const SHRINK_WINDOW = 180000; // the ring starts closing in the final 3 minutes
const SHRINK_STEPS = SHRINK_WINDOW / SHRINK_EVERY;

// How many times the ring has closed at `now` (0 before the final 3 minutes).
export const shrinkStep = (zone, now) => (zone?.shrink && now >= zone.shrinkStart ? Math.min(SHRINK_STEPS, Math.floor((now - zone.shrinkStart) / SHRINK_EVERY) + 1) : 0);

// Live radius in metres: -20% every 45 s once the battle-royale ring starts closing.
export const zoneRadius = (zone, now) => (zone ? zone.radius * SHRINK_FACTOR ** shrinkStep(zone, now) : 0);

// When the ring closes next (null when it is done or off).
export function nextShrinkAt(zone, now) {
  if (!zone?.shrink) return null;
  if (now < zone.shrinkStart) return zone.shrinkStart;
  const step = shrinkStep(zone, now);
  return step >= SHRINK_STEPS ? null : zone.shrinkStart + step * SHRINK_EVERY;
}

// 'in' | 'out' with hysteresis so a point hovering on the edge doesn't flicker.
export function zoneSide(zone, pos, now, wasOut) {
  const d = haversine(zone.center, pos);
  const r = zoneRadius(zone, now);
  if (wasOut) return d <= r + ZONE_RETURN ? 'in' : 'out';
  return d > r + ZONE_BUFFER ? 'out' : 'in';
}
