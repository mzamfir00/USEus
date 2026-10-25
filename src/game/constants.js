export const MAX_PLAYERS = 8;
export const SPIN_MS = 2600;
export const SABOTEUR_BONUS = 250;
export const SPEED_BONUS = 100;
export const HYPE_CREW_XP = 100;
export const CHICKEN_PENALTY = 150;
export const DEFAULT_PACK = 'THE BASEMENT BOYS PACK';

// Each vibe feeds one of the three Room DNA mutation styles.
export const CATEGORIES = {
  supermarket: { id: 'supermarket', index: '01', label: 'Supermarket / Mall', tagline: 'Commercials & props', style: 'auteur' },
  streets: { id: 'streets', index: '02', label: 'City Streets / Park', tagline: 'Stealth & hide-and-seek', style: 'dossier' },
  roadtrip: { id: 'roadtrip', index: '03', label: 'Roadtrip / Gas Station', tagline: 'Fast chaos', style: 'kinetic' },
  creator: { id: 'creator', index: '04', label: 'Creator Custom Pack', tagline: 'Sponsored pack', style: 'auteur' },
};

export const ARCHETYPES = [
  { id: 'director', label: 'The Director', blurb: 'Calls the shots. Lives for the perfect take.' },
  { id: 'instigator', label: 'The Instigator', blurb: 'Starts the chaos. Never apologises.' },
  { id: 'ghost', label: 'The Ghost', blurb: 'Silent, stealthy, impossible to catch.' },
  { id: 'wildcard', label: 'The Wildcard', blurb: 'Nobody knows what happens next. Including you.' },
];

export const archetypeLabel = (id) => ARCHETYPES.find((a) => a.id === id)?.label || 'Unknown';

export const DNA_STYLES = {
  none: { name: 'Clinical Wireframe', code: 'WF-00', motto: 'Complete a mission to start evolving.' },
  auteur: { name: 'Auteur Studio', code: '35MM', motto: 'Film-strip borders, viewfinders, silver grain.' },
  dossier: { name: 'Classified Dossier', code: 'TS/SCI', motto: 'Radar grids, redactions, topographic intel.' },
  kinetic: { name: 'Kinetic Brutalism', code: 'HZ-01', motto: 'Hazard stripes, hard shadows, stamped type.' },
};

export const ROLES = {
  main: { key: 'main', label: 'Main Character', index: 'A' },
  director: { key: 'director', label: 'Director', index: 'B' },
  camera: { key: 'camera', label: 'Cameraman', index: 'C' },
  hype: { key: 'hype', label: 'Hype Crew', index: 'D' },
};

export const HYPE_TASK = `Crowd reactions, gasps, slow claps and keeping the energy at 1000%. Earn +${HYPE_CREW_XP} XP if the squad completes it.`;

export const DIFFICULTY = { spicy: 'Spicy', fast: 'Fast', oscar: 'Oscar Worthy' };

export const BOT_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Riley', 'Casey', 'Morgan', 'Quinn'];
