// The shared, platform-free game logic (also used by the web app in ../src).
export * from '../../src/game/engine';
export * from '../../src/game/games';
export { BRIEFINGS, SNITCH_LINE, SNITCH_DARK_LINE } from '../../src/game/briefings';
export { briefingFor, myRoleKey } from '../../src/game/brief';
export { MISSIONS } from '../../src/game/missions';
export { DEFAULT_PACK, DNA_STYLES, MAX_PLAYERS } from '../../src/game/constants';
export * from '../../src/lib/geo';
export { LEGAL_UPDATED, legalDocuments } from '../../src/legal/content';
