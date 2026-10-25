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

export const DNA_STYLES = {
  none: { name: 'Monochrome', short: 'Mono', motto: 'Pure black and white. Complete missions together to evolve the room.' },
  auteur: { name: 'Auteur Studio', short: 'Auteur', motto: 'Serif titles, film perforations and a fine silver grain.' },
  dossier: { name: 'Classified Dossier', short: 'Dossier', motto: 'Monospace intel labels, a radar grid and dashed case files.' },
  kinetic: { name: 'Kinetic Brutalism', short: 'Kinetic', motto: 'Hazard lines, hard shadows and heavy stamped type.' },
};

export const ROLES = {
  main: { key: 'main', label: 'Main Character', index: 'A' },
  director: { key: 'director', label: 'Director', index: 'B' },
  camera: { key: 'camera', label: 'Cameraman', index: 'C' },
  hype: { key: 'hype', label: 'Hype Crew', index: 'D' },
};

export const HYPE_TASK = `Crowd reactions, gasps, slow claps and keeping the energy at 1000%. Earn +${HYPE_CREW_XP} XP if the squad completes it.`;

export const DIFFICULTY = { spicy: 'Spicy', fast: 'Fast', oscar: 'Oscar Worthy' };
