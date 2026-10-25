// Arenas, game modes and their content.

export const ARENAS = {
  indoor: { id: 'indoor', label: 'Indoor', full: 'Indoor / Apartment', style: 'auteur', missionCategory: 'creator' },
  park: { id: 'park', label: 'Park', full: 'Park / Outdoors', style: 'dossier', missionCategory: 'streets' },
  forest: { id: 'forest', label: 'Forest', full: 'Forest / Trail', style: 'dossier', missionCategory: 'streets' },
  supermarket: { id: 'supermarket', label: 'Supermarket', full: 'Supermarket / Mall', style: 'auteur', missionCategory: 'supermarket' },
  streets: { id: 'streets', label: 'City Streets', full: 'City Streets', style: 'dossier', missionCategory: 'streets' },
  roadtrip: { id: 'roadtrip', label: 'Roadtrip', full: 'Roadtrip / Spot', style: 'kinetic', missionCategory: 'roadtrip' },
};

const ALL = Object.keys(ARENAS);

/* ------------------------------ GPS Playzone ------------------------------ */

// Big outdoor spaces get a live GPS boundary, a tactical radar and supply drops.
export const ZONE_ARENAS = ['park', 'forest', 'supermarket', 'streets'];

export const ZONE_RADII = [
  { m: 30, label: 'Compact' },
  { m: 75, label: 'Mall / Plaza' },
  { m: 150, label: 'Park / Forest' },
  { m: 300, label: 'Urban Sector' },
];
export const DEFAULT_RADIUS = { park: 150, forest: 150, supermarket: 75, streets: 300 };

export const RADAR_USES = 2; // per hunter, per round
export const RADAR_MS = 3000; // how long a radar ping exposes the hiders
export const DECOY_OFFSET = 35; // metres between a hider and their fake blip
export const DROP_RADIUS = 8; // metres to claim the supply drop
export const HEARTBEAT_BANDS = [5, 10, 20]; // hunter proximity bands on the hider HUD

// Which roles hunt and which hide, for the radar, decoys, heartbeat and supply drop.
export const HUNT = {
  hide_seek: { role: 'seeker', hunter: 'Seeker', hiders: 'hiders' },
  sardines: { role: 'hunter', hunter: 'Hunter', hiders: 'the sardines' },
  zombie_tag: { role: 'zombie', hunter: 'Zombie', hiders: 'survivors' },
};

export const GAMES = {
  blind_sonar: {
    id: 'blind_sonar',
    short: 'Sonar',
    film: ['survivor'], // roles under the Snitch Protocol
    name: 'Blind Sonar',
    tagline: 'One blind hunter. Everyone else films — and beeps.',
    arenas: ['indoor', 'park', 'forest'],
    min: 2,
    duration: 180,
    starter: 'Blind Hunter',
    films: true,
    roles: {
      hunter: {
        label: 'The Blind Hunter',
        brief: 'Close your eyes or blindfold yourself. Tap anywhere on your screen to send a sonar pulse — every survivor’s phone beeps. Catch someone, then tap “I caught someone”.',
      },
      survivor: {
        label: 'Survivor',
        brief: 'Film the hunter. When a sonar pulse hits, your phone beeps loudly — dodge without a sound. Tap Near miss when they come within a metre.',
      },
    },
  },
  paparazzi: {
    id: 'paparazzi',
    short: 'Paparazzi',
    film: [], // roles under the Snitch Protocol
    name: 'Paparazzi Sniper',
    tagline: 'Photograph your secret target before they spot you.',
    arenas: ALL,
    min: 2,
    duration: 240,
    films: false,
    roles: {
      sniper: {
        label: 'Sniper',
        brief: 'Your target is private. Snap them when they are not looking at your lens. Everyone votes on every shot at the end.',
      },
    },
  },
  teleprompter: {
    id: 'teleprompter',
    short: 'Teleprompter',
    film: ['director'], // roles under the Snitch Protocol
    name: 'Blind Teleprompter',
    tagline: 'The actor reads a live ad. The squad sabotages the script.',
    arenas: ['supermarket', 'indoor', 'streets'],
    min: 2,
    duration: 150,
    starter: 'Actor',
    films: true,
    roles: {
      actor: { label: 'Actor', brief: 'Read the teleprompter out loud like a real commercial. Obey every stage direction that appears — instantly.' },
      director: { label: 'Director', brief: 'Film the commercial. The script is mirrored on your screen so you can cue the actor.' },
      saboteur: { label: 'Prompt Saboteur', brief: 'Tap stage directions to inject them onto the actor’s teleprompter mid-take.' },
    },
  },
  red_light: {
    id: 'red_light',
    short: 'Red Light',
    film: ['runner'], // roles under the Snitch Protocol
    name: 'Red Light Freeze Cam',
    tagline: 'Move on green. Freeze on red. Your phone can tell.',
    arenas: ['park', 'forest', 'indoor', 'roadtrip', 'streets'],
    min: 2,
    duration: 180,
    starter: 'Watcher',
    films: true,
    roles: {
      watcher: { label: 'The Watcher', brief: 'Stand far away, back to the runners. Toggle green and red. Anyone whose phone moves on red is out.' },
      runner: { label: 'Runner', brief: 'Film as you sneak toward the watcher. On red, freeze — your phone’s motion sensor is watching. Tag the watcher to win.' },
    },
  },
  hot_potato: {
    id: 'hot_potato',
    short: 'Hot Potato',
    film: [], // roles under the Snitch Protocol
    name: 'Timebomb Hot Potato',
    tagline: 'Do the dare, pass the bomb. Don’t be holding it.',
    arenas: ALL,
    min: 2,
    duration: 90,
    starter: 'First holder',
    films: false,
    roles: {
      player: { label: 'Player', brief: 'If the bomb lands on your phone, do the 5-second dare, then pass it to someone else before it explodes.' },
    },
  },
  undercover: {
    id: 'undercover',
    short: 'Undercover',
    film: ['crew'], // roles under the Snitch Protocol
    name: 'Undercover Saboteur',
    tagline: 'One challenge. One hidden saboteur. Then everyone votes.',
    arenas: ALL,
    min: 3,
    duration: 180,
    films: true,
    roles: {
      crew: { label: 'Crew', brief: 'Complete the group challenge on camera. Watch everyone — one of you is secretly sabotaging it.' },
      saboteur: { label: 'Undercover Saboteur', brief: 'Join the challenge, but sneak your 3 covert tasks into the video without getting caught.' },
    },
  },
  /* ---------------------------- childhood classics ---------------------------- */
  hide_seek: {
    id: 'hide_seek',
    short: 'Hide & Seek',
    film: ['hider'],
    name: 'Hide & Seek: Snitch Cam',
    tagline: 'Hiders must keep filming. Pocket the phone and it screams.',
    arenas: ['indoor', 'park', 'forest', 'supermarket', 'streets'],
    min: 2,
    duration: 300,
    hideMs: 30000,
    starter: 'Seeker',
    roles: {
      seeker: {
        label: 'Seeker',
        brief: 'Eyes closed: your phone counts 30 seconds. Then hunt with your camera — flashlight, flash pulse and 3 sound pings that make every hider’s phone beep.',
      },
      hider: {
        label: 'Hider',
        brief: 'Hide and keep filming, always. Every 45 seconds a Peek Check makes you pan out of your spot. Stop filming or pocket the phone and it blasts a siren and strobes your flashlight.',
      },
    },
  },
  sardines: {
    id: 'sardines',
    short: 'Sardines',
    film: ['sardine', 'hunter'],
    name: 'Sardines',
    tagline: 'One hides. Find them, squeeze in, keep silent.',
    arenas: ['indoor', 'park', 'forest', 'supermarket', 'streets'],
    min: 3,
    duration: 300,
    hideMs: 45000,
    starter: 'First sardine',
    roles: {
      sardine: { label: 'The Sardine', brief: 'You have 45 seconds to hide. Keep filming the hunters as they find you. Laugh and your phone snitches.' },
      hunter: { label: 'Hunter', brief: 'Eyes closed for 45 seconds, then search alone while filming. Found the sardine? Squeeze into the same spot silently and tap “I found them”.' },
    },
  },
  floor_lava: {
    id: 'floor_lava',
    short: 'Lava',
    film: ['player'],
    name: 'The Floor Is Lava',
    tagline: 'When the siren hits zero: feet up, camera down.',
    arenas: ['indoor', 'park', 'forest'],
    min: 2,
    duration: 150,
    roles: {
      player: { label: 'Player', brief: 'Walk around filming. When the lava countdown hits zero, both feet must be off the ground — point your camera down at them as proof.' },
    },
  },
  zombie_tag: {
    id: 'zombie_tag',
    short: 'Zombie',
    film: ['survivor'],
    name: 'Infected: Zombie Tag',
    tagline: 'Patient Zero strobes. Get tagged, join the horde.',
    arenas: ['park', 'forest', 'indoor', 'streets'],
    min: 3,
    duration: 240,
    starter: 'Patient Zero',
    roles: {
      zombie: { label: 'Zombie', brief: 'Your flashlight strobes slowly as a zombie beacon. Tag survivors — they join your horde.' },
      survivor: { label: 'Survivor', brief: 'Run, hide and keep filming. If a zombie tags you, tap “I got tagged” and join the horde.' },
    },
  },
  marco_polo: {
    id: 'marco_polo',
    short: 'Marco Polo',
    film: ['polo'],
    name: 'Marco Polo: Flash Edition',
    tagline: 'Marco calls — every hider’s phone answers POLO and flashes.',
    arenas: ['indoor', 'park', 'forest'],
    min: 2,
    duration: 240,
    starter: 'Marco',
    roles: {
      marco: { label: 'Marco', brief: 'Eyes closed. Tap MARCO (20 s cooldown): every hider’s phone answers “Polo!” out loud and flashes its light. Tag them by touch.' },
      polo: { label: 'Polo', brief: 'Film Marco from your spot. Your phone answers every Marco with a loud “Polo!” and a flash — move between calls.' },
    },
  },
  /* ------------------------ Halloween Rituals (seasonal) ------------------------ */
  midnight_man: {
    id: 'midnight_man',
    pack: 'halloween',
    short: 'Midnight Man',
    film: ['candle'],
    name: 'The Midnight Man',
    tagline: 'Keep your candle lit until 3:33 AM. He blows them out.',
    arenas: ['indoor', 'park', 'forest'],
    min: 2,
    duration: 200,
    dark: true,
    starter: 'The Midnight Man',
    roles: {
      midnight: { label: 'The Midnight Man', brief: 'Stalk the candles in the dark. Blow one out every 25 seconds, then catch the exposed by touch.' },
      candle: { label: 'Survivor', brief: 'Your flashlight is your candle. If it goes out, relight it in 10 seconds or your phone shrieks your position.' },
    },
  },
  weeping_statue: {
    id: 'weeping_statue',
    pack: 'halloween',
    short: 'Statue',
    film: ['watcher'],
    name: 'Don’t Blink: The Weeping Statue',
    tagline: '3 seconds of light. 5 seconds of black. It only moves in the dark.',
    arenas: ['indoor', 'park', 'forest', 'streets'],
    min: 2,
    duration: 180,
    dark: true,
    starter: 'The Statue',
    roles: {
      statue: { label: 'The Statue', brief: 'Move only in the blackout. Freeze in a pose the instant the lights come back. Your phone feels it if you don’t.' },
      watcher: { label: 'Survivor', brief: 'Film the dark ahead. Your flashlight is on for 3 seconds, off for 5 — every phone in sync.' },
    },
  },
  daruma: {
    id: 'daruma',
    pack: 'halloween',
    short: 'Daruma-san',
    film: ['walker'],
    name: 'Daruma-san: The Shadow Behind You',
    tagline: 'Selfie camera only. Never turn around. Spot it behind you.',
    arenas: ['indoor', 'park', 'forest', 'streets'],
    min: 2,
    duration: 240,
    dark: true,
    starter: 'The Shadow',
    roles: {
      shadow: { label: 'The Shadow', brief: 'Creep up behind the walkers in silence. When someone yells TOMARE, you freeze for 5 seconds.' },
      walker: { label: 'Walker', brief: 'Reach your checkpoints filming your own face. Never turn your head. Spot the Shadow in your selfie and call TOMARE.' },
    },
  },
  dead_silence: {
    id: 'dead_silence',
    pack: 'halloween',
    short: 'Dead Silence',
    film: ['mouse'],
    name: 'Dead Silence: The Quiet Ritual',
    tagline: 'Three noisy tasks. One blindfolded hunter. A whisper sets you off.',
    arenas: ['indoor'],
    min: 2,
    duration: 210,
    dark: true,
    starter: 'The Hunter',
    roles: {
      hunter: { label: 'The Hunter', brief: 'Blindfolded in the centre of the room. Listen. Lunge. Every noise chimes from the guilty phone.' },
      mouse: { label: 'Survivor', brief: 'Do your 3 noisy tasks while filming. Your mic is ultra-sensitive: a breath or a creak chimes and flashes.' },
    },
  },
  doppelganger: {
    id: 'doppelganger',
    pack: 'halloween',
    short: 'Doppelgänger',
    film: ['explorer'],
    name: 'The Doppelgänger',
    tagline: 'One of you isn’t who they seem. Every 60 s the power dies.',
    arenas: ['indoor', 'park', 'forest'],
    min: 3,
    duration: 300,
    dark: true,
    roles: {
      explorer: { label: 'Explorer', brief: 'Explore in pairs with your flashlight on. Every minute the power cuts for 10 seconds. Vote out the impostor.' },
      doppelganger: { label: 'The Doppelgänger', brief: 'Look normal. Only during a blackout can you claim the player standing next to you. Don’t get voted out.' },
    },
  },
};

/* ------------------------------ game packs ------------------------------- */

// Limited-time seasonal pack: playable from October 1 to November 7 every year.
export const HALLOWEEN = { id: 'halloween', name: 'Halloween Horror Pack', short: 'Halloween Rituals', until: 'Nov 7' };
export const halloweenLive = (now = Date.now()) => {
  const d = new Date(now);
  return d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() <= 7);
};

export const PACKS = {
  party: { id: 'party', name: 'All games', short: 'Party & classics' },
  halloween: HALLOWEEN,
};

export const packOf = (g) => g.pack || 'party';

export const gamesFor = (arena, playerCount, pack = 'party') =>
  Object.values(GAMES).filter((g) => packOf(g) === pack && g.arenas.includes(arena) && playerCount >= g.min);

/* ---------------------------- Halloween rituals --------------------------- */

export const RITUAL = {
  extinguishCooldown: 25000, // Midnight Man
  relightMs: 10000,
  relightTaps: 5,
  statueLight: 3000, // Weeping Statue: light on…
  statueDark: 5000, // …then total blackout
  tomareFreeze: 5000, // Daruma-san
  tomareCooldown: 12000,
  tomareUses: 3,
  blackoutEvery: 60000, // Doppelgänger
  blackoutMs: 10000,
};

export const CHECKPOINTS = [
  'Touch the handle of the furthest door',
  'Stand in a doorway for 5 seconds',
  'Sit on a chair, count to 3, stand up',
  'Switch a light on and off once',
  'Touch the coldest surface you can find',
  'Walk to the darkest corner and back',
  'Open and close a cupboard or drawer',
  'Find something soft and hold it up',
  'Touch a window or a wall mirror',
  'Walk backwards 10 steps along a wall',
];

export const SILENT_TASKS = [
  'Walk past the Hunter and swap places with another player',
  'Pick up a set of keys and carry them across the room',
  'Open a door and close it again',
  'Pour a glass of water',
  'Unzip and zip a bag or jacket',
  'Move a chair one metre',
  'Take off one shoe and put it back on',
  'Open a packet or a crinkly wrapper',
  'Fold a towel or a piece of clothing',
  'Touch the Hunter’s chair without being heard',
];

/* ------------------------------ teleprompter ----------------------------- */

export const PRODUCTS = {
  indoor: ['a single lonely sock', 'the TV remote', 'a houseplant', 'a wooden spoon', 'a throw pillow'],
  park: ['a perfectly average pinecone', 'a heroic stick', 'a park bench', 'a fallen leaf', 'a smooth rock'],
  forest: ['a suspiciously perfect mushroom', 'the mossiest log in the woods', 'a walking stick of destiny', 'fresh forest air (in a jar)', 'a pinecone with attitude'],
  supermarket: ['the weirdest vegetable in this aisle', 'the cheapest cereal on the shelf', 'a mystery can with no label', 'bubble wrap', 'a family-size bag of air (chips)'],
  streets: ['a bus stop', 'the nearest lamppost', 'a city pigeon (from a respectful distance)', 'a crosswalk button', 'a very ordinary bin'],
  roadtrip: ['a gas station snack', 'the car air freshener', 'a crumpled receipt', 'the cup holder', 'a travel neck pillow'],
};

const VERBS = ['talk to pigeons', 'parallel park', 'reply to my emails', 'leave the group chat on read', 'dance at weddings'];

export const scriptFor = (product, rand) => {
  const verb = VERBS[Math.floor(rand() * VERBS.length)];
  return [
    `Are you tired of living a life without ${product}?`,
    'I was. Until today.',
    `Introducing… ${product}. Crafted by monks. Tested by astronauts.`,
    'Hold it. Feel it. Smell it — no, really, smell it.',
    'Doctors don’t recommend it. My mom does.',
    `With ${product}, I finally have the confidence to ${verb}.`,
    'Side effects include main-character energy and sudden applause.',
    `Order now and get a second ${product} absolutely free.*`,
    '*Free means nothing is free.',
    `${product.charAt(0).toUpperCase()}${product.slice(1)}. Because you deserve this. Probably.`,
  ];
};

export const DIRECTIONS = [
  'Suddenly whisper like it’s a secret',
  'Hold the item like a newborn baby',
  'Ask someone nearby (politely) if they approve',
  'Single dramatic tear',
  'Switch to a pirate accent',
  'Slow motion for three seconds',
  'Stare into the lens. Way too long.',
  'Announce a shocking plot twist',
  'Sing the next line like opera',
  'The item is suddenly extremely heavy',
  'Get attacked by an imaginary bee',
  'Wink at the camera — badly',
];

/* ------------------------------- hot potato ------------------------------ */

export const DARES = [
  'Spin around twice',
  'Do three squats',
  'Say “banana” in three accents',
  'Strike a superhero pose',
  'Hop on one leg',
  'Shred an air-guitar solo',
  'Do your best robot',
  'Touch your toes',
  'Fake the most dramatic sneeze',
  'Moonwalk two steps',
  'Make a dinosaur noise',
  'Salute the camera',
];

/* ------------------------------- undercover ------------------------------ */

export const COVERT_TASKS = [
  'Say the word “pineapple” naturally',
  'Touch your left ear three times',
  'Get someone to high-five you',
  'Hum a song for five seconds',
  'Point at the sky for no reason',
  'Re-tie a shoelace on camera',
  'Use the phrase “living legend”',
  'Fake a dramatic sneeze',
  'Stand on one leg for five seconds',
  'Ask someone what time it is',
  'Wink at the camera',
  'Clap once, loudly, at a random moment',
  'Sit down for no reason',
  'Whisper someone’s name',
  'Fake a three-second phone call',
];

/* ---------------------------------- XP ----------------------------------- */

export const XP = {
  sonarCatch: 400,
  sonarCaught: -50,
  sonarSurvive: 250,
  sonarSurviveCaughtRound: 100,
  sonarHunterTimeout: 50,
  nearMiss: 150,
  validShot: 300,
  shotTarget: -50,
  telepromptCast: 200,
  telepromptActor: 100,
  inject: 25,
  runnerWin: 400,
  runnerSurvive: 100,
  watcherPerOut: 100,
  watcherWin: 300,
  bombSurvive: 150,
  bombLoser: -100,
  crewCatch: 250,
  crewMissed: 50,
  sabEscape: 300,
  sabTask: 100,
  sabCaughtTask: 50,
  strike: -50, // Snitch Protocol: per filming violation
  seekFound: 100,
  seekAll: 200,
  hideSurvive: 300,
  hideFound: 50,
  sardineBase: 150,
  sardineHidden: 250,
  sardineLast: -50,
  lavaSafe: 100,
  lavaBurn: -50,
  survivorWin: 300,
  zeroWin: 300,
  zombieWin: 100,
  survivedPer30: 50,
  marcoTag: 150,
  marcoAll: 200,
  poloSurvive: 300,
  poloTagged: 50,
  radarPing: -150, // GPS Playzone: hunter radar ping
  zoneOut: -200, // GPS Playzone: 10 s outside the zone
  supplyDrop: 300, // GPS Playzone: first hider to the drop
  // Halloween Rituals
  midnightCatch: 150,
  midnightExpose: 50,
  candleSurvive: 300,
  candleCaught: -50,
  candleExposed: -50,
  statueTag: 150,
  statueMoved: -50,
  statueSurvive: 250,
  statueTagged: -50,
  checkpoint: 100,
  tomare: 50,
  walkerSurvive: 200,
  walkerCaught: -50,
  shadowCatch: 150,
  silentTask: 100,
  silentAll: 150,
  silentNoise: -25,
  silentCaught: -50,
  silentHunt: 150,
  dopFound: 300,
  dopVictim: 200,
  dopSurvive: 300,
  explorerSurvive: 100,
  explorerTaken: 50,
};
