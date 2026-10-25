import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  X,
  QrCode,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Video,
  Timer,
  Zap,
  Trophy,
  ChevronLeft,
  Eye,
  EyeOff,
  Pencil,
  Check,
  RotateCcw,
  SwitchCamera,
  Crown,
  Skull,
  Sparkles,
  ArrowRight,
  House,
  Flame,
  Lock,
  Dices,
  Star,
  CameraOff,
  ScanLine,
} from 'lucide-react';

/* =============================================================================
   SQUAD ROULETTE — IRL multiplayer party game (single-file React component)
   Palette: Ink #0A0A0C · Acid Lime #CCFF00 · Hot Coral #FF2A5F · Electric Cyan #00F0FF
   ========================================================================== */

const LIME = '#CCFF00';
const CORAL = '#FF2A5F';
const CYAN = '#00F0FF';
const INK = '#0A0A0C';

const SLOT_COLORS = { Player1: LIME, Player2: CORAL, Player3: CYAN, Pack: '#FFFFFF' };

const MAX_PLAYERS = 8;
const QUICK_ADD = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Riley', 'Casey'];
const SPIN_DURATION_MS = 2500;
const SABOTEUR_BONUS = 250;
const SPEED_BONUS = 100;
const HYPE_CREW_XP = 100;
const CHICKEN_PENALTY = 150;

const CATEGORIES = {
  supermarket: {
    id: 'supermarket',
    emoji: '🛒',
    name: 'Supermarket / Mall',
    tagline: 'Commercials & Props',
    color: LIME,
  },
  streets: {
    id: 'streets',
    emoji: '🌃',
    name: 'City Streets / Park',
    tagline: 'Stealth & Hide-and-Seek',
    color: CYAN,
  },
  roadtrip: {
    id: 'roadtrip',
    emoji: '⛽',
    name: 'Roadtrip / Gas Station',
    tagline: 'Fast Chaos',
    color: CORAL,
  },
  creator: {
    id: 'creator',
    emoji: '⭐',
    name: 'Creator Custom Pack',
    tagline: 'Sponsored Pack',
    color: '#FFFFFF',
  },
};

const DIFFICULTY = {
  spicy: { label: '🌶️ SPICY', color: CORAL },
  fast: { label: '⚡ FAST', color: CYAN },
  oscar: { label: '🎬 OSCAR WORTHY', color: LIME },
};

const ROLE_DEFS = [
  { key: 'director', emoji: '🎬', label: 'DIRECTOR', color: CORAL },
  { key: 'main', emoji: '🎭', label: 'MAIN CHARACTER', color: LIME },
  { key: 'camera', emoji: '📹', label: 'CAMERAMAN', color: CYAN },
  { key: 'saboteur', emoji: '🕵️', label: 'SECRET SABOTEUR', color: '#FFFFFF' },
];

/* -----------------------------------------------------------------------------
   MISSION DATABASE — 4 categories × 4 missions.
   {Player1} = Main Character · {Player2} = Director · {Player3} = Cameraman
   {Pack} = the editable Creator Pack name.
   -------------------------------------------------------------------------- */
const MISSIONS = [
  // 🛒 SUPERMARKET / MALL
  {
    id: 1,
    category: 'supermarket',
    title: 'EAU DE VEGETABLE',
    difficulty: 'oscar',
    xp: 500,
    duration: 300,
    prompt:
      '{Player1} and {Player2} must grab the weirdest vegetable in the store and film a dramatic luxury perfume commercial for it while {Player3} narrates in a whisper.',
    roles: {
      p1: 'You ARE the face of the fragrance. Slow-motion hair flips, staring into the distance, cradling the vegetable like it is a newborn diamond.',
      p2: 'Pick the vegetable, name the perfume (e.g. "Turnip Noir"), and call every shot. Demand at least one dramatic spin and one sniff close-up.',
      p3: 'Film low angles and extreme close-ups while whispering the voiceover: "Raw. Earthy. Forbidden." End on the fake perfume name. Veggie goes back on the shelf after!',
    },
    twist:
      'Secretly slip the phrase "notes of wet cardboard" into the commercial at least twice without anyone calling you out.',
  },
  {
    id: 2,
    category: 'supermarket',
    title: 'AISLE 7: THE TRAILER',
    difficulty: 'oscar',
    xp: 600,
    duration: 420,
    prompt:
      '{Player1} is the last human alive in aisle 7. {Player2} directs a 30-second apocalyptic movie trailer using only shelf items as survival gear while {Player3} films and does the deep "IN A WORLD..." voice.',
    roles: {
      p1: 'Survive. Peek around shelf corners, "discover" a can of beans like it is the last food on Earth, and deliver one tearful line to a paper towel roll.',
      p2: 'Storyboard 5 shots: the discovery, the threat, the gear-up, the betrayal, the title card. Pick the final movie title out loud.',
      p3: 'Shoot wide-to-close push-ins and narrate: "In a world... where the oat milk ran out... one hero... must choose." Put every prop back neatly.',
    },
    twist:
      'You are a "zombie" in disguise. At some point, slowly drift into the background of a shot and stand perfectly still, staring. Do not get spotted until the final take.',
  },
  {
    id: 3,
    category: 'supermarket',
    title: 'CART SHOPPING NETWORK',
    difficulty: 'fast',
    xp: 400,
    duration: 240,
    prompt:
      '{Player1} becomes a hyper-caffeinated shopping-channel host selling the cheapest item in the store as a "limited edition collector\'s piece" while {Player2} calls in crying with joy and {Player3} films infomercial zoom-ins.',
    roles: {
      p1: 'Find the cheapest item (under $2). Sell it like your life depends on it: "Only 3 left! Operators are standing by!" Use at least one fake price slash.',
      p2: 'Play the caller on speakerphone voice: "I bought FOUR and my life changed." Scream when the host reveals the price.',
      p3: 'Crash-zoom on the product every time the price is said. Add a fake "$1.99" by holding up your fingers in frame. Return the item after.',
    },
    twist:
      'Act as a "competitor network" plant. Interrupt the broadcast once with a fake "BREAKING NEWS" about a rival product nearby — and make it look accidental.',
  },
  {
    id: 4,
    category: 'supermarket',
    title: 'MICHELIN CART-UTERIE',
    difficulty: 'spicy',
    xp: 450,
    duration: 360,
    prompt:
      '{Player1} has 3 minutes to build the most chaotic "balanced meal" in a cart using one item from every aisle, then present it like a Michelin-star chef to {Player2}, a brutally harsh food critic, while {Player3} hosts it like a cooking show.',
    roles: {
      p1: 'Sprint the aisles. One item per aisle, no repeats. Present each item with a fancy name ("deconstructed sock of cotton, aisle 12").',
      p2: 'Be the most savage critic alive. Tasting notes only by LOOKING. End with a score out of 10 and one devastating one-liner.',
      p3: 'Host and film: countdown hype, "chef, you have 60 seconds!", and close-ups of the critic\'s disgust. Everything goes back on the shelves afterward.',
    },
    twist:
      'Secretly sneak one completely non-food item (a sponge, a birthday card) into the cart without the chef noticing before the presentation.',
  },

  // 🌃 CITY STREETS / PARK
  {
    id: 5,
    category: 'streets',
    title: 'PHOTO CLUE MANHUNT',
    difficulty: 'spicy',
    xp: 700,
    duration: 600,
    prompt:
      '{Player1} gets a 2-minute head start to hide within 2 blocks. Every 90 seconds {Player1} must text {Player2} a photo clue of ONLY the ground under their feet while {Player3} films the hunt like a nature documentary.',
    roles: {
      p1: 'Hide somewhere public and safe (no private property, no roads). Send a ground-only photo every 90 seconds. Stay put once you pick a spot.',
      p2: 'Hunt using only the photo clues. Narrate your detective logic out loud: "Cracked pavement... gum stain... it\'s the bus stop."',
      p3: 'Follow the hunter and whisper like David Attenborough: "The predator has caught the scent." Capture the exact moment of the find.',
    },
    twist:
      'You are a double agent. Send the hunter ONE fake clue photo from somewhere else entirely — and keep a straight face when they head the wrong way.',
  },
  {
    id: 6,
    category: 'streets',
    title: 'THE SPY HANDOFF',
    difficulty: 'fast',
    xp: 500,
    duration: 300,
    prompt:
      '{Player1} and {Player2} must perform a top-secret spy handoff of a random object (a leaf, a receipt, a bottle cap) somewhere in public without {Player3} catching the exact moment on camera.',
    roles: {
      p1: 'You carry the "package". Wear sunglasses if you have them. Walk past your contact and make the handoff look like nothing happened.',
      p2: 'Choose the object and the codename. Plan the drop: bench swap, fake shoelace tie, or the classic newspaper move.',
      p3: 'You are the agency watching. Film the agents and shout "CAUGHT!" only if you get the handoff on camera. Miss it, and the spies win.',
    },
    twist:
      'You secretly work for a rival agency. Swap the package for a different object at some point without either agent noticing until the reveal.',
  },
  {
    id: 7,
    category: 'streets',
    title: 'SLOW-MO ACTION HERO',
    difficulty: 'oscar',
    xp: 400,
    duration: 240,
    prompt:
      '{Player1} must walk away from an "explosion" in full slow-motion action-hero mode (on the sidewalk, never the road!) while {Player2} provides mouth-made explosion sound effects and {Player3} films from a heroic ground-level angle.',
    roles: {
      p1: 'Do not look back. Cool guys never look at explosions. Put on imaginary sunglasses at the peak of the boom. Three takes minimum.',
      p2: 'Create the BOOM, the debris, and the epic soundtrack — with your mouth only. Yell "ACTION!" and "CUT!" like a blockbuster director.',
      p3: 'Lie low (safely), point the camera up, and slowly tilt as the hero walks past. Shoot the best take in slow-mo if your phone allows.',
    },
    twist:
      'Photobomb the final take by "running from the explosion" in the background in REAL speed, totally panicked — without being noticed while setting up.',
  },
  {
    id: 8,
    category: 'streets',
    title: 'LIVING MASTERPIECE',
    difficulty: 'spicy',
    xp: 600,
    duration: 480,
    prompt:
      '{Player1} must freeze as a living statue in a public spot while {Player2} plays a snobby art critic describing the "sculpture" to the camera and {Player3} films every passerby reaction.',
    roles: {
      p1: 'Pick a pose and FREEZE. You may only move (a slow wink, a tiny bow) when someone walks past. Zero laughing. Bonus if a stranger waves.',
      p2: 'Name the piece ("Man Contemplating Tax Season, 2026"). Deliver a pompous gallery tour about its "meaning" and "brushwork".',
      p3: 'Film wide so the statue is in context, then catch reaction shots. Never film strangers\' faces close up — keep it about the statue.',
    },
    twist:
      'Your mission: make the statue break character and laugh, using only silent faces from behind the critic. If they crack on camera, you win.',
  },

  // ⛽ ROADTRIP / GAS STATION
  {
    id: 9,
    category: 'roadtrip',
    title: 'GAS STATION SOMMELIER',
    difficulty: 'fast',
    xp: 350,
    duration: 180,
    prompt:
      '{Player1} buys the strangest snack under $3, then reviews it like a pretentious wine sommelier while {Player2} hits them with rapid-fire interview questions and {Player3} films a luxury tasting segment.',
    roles: {
      p1: 'Swirl. Sniff. Sip/bite. Deliver tasting notes like "hints of regret, a whisper of diesel, a bold finish of nostalgia." Pay for it first!',
      p2: 'Fire off at least 5 interviewer questions: "Vintage?" "Pairs with?" "Would you serve this at your wedding?"',
      p3: 'Film like a high-end food show: slow push-ins, dramatic reveal of the price tag, and a final "chef\'s kiss" freeze frame.',
    },
    twist:
      'Convince the sommelier mid-review that the snack is "actually from a limited Japanese import line" — and get them to repeat that claim to the camera.',
  },
  {
    id: 10,
    category: 'roadtrip',
    title: 'PARKED-CAR GRAMMYS',
    difficulty: 'oscar',
    xp: 500,
    duration: 240,
    prompt:
      'Whatever song plays next on shuffle, {Player1} must lip-sync the entire chorus like it is the Grammys while {Player2} performs backup-dancer choreography from the passenger seat and {Player3} films the music video. Car must be PARKED.',
    roles: {
      p1: 'Full diva mode. Hand on chest for the high notes, eyes closed for the emotional bridge, and a mic-drop with whatever is in the cupholder.',
      p2: 'Seated choreography only: synchronized arm waves, dramatic hair whips, and one perfectly timed point at the camera.',
      p3: 'Shoot from the back seat or outside the window. Get one dramatic close-up and one wide "concert" shot. Engine off, seatbelts optional while parked.',
    },
    twist:
      'Secretly skip the song to a different track at the most emotional moment of the chorus — and blame it on "the Bluetooth".',
  },
  {
    id: 11,
    category: 'roadtrip',
    title: 'F1 PIT STOP',
    difficulty: 'fast',
    xp: 450,
    duration: 180,
    prompt:
      '{Player1} and {Player2} must perform a normal gas-station stop (windshield, tires, trash, snacks) like an elite Formula 1 pit crew racing the clock while {Player3} films and live-commentates like an F1 broadcaster.',
    roles: {
      p1: 'You are the windshield & trash specialist. Every action is precise, urgent, and accompanied by a hand signal. Shout "CLEAR!" when done.',
      p2: 'Crew chief. Call the plays through a fake radio: "Box, box, box!" Check the tires by looking at them very seriously.',
      p3: 'Commentate at max hype: "AND THE CREW IS IN! A FLAWLESS WIPER CHANGE!" Announce the final pit time like a world record.',
    },
    twist:
      'Fake a "penalty" from race control: at some point, calmly announce a made-up rule violation that forces the crew to redo one task.',
  },
  {
    id: 12,
    category: 'roadtrip',
    title: 'SHARK TANK: SOUVENIR',
    difficulty: 'spicy',
    xp: 400,
    duration: 300,
    prompt:
      '{Player1} must find the weirdest item for sale in this gas station and pitch it as a startup investment to {Player2}, a ruthless Shark Tank investor, while {Player3} films the high-stakes negotiation.',
    roles: {
      p1: 'Pitch it like a founder: name the "company", give a fake valuation ("10 million for 5%"), and invent one wild customer testimonial.',
      p2: 'Grill the founder. Ask about margins. Counter-offer using ONLY items in your pockets. End with "I\'m in" or "I\'m out."',
      p3: 'Film both sides with dramatic pauses, sweeping pans, and a tense close-up before the final decision. Return the item to its shelf.',
    },
    twist:
      'Pretend to be a second investor who joins the negotiation unannounced and tries to steal the deal with a ridiculous offer.',
  },

  // ⭐ CREATOR CUSTOM PACK
  {
    id: 13,
    category: 'creator',
    title: '{Pack}: ORIGIN STORY',
    difficulty: 'oscar',
    xp: 600,
    duration: 300,
    prompt:
      '{Player1} delivers a dead-serious documentary confessional about "the day {Pack} was formed" while {Player2} reenacts the invented lore in the background and {Player3} films with shaky handheld cam.',
    roles: {
      p1: 'Sit down, stare just off-camera, and invent the lore. Dramatic pauses. One single tear. Mention a legendary "incident" that nobody can explain.',
      p2: 'Silently reenact everything in the background like a cheap History Channel reconstruction. Play every character yourself.',
      p3: 'Shaky handheld documentary style. Slow zoom on the narrator\'s face for the big reveal, then cut to the reenactment.',
    },
    twist:
      'Interrupt the confessional once as a "surprise witness" who disputes one detail of the story, forcing the narrator to improvise.',
  },
  {
    id: 14,
    category: 'creator',
    title: 'THE {Pack} HANDSHAKE',
    difficulty: 'fast',
    xp: 500,
    duration: 240,
    prompt:
      '{Player1} and {Player2} have 3 minutes to invent the official 10-move {Pack} secret handshake and nail it on camera in ONE take while {Player3} films and judges with Olympic scores.',
    roles: {
      p1: 'Invent the first 5 moves. At least one must include a spin and one must include a sound effect.',
      p2: 'Invent the last 5 moves and the big finale pose. Count down "3, 2, 1, SHAKE!" for the final take.',
      p3: 'Film the one-take attempt, then hold up fingers as Olympic scorecards (with a fake East German judge accent) for style, chaos, and sync.',
    },
    twist:
      'Secretly teach ONE of the handshake partners a fake extra move during practice so they mess up the final take — without the other noticing.',
  },
  {
    id: 15,
    category: 'creator',
    title: '{Pack} HYPE CYPHER',
    difficulty: 'spicy',
    xp: 550,
    duration: 240,
    prompt:
      '{Player1} freestyles a 30-second clean hype rap about {Player2}\'s most iconic bad habit while {Player2} reacts in slow motion and {Player3} films and beatboxes the beat.',
    roles: {
      p1: 'Clean lyrics only. Rhyme at least 4 bars, name-drop {Pack} twice, and end with a mic drop (use a shoe).',
      p2: 'React like you are in a slow-motion music video: shocked gasp, offended head tilt, and finally a respectful nod.',
      p3: 'Beatbox and film at the same time. Circle the rapper. If the beat drops out, that is a creative choice.',
    },
    twist:
      'Your secret word is "spaghetti". Get the rapper to say it in their verse by shouting it as a "suggestion" — make it seem like hype, not sabotage.',
  },
  {
    id: 16,
    category: 'creator',
    title: 'FAKE BRAND DEAL',
    difficulty: 'oscar',
    xp: 500,
    duration: 300,
    prompt:
      '{Player1} films a fake sponsored ad: "This episode of {Pack} is brought to you by..." the most random object within reach, while {Player2} gives an over-the-top testimonial and {Player3} films and reads the fine print at 3x speed.',
    roles: {
      p1: 'Corporate creator energy. Hold the object next to your face, flash a promo code ("CHAOS20"), and do the classic fake-smile hold.',
      p2: 'Testimonial time: "Before this object, I had nothing. Now? I have... this object." Cry a little. Show a fake before/after.',
      p3: 'Film the ad, then read invented fine print as fast as humanly possible: "Side effects may include main character syndrome."',
    },
    twist:
      'Halfway through, "accidentally" reveal the product is actually from a competitor — and keep the ad going like nothing happened.',
  },
];

const PENALTY_DARES = [
  '{name} must perform a 15-second interpretive dance titled "My Shame" — right now, on camera.',
  '{name} can only speak in a movie-trailer voice until the next mission ends.',
  '{name} owes every squad member a compliment delivered as a Shakespearean monologue.',
  '{name} must narrate the next 2 minutes of their life like a nature documentary.',
  '{name} must do 10 dramatic slow-motion squats while the squad hums an epic soundtrack.',
  '{name} sets their phone wallpaper to a squad-chosen photo until midnight.',
];

/* -----------------------------------------------------------------------------
   WEB AUDIO SYNTH — zero external audio files.
   -------------------------------------------------------------------------- */
const Synth = (() => {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  const ensure = () => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return muted ? null : ctx;
  };

  const tone = (c, { type = 'sine', freq, endFreq, start = 0, dur, vol, attack = 0.002, filter }) => {
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(gain);
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.endFreq) f.frequency.exponentialRampToValueAtTime(filter.endFreq, t + dur);
      if (filter.q) f.Q.value = filter.q;
      node = gain.connect(f);
    }
    node.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const noise = (c, { start = 0, dur, vol, type = 'highpass', freq = 3000, endFreq }) => {
    const t = c.currentTime + start;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    // Sharp mechanical ratchet tick for the roulette.
    tick(pitch = 1) {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'square', freq: 2400 * pitch, endFreq: 380, dur: 0.035, vol: 0.16 });
      noise(c, { dur: 0.028, vol: 0.32, type: 'highpass', freq: 3500 });
      tone(c, { type: 'triangle', freq: 180, endFreq: 90, dur: 0.05, vol: 0.12 });
    },
    // Heavy "lock-in" bass drop + impact + synth stab.
    lockIn() {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'sine', freq: 190, endFreq: 32, dur: 1.3, vol: 0.95, attack: 0.005 });
      tone(c, { type: 'triangle', freq: 95, endFreq: 30, dur: 0.9, vol: 0.5 });
      noise(c, { dur: 0.45, vol: 0.7, type: 'lowpass', freq: 1800, endFreq: 120 });
      tone(c, { type: 'sawtooth', freq: 110, dur: 0.9, vol: 0.22, filter: { type: 'lowpass', freq: 4200, endFreq: 180, q: 6 } });
      tone(c, { type: 'sawtooth', freq: 164.8, dur: 0.9, vol: 0.18, filter: { type: 'lowpass', freq: 4200, endFreq: 180, q: 6 } });
      tone(c, { type: 'square', freq: 1760, endFreq: 880, dur: 0.18, vol: 0.06, start: 0.02 });
    },
    // Countdown beep for the final 10 seconds.
    beep(urgent = false) {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'square', freq: urgent ? 1320 : 990, dur: 0.12, vol: 0.18, filter: { type: 'lowpass', freq: 3500 } });
    },
    // Time's up alarm.
    alarm() {
      const c = ensure();
      if (!c) return;
      [0, 0.22, 0.44, 0.66].forEach((s, i) =>
        tone(c, { type: 'sawtooth', freq: i % 2 ? 660 : 880, dur: 0.2, vol: 0.22, start: s, filter: { type: 'lowpass', freq: 3000 } })
      );
      tone(c, { type: 'sine', freq: 120, endFreq: 40, dur: 1, vol: 0.6, start: 0.66 });
    },
    success() {
      const c = ensure();
      if (!c) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone(c, { type: 'triangle', freq: f, dur: 0.35, vol: 0.22, start: i * 0.08 })
      );
      tone(c, { type: 'sine', freq: 130, endFreq: 50, dur: 0.6, vol: 0.5 });
      noise(c, { dur: 0.8, vol: 0.12, type: 'highpass', freq: 6000, start: 0.3 });
    },
    fail() {
      const c = ensure();
      if (!c) return;
      [392, 370, 349.2].forEach((f, i) =>
        tone(c, { type: 'sawtooth', freq: f, dur: 0.38, vol: 0.18, start: i * 0.4, filter: { type: 'lowpass', freq: 1400 } })
      );
      tone(c, { type: 'sawtooth', freq: 330, endFreq: 240, dur: 1.1, vol: 0.2, start: 1.2, filter: { type: 'lowpass', freq: 1200 } });
    },
    click() {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'sine', freq: 880, endFreq: 520, dur: 0.06, vol: 0.12 });
    },
    whoosh() {
      const c = ensure();
      if (!c) return;
      noise(c, { dur: 0.5, vol: 0.35, type: 'bandpass', freq: 400, endFreq: 4000 });
    },
  };
})();

/* -----------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
const buzz = (pattern) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* vibration unsupported */
  }
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const rotate = (arr, n) => {
  if (!arr.length) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const formatTime = (s) => {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const missionNumber = (m) => `#${String(m.id).padStart(2, '0')}`;

const fillText = (text, names, pack) =>
  text.replace(/\{(Player1|Player2|Player3|Pack)\}/g, (_, k) => (k === 'Pack' ? pack : names[k]));

// Renders mission text with player names injected and colour-highlighted per slot.
const RichText = ({ text, names, pack }) => {
  const parts = text.split(/(\{(?:Player1|Player2|Player3|Pack)\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{(Player1|Player2|Player3|Pack)\}$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        const key = m[1];
        const value = key === 'Pack' ? pack : names[key];
        return (
          <span
            key={i}
            className="rounded-md px-1 whitespace-nowrap"
            style={{
              color: key === 'Pack' ? INK : SLOT_COLORS[key],
              background: key === 'Pack' ? '#FFFFFF' : `${SLOT_COLORS[key]}1F`,
              boxShadow: key === 'Pack' ? 'none' : `inset 0 -3px 0 ${SLOT_COLORS[key]}`,
            }}
          >
            {value}
          </span>
        );
      })}
    </>
  );
};

const hashString = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Builds a QR-looking module grid (finder patterns + timing + seeded data).
const buildQrGrid = (seedText) => {
  const N = 25;
  const rand = mulberry32(hashString(seedText));
  const grid = Array.from({ length: N }, () => Array(N).fill(false));
  const finders = [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ];
  const inFinderZone = (r, c) => finders.some(([fr, fc]) => r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (inFinderZone(r, c)) {
        const f = finders.find(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
        if (f) {
          const lr = r - f[0];
          const lc = c - f[1];
          const ring = lr === 0 || lr === 6 || lc === 0 || lc === 6;
          const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
          grid[r][c] = ring || core;
        }
      } else if (r === 6 || c === 6) {
        grid[r][c] = (r + c) % 2 === 0;
      } else if (r >= N - 9 && r <= N - 5 && c >= N - 9 && c <= N - 5) {
        const lr = r - (N - 9);
        const lc = c - (N - 9);
        grid[r][c] = lr === 0 || lr === 4 || lc === 0 || lc === 4 || (lr === 2 && lc === 2);
      } else {
        grid[r][c] = rand() > 0.52;
      }
    }
  }
  return grid;
};

// Builds role assignments from an ordered list of players.
const buildCast = (orderedPlayers) => {
  const n = orderedPlayers.length;
  const [p1, p2, p3] = orderedPlayers;
  const saboteur = n >= 4 ? orderedPlayers[3] : orderedPlayers[n - 1];
  return {
    p1,
    p2,
    p3: p3 || null,
    saboteur,
    extras: orderedPlayers.slice(4),
    names: {
      Player1: p1.name,
      Player2: p2.name,
      Player3: p3 ? p3.name : 'THE WHOLE SQUAD',
    },
  };
};

/* -----------------------------------------------------------------------------
   Global styles (fonts + keyframes) so the component is fully self-contained.
   -------------------------------------------------------------------------- */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800;900&family=Inter:wght@500;600;700;800;900&display=swap');
    .sr-root { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .sr-display { font-family: 'Unbounded', 'Inter', system-ui, sans-serif; letter-spacing: -0.02em; }
    .sr-tnum { font-variant-numeric: tabular-nums; }
    .sr-noscroll::-webkit-scrollbar { display: none; }
    @keyframes sr-pulse-cta {
      0%, 100% { box-shadow: 0 0 0 0 rgba(204,255,0,.55), 0 0 28px rgba(204,255,0,.35); transform: scale(1); }
      50% { box-shadow: 0 0 0 14px rgba(204,255,0,0), 0 0 56px rgba(204,255,0,.6); transform: scale(1.025); }
    }
    @keyframes sr-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
    @keyframes sr-slide-up { from { transform: translateY(22px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes sr-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sr-blink { 50% { opacity: 0; } }
    @keyframes sr-flash { 0% { opacity: .95; } 100% { opacity: 0; } }
    @keyframes sr-shake {
      0%, 100% { transform: translate(0,0) rotate(0); }
      15% { transform: translate(-7px, 3px) rotate(-1.5deg); }
      30% { transform: translate(6px, -4px) rotate(1.5deg); }
      45% { transform: translate(-5px, 2px) rotate(-1deg); }
      60% { transform: translate(4px, -2px) rotate(.8deg); }
      75% { transform: translate(-2px, 1px) rotate(-.4deg); }
    }
    @keyframes sr-reel { 0% { transform: translateY(-55%); filter: blur(6px); opacity: .4; } 100% { transform: translateY(0); filter: blur(0); opacity: 1; } }
    @keyframes sr-scan { 0% { transform: translateY(-20%); } 100% { transform: translateY(120vh); } }
    @keyframes sr-blob-a { 0%, 100% { transform: translate(-20%, -10%) scale(1); } 50% { transform: translate(30%, 25%) scale(1.3); } }
    @keyframes sr-blob-b { 0%, 100% { transform: translate(20%, 40%) scale(1.2); } 50% { transform: translate(-25%, -5%) scale(.9); } }
    @keyframes sr-focus { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(.92); opacity: .5; } }
    @keyframes sr-confetti {
      0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
      100% { transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--rot)); opacity: 0; }
    }
    @keyframes sr-urgent { 0%, 100% { box-shadow: inset 0 0 0 0 rgba(255,42,95,0); } 50% { box-shadow: inset 0 0 0 6px rgba(255,42,95,.85); } }
    @keyframes sr-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes sr-spin-slow { to { transform: rotate(360deg); } }
    @keyframes sr-grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-3%,2%); } 50% { transform: translate(2%,-3%); } 75% { transform: translate(-1%,3%); } }
    .sr-cta-pulse { animation: sr-pulse-cta 1.6s ease-in-out infinite; }
    .sr-pop { animation: sr-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
    .sr-slide-up { animation: sr-slide-up .45s cubic-bezier(.2,.9,.3,1) both; }
    .sr-fade { animation: sr-fade .3s ease both; }
    .sr-blink { animation: sr-blink 1s steps(1) infinite; }
    .sr-shake { animation: sr-shake .55s ease both; }
    .sr-urgent { animation: sr-urgent 1s ease-in-out infinite; }
    .sr-press { transition: transform .12s ease, filter .12s ease, background-color .2s ease, border-color .2s ease, box-shadow .2s ease; }
    .sr-press:active { transform: scale(.95); filter: brightness(1.2); }
  `}</style>
);

/* -----------------------------------------------------------------------------
   Small UI pieces
   -------------------------------------------------------------------------- */
const Pill = ({ children, color, solid = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${className}`}
    style={
      solid
        ? { background: color, color: INK }
        : { color, border: `1.5px solid ${color}`, background: `${color}14` }
    }
  >
    {children}
  </span>
);

const IconButton = ({ onClick, children, label, active = false }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="sr-press grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white"
    style={active ? { borderColor: LIME, color: LIME } : undefined}
  >
    {children}
  </button>
);

const Logo = ({ size = 'md' }) => (
  <div className="leading-none">
    <div className={`sr-display font-black text-white ${size === 'lg' ? 'text-[34px]' : 'text-[22px]'}`}>
      SQUAD
      <span style={{ color: LIME }}> ROULETTE</span>
    </div>
  </div>
);

const Confetti = ({ seed }) => {
  const pieces = useMemo(() => {
    const rand = mulberry32(seed);
    const colors = [LIME, CORAL, CYAN, '#FFFFFF'];
    return Array.from({ length: 44 }, (_, i) => ({
      id: i,
      left: 50 + (rand() - 0.5) * 20,
      dx: `${(rand() - 0.5) * 420}px`,
      dy: `${200 + rand() * 520}px`,
      rot: `${(rand() - 0.5) * 900}deg`,
      color: colors[Math.floor(rand() * colors.length)],
      w: 6 + rand() * 8,
      h: 10 + rand() * 12,
      delay: rand() * 0.25,
      dur: 1.4 + rand() * 1.2,
    }));
  }, [seed]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-24 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            '--dx': p.dx,
            '--dy': p.dy,
            '--rot': p.rot,
            animation: `sr-confetti ${p.dur}s cubic-bezier(.1,.6,.3,1) ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
};

/* -----------------------------------------------------------------------------
   QR modal
   -------------------------------------------------------------------------- */
const QrModal = ({ roomCode, playerCount, onClose }) => {
  const grid = useMemo(() => buildQrGrid(`squad-roulette-${roomCode}`), [roomCode]);
  const N = grid.length;
  return (
    <div className="sr-fade fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="sr-slide-up relative mx-4 mb-6 w-full max-w-sm rounded-[32px] border border-white/10 bg-[#141418] p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="sr-press absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
        >
          <X size={20} />
        </button>
        <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/50">Scan to join the squad</div>
        <div className="sr-display mt-2 text-[28px] font-black text-white">
          LOBBY <span style={{ color: LIME }}>#{roomCode}</span>
        </div>
        <div className="relative mx-auto mt-5 w-fit rounded-3xl bg-white p-4" style={{ boxShadow: `0 0 60px ${LIME}55` }}>
          <svg viewBox={`0 0 ${N} ${N}`} width="216" height="216" shapeRendering="crispEdges" role="img" aria-label="Lobby join QR code">
            {grid.map((row, r) =>
              row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill={INK} /> : null))
            )}
          </svg>
          <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border-4 border-white text-xl" style={{ background: LIME }}>
            🎲
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-white/70">
          <span className="h-2 w-2 rounded-full sr-blink" style={{ background: CORAL }} />
          {playerCount} player{playerCount === 1 ? '' : 's'} in lobby · waiting for more
        </div>
        <div className="mt-2 text-xs font-semibold text-white/40">squadroulette.gg/join/{roomCode}</div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------------------------
   POV REC / STAMP MODE — camera viewfinder with official watermark overlay
   -------------------------------------------------------------------------- */
const CameraView = ({ mission, names, pack, timeLeft, running, onToggleTimer, onClose }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [facing, setFacing] = useState('environment');
  const [recSeconds, setRecSeconds] = useState(0);
  const urgent = timeLeft <= 10 && timeLeft > 0;

  useEffect(() => {
    let stream = null;
    let cancelled = false;
    setStatus('loading');
    const start = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('getUserMedia unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      } catch (err) {
        if (!cancelled) setStatus('fallback');
      }
    };
    start();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  useEffect(() => {
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sr-fade fixed inset-0 z-50 bg-black">
      <div className={`relative mx-auto h-full w-full max-w-md overflow-hidden ${urgent ? 'sr-urgent' : ''}`}>
        {/* Live feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: status === 'live' ? 1 : 0, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* Fallback animated viewfinder */}
        {status !== 'live' && (
          <div className="absolute inset-0 overflow-hidden bg-[#07070a]">
            <div
              className="absolute -left-1/4 top-0 h-[70%] w-[90%] rounded-full opacity-50 blur-3xl"
              style={{ background: `radial-gradient(circle, ${CYAN}66, transparent 65%)`, animation: 'sr-blob-a 9s ease-in-out infinite' }}
            />
            <div
              className="absolute bottom-0 right-[-20%] h-[70%] w-[90%] rounded-full opacity-50 blur-3xl"
              style={{ background: `radial-gradient(circle, ${CORAL}55, transparent 65%)`, animation: 'sr-blob-b 11s ease-in-out infinite' }}
            />
            <svg className="absolute inset-[-10%] h-[120%] w-[120%] opacity-[0.18]" style={{ animation: 'sr-grain .4s steps(2) infinite' }}>
              <filter id="sr-noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              </filter>
              <rect width="100%" height="100%" filter="url(#sr-noise)" />
            </svg>
            <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" style={{ animation: 'sr-scan 3.2s linear infinite' }} />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-black/40 text-white/80">
                  {status === 'loading' ? <ScanLine size={30} className="animate-pulse" /> : <CameraOff size={30} />}
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-white/60">
                  {status === 'loading' ? 'Requesting camera…' : 'Simulated feed'}
                </div>
                {status === 'fallback' && (
                  <div className="mt-1 px-10 text-xs font-semibold text-white/40">
                    Camera blocked here — point another phone at this screen and film the overlay.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rule-of-thirds grid */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
        </div>

        {/* Focus box */}
        <div className="pointer-events-none absolute left-1/2 top-[38%] h-24 w-24 -translate-x-1/2 -translate-y-1/2" style={{ animation: 'sr-focus 2.4s ease-in-out infinite' }}>
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((cls) => (
            <span key={cls} className={`absolute h-5 w-5 ${cls}`} style={{ borderColor: LIME }} />
          ))}
        </div>

        {/* Viewfinder corner brackets */}
        <div className="pointer-events-none absolute inset-3">
          {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((cls) => (
            <span key={cls} className={`absolute h-10 w-10 border-white/80 ${cls}`} />
          ))}
        </div>

        {/* Top-left: REC + live countdown */}
        <div className="absolute left-6 top-[max(1.5rem,env(safe-area-inset-top))] flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 backdrop-blur-md">
            <span className="h-3.5 w-3.5 rounded-full sr-blink" style={{ background: CORAL, boxShadow: `0 0 12px ${CORAL}` }} />
            <span className="text-sm font-black tracking-widest text-white">REC</span>
            <span className="sr-tnum text-sm font-bold text-white/60">{formatTime(recSeconds)}</span>
          </div>
          <div
            className="sr-display sr-tnum w-fit rounded-xl px-3 py-1.5 text-[34px] font-black leading-none"
            style={{
              background: urgent ? CORAL : 'rgba(0,0,0,.55)',
              color: urgent ? '#fff' : LIME,
              backdropFilter: 'blur(10px)',
            }}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Top-right controls + watermark */}
        <div className="absolute right-6 top-[max(1.5rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Switch camera"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              className="sr-press grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"
            >
              <SwitchCamera size={20} />
            </button>
            <button
              type="button"
              aria-label="Close camera"
              onClick={onClose}
              className="sr-press grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"
            >
              <X size={22} />
            </button>
          </div>
          <div className="rounded-lg bg-black/40 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
            🎲 Squad<span style={{ color: LIME }}>Roulette</span>
          </div>
        </div>

        {/* Bottom overlay banner */}
        <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={onToggleTimer}
              className="sr-press flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-wider"
              style={{ background: running ? 'rgba(0,0,0,.6)' : LIME, color: running ? '#fff' : INK, backdropFilter: 'blur(10px)' }}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pause timer' : 'Start timer'}
            </button>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/15 bg-black/55 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em]" style={{ background: LIME, color: INK }}>
              <span>
                MISSION {missionNumber(mission)} • SQUAD ROULETTE
              </span>
              <span>+{mission.xp} XP</span>
            </div>
            <div className="px-4 pb-4 pt-3">
              <div className="sr-display text-[15px] font-black text-white/90">{fillText(mission.title, names, pack)}</div>
              <p className="mt-1.5 text-[19px] font-extrabold leading-[1.22] text-white">
                <RichText text={mission.prompt} names={names} pack={pack} />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------------------------
   Leaderboard
   -------------------------------------------------------------------------- */
const Leaderboard = ({ players, awards }) => {
  const sorted = [...players].sort((a, b) => b.xp - a.xp);
  const max = Math.max(1, ...sorted.map((p) => p.xp));
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="space-y-2">
      {sorted.map((p, i) => {
        const delta = awards[p.id] || 0;
        return (
          <div
            key={p.id}
            className="sr-slide-up relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
            style={{ animationDelay: `${i * 70}ms`, borderColor: i === 0 ? `${LIME}88` : undefined }}
          >
            <div
              className="absolute inset-y-0 left-0 opacity-20 transition-all duration-700"
              style={{ width: `${Math.max(0, (p.xp / max) * 100)}%`, background: i === 0 ? LIME : CYAN }}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-8 text-center text-xl font-black text-white/70">{medals[i] || i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-[18px] font-black text-white">
                  {p.name}
                  {i === 0 && p.xp > 0 && <Crown size={16} style={{ color: LIME }} />}
                </div>
              </div>
              {delta !== 0 && (
                <span
                  className="sr-pop rounded-full px-2 py-0.5 text-xs font-black"
                  style={{ background: delta > 0 ? LIME : CORAL, color: delta > 0 ? INK : '#fff' }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              )}
              <div className="sr-display sr-tnum text-[18px] font-black text-white">
                {p.xp}
                <span className="ml-1 text-[10px] text-white/50">XP</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* =============================================================================
   MAIN COMPONENT
   ========================================================================== */
export default function SquadRoulette() {
  // --- global ---------------------------------------------------------------
  const [screen, setScreen] = useState('lobby'); // lobby | spin | mission | results
  const [muted, setMuted] = useState(false);
  const [roomCode] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));
  const [showQR, setShowQR] = useState(false);

  // --- lobby ----------------------------------------------------------------
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [category, setCategory] = useState('supermarket');
  const [packName, setPackName] = useState('THE BASEMENT BOYS PACK');
  const [editingPack, setEditingPack] = useState(false);
  const [packDraft, setPackDraft] = useState('THE BASEMENT BOYS PACK');
  const [lobbyError, setLobbyError] = useState('');

  // --- rounds ---------------------------------------------------------------
  const [baseOrder, setBaseOrder] = useState([]);
  const [round, setRound] = useState(0);
  const [mission, setMission] = useState(null);
  const [cast, setCast] = useState(null);
  const [usedIds, setUsedIds] = useState([]);

  // --- spin -----------------------------------------------------------------
  const [spinning, setSpinning] = useState(false);
  const [reelTitle, setReelTitle] = useState('');
  const [reelKey, setReelKey] = useState(0);
  const [flickerNames, setFlickerNames] = useState(['', '', '', '']);
  const [locked, setLocked] = useState(false);
  const spinTimeoutRef = useRef(null);

  // --- mission --------------------------------------------------------------
  const [timeLeft, setTimeLeft] = useState(300);
  const [running, setRunning] = useState(false);
  const [twistRevealed, setTwistRevealed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const prevTimeRef = useRef(timeLeft);

  // --- results --------------------------------------------------------------
  const [outcome, setOutcome] = useState(null); // null | complete | chicken
  const [saboteurWon, setSaboteurWon] = useState(false);
  const [awards, setAwards] = useState({});
  const [penalty, setPenalty] = useState('');
  const [confettiSeed, setConfettiSeed] = useState(1);
  const [missionsCleared, setMissionsCleared] = useState(0);

  const cat = CATEGORIES[category];

  useEffect(() => {
    Synth.setMuted(muted);
  }, [muted]);

  /* ------------------------------ lobby actions ---------------------------- */
  const addPlayer = useCallback(
    (raw) => {
      const name = raw.trim().replace(/\s+/g, ' ').slice(0, 14);
      if (!name) return;
      if (players.length >= MAX_PLAYERS) {
        setLobbyError(`Max ${MAX_PLAYERS} players per squad`);
        return;
      }
      if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        setLobbyError(`${name} is already in the squad`);
        return;
      }
      Synth.click();
      buzz(12);
      setLobbyError('');
      setPlayers((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, xp: 0 }]);
      setNameInput('');
    },
    [players]
  );

  const removePlayer = (id) => {
    Synth.click();
    buzz(8);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setBaseOrder((prev) => prev.filter((pid) => pid !== id));
    setLobbyError('');
  };

  const savePack = () => {
    const v = packDraft.trim().slice(0, 28).toUpperCase();
    setPackName(v || 'THE BASEMENT BOYS PACK');
    setPackDraft(v || 'THE BASEMENT BOYS PACK');
    setEditingPack(false);
    Synth.click();
  };

  /* ------------------------------ spin logic ------------------------------- */
  const chooseMission = useCallback(
    (catId) => {
      const pool = MISSIONS.filter((m) => m.category === catId);
      let available = pool.filter((m) => !usedIds.includes(m.id));
      let nextUsed = usedIds;
      if (!available.length) {
        // Pool exhausted: start a fresh cycle, but never repeat the mission just played.
        const last = usedIds[usedIds.length - 1];
        available = pool.filter((m) => m.id !== last);
        nextUsed = usedIds.filter((id) => !pool.some((m) => m.id === id));
      }
      const chosen = pick(available);
      setUsedIds([...nextUsed, chosen.id]);
      return chosen;
    },
    [usedIds]
  );

  const startSpin = useCallback(
    (nextRound, order) => {
      const orderedPlayers = rotate(order, nextRound - 1)
        .map((id) => players.find((p) => p.id === id))
        .filter(Boolean);
      if (orderedPlayers.length < 2) return;
      const chosen = chooseMission(category);
      const newCast = buildCast(orderedPlayers);

      Synth.unlock();
      Synth.whoosh();
      setRound(nextRound);
      setMission(chosen);
      setCast(newCast);
      setLocked(false);
      setSpinning(true);
      setOutcome(null);
      setAwards({});
      setSaboteurWon(false);
      setTwistRevealed(false);
      setRunning(false);
      setCameraOpen(false);
      setScreen('spin');

      const allTitles = MISSIONS.map((m) => fillText(m.title, newCast.names, packName));
      const names = orderedPlayers.map((p) => p.name);
      let elapsed = 0;
      let delay = 42;
      let tickCount = 0;

      const step = () => {
        tickCount += 1;
        Synth.tick(1 - Math.min(0.5, elapsed / SPIN_DURATION_MS / 2));
        buzz(6);
        setReelTitle(allTitles[(tickCount * 7 + Math.floor(Math.random() * allTitles.length)) % allTitles.length]);
        setReelKey((k) => k + 1);
        setFlickerNames(ROLE_DEFS.map(() => pick(names)));
        elapsed += delay;
        delay = delay * 1.11 + 2;
        if (elapsed + delay < SPIN_DURATION_MS) {
          spinTimeoutRef.current = setTimeout(step, delay);
        } else {
          spinTimeoutRef.current = setTimeout(() => {
            Synth.lockIn();
            buzz([40, 30, 120]);
            setReelTitle(fillText(chosen.title, newCast.names, packName));
            setReelKey((k) => k + 1);
            setSpinning(false);
            setLocked(true);
            setTimeLeft(chosen.duration);
            prevTimeRef.current = chosen.duration;
          }, delay);
        }
      };
      clearTimeout(spinTimeoutRef.current);
      step();
    },
    [players, category, packName, chooseMission]
  );

  useEffect(() => () => clearTimeout(spinTimeoutRef.current), []);

  const handleLobbySpin = () => {
    if (players.length < 2) {
      setLobbyError('Add at least 2 players to spin');
      buzz([20, 40, 20]);
      Synth.fail();
      return;
    }
    // Keep previous order (so rotation continues) but add/remove changed players.
    const kept = baseOrder.filter((id) => players.some((p) => p.id === id));
    const added = shuffle(players.filter((p) => !kept.includes(p.id)).map((p) => p.id));
    const order = kept.length ? [...kept, ...added] : shuffle(players.map((p) => p.id));
    setBaseOrder(order);
    startSpin(round + 1, order);
  };

  const handleNextRound = () => {
    Synth.click();
    startSpin(round + 1, baseOrder);
  };

  /* ------------------------------ timer logic ------------------------------ */
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const prev = prevTimeRef.current;
    prevTimeRef.current = timeLeft;
    if (!running) return;
    if (timeLeft <= 10 && timeLeft > 0 && timeLeft !== prev) {
      Synth.beep(timeLeft <= 3);
      buzz(timeLeft <= 3 ? 60 : 25);
    }
    if (timeLeft === 0 && prev > 0) {
      Synth.alarm();
      buzz([200, 80, 200, 80, 400]);
      setRunning(false);
    }
  }, [timeLeft, running]);

  const toggleTimer = () => {
    Synth.unlock();
    Synth.click();
    buzz(15);
    if (timeLeft === 0) setTimeLeft(mission.duration);
    setRunning((r) => !r);
  };

  const addMinute = () => {
    Synth.click();
    buzz(10);
    setTimeLeft((t) => t + 60);
  };

  const simulateLast10 = () => {
    Synth.unlock();
    buzz(20);
    prevTimeRef.current = 11;
    setTimeLeft(10);
    setRunning(true);
  };

  const resetTimer = () => {
    Synth.click();
    setRunning(false);
    setTimeLeft(mission.duration);
  };

  /* ------------------------------ results logic ---------------------------- */
  const resolveMission = (result) => {
    if (!cast || !mission) return;
    const delta = {};
    const add = (player, amount) => {
      if (!player) return;
      delta[player.id] = (delta[player.id] || 0) + amount;
    };
    if (result === 'complete') {
      const core = [cast.p1, cast.p2, cast.p3].filter(Boolean);
      core.forEach((p) => add(p, mission.xp));
      cast.extras.forEach((p) => add(p, HYPE_CREW_XP));
      if (timeLeft > 0) core.forEach((p) => add(p, SPEED_BONUS));
      if (saboteurWon) add(cast.saboteur, SABOTEUR_BONUS);
      Synth.success();
      buzz([30, 40, 30, 40, 120]);
      setConfettiSeed((s) => s + 1);
      setMissionsCleared((n) => n + 1);
      setPenalty('');
    } else {
      [cast.p1, cast.p2, cast.p3].filter(Boolean).forEach((p) => add(p, -CHICKEN_PENALTY));
      if (saboteurWon) add(cast.saboteur, SABOTEUR_BONUS);
      Synth.fail();
      buzz([300]);
      setPenalty(pick(PENALTY_DARES).replace('{name}', cast.p1.name));
    }
    setPlayers((prev) => prev.map((p) => ({ ...p, xp: p.xp + (delta[p.id] || 0) })));
    setAwards(delta);
    setOutcome(result);
    setRunning(false);
  };

  const backToLobby = () => {
    Synth.click();
    setRunning(false);
    setCameraOpen(false);
    clearTimeout(spinTimeoutRef.current);
    setSpinning(false);
    setScreen('lobby');
  };

  /* ------------------------------ derived ---------------------------------- */
  const roleRows = useMemo(() => {
    if (!cast) return [];
    return [
      { ...ROLE_DEFS[0], name: cast.p2.name },
      { ...ROLE_DEFS[1], name: cast.p1.name },
      { ...ROLE_DEFS[2], name: cast.p3 ? cast.p3.name : 'WHOLE SQUAD' },
      { ...ROLE_DEFS[3], name: cast.saboteur.name },
    ];
  }, [cast]);

  const urgent = running && timeLeft <= 10 && timeLeft > 0;
  const timeUp = timeLeft === 0;
  const progress = mission ? Math.min(100, (timeLeft / Math.max(mission.duration, timeLeft)) * 100) : 100;

  /* =============================== RENDER ================================== */
  return (
    <div className="sr-root min-h-screen w-full bg-[#0A0A0C] text-white">
      <GlobalStyles />
      <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[140%] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle, ${cat.color === '#FFFFFF' ? CORAL : cat.color}, transparent 70%)` }} />

        {/* ================================================================
            SCREEN 1 — SQUAD LOBBY & VIBE SELECTOR
           ================================================================ */}
        {screen === 'lobby' && (
          <div className="sr-fade relative px-5 pb-40 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <header className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  Synth.unlock();
                  Synth.click();
                  setShowQR(true);
                }}
                className="sr-press flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4"
              >
                <span className="h-2.5 w-2.5 rounded-full sr-blink" style={{ background: CORAL, boxShadow: `0 0 10px ${CORAL}` }} />
                <span className="text-[13px] font-black tracking-wider">
                  LOBBY #{roomCode} <span className="text-white/40">•</span> <span style={{ color: CORAL }}>LIVE</span>
                </span>
                <QrCode size={16} className="text-white/70" />
              </button>
              <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </IconButton>
            </header>

            <div className="mt-7">
              <Logo size="lg" />
              <p className="mt-2 text-[15px] font-semibold text-white/55">
                Spin. Get cast. Film the chaos. {missionsCleared > 0 && <span style={{ color: LIME }}>· {missionsCleared} cleared tonight</span>}
              </p>
            </div>

            {/* Squad Roster */}
            <section className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.2em] text-white/70">
                  <Users size={16} /> Squad Roster
                </h2>
                <span className="text-xs font-black" style={{ color: players.length >= 2 ? LIME : CORAL }}>
                  {players.length}/{MAX_PLAYERS} · MIN 2
                </span>
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPlayer(nameInput);
                }}
              >
                <input
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (lobbyError) setLobbyError('');
                  }}
                  placeholder="Add player name…"
                  maxLength={14}
                  className="min-w-0 flex-1 rounded-2xl border-2 border-white/10 bg-black/40 px-4 py-3.5 text-[17px] font-bold text-white placeholder-white/30 outline-none transition-colors focus:border-[#CCFF00]"
                />
                <button
                  type="submit"
                  aria-label="Add player"
                  className="sr-press grid w-14 place-items-center rounded-2xl text-[#0A0A0C]"
                  style={{ background: LIME }}
                >
                  <UserPlus size={22} strokeWidth={2.75} />
                </button>
              </form>

              {lobbyError && (
                <div className="sr-shake mt-2 text-sm font-bold" style={{ color: CORAL }}>
                  {lobbyError}
                </div>
              )}

              {players.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {players.map((p, i) => {
                    const c = [LIME, CORAL, CYAN][i % 3];
                    return (
                      <span
                        key={p.id}
                        className="sr-pop flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[15px] font-black"
                        style={{ background: `${c}1A`, color: c, border: `1.5px solid ${c}` }}
                      >
                        {p.name}
                        {p.xp !== 0 && <span className="text-[11px] opacity-70">{p.xp}xp</span>}
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => removePlayer(p.id)}
                          className="sr-press grid h-6 w-6 place-items-center rounded-full bg-black/40"
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/35">Quick add</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ADD.map((n) => {
                    const added = players.some((p) => p.name.toLowerCase() === n.toLowerCase());
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={added}
                        onClick={() => addPlayer(n)}
                        className="sr-press rounded-full border border-dashed border-white/25 px-3.5 py-1.5 text-sm font-bold text-white/80 disabled:border-transparent disabled:bg-white/5 disabled:text-white/25"
                      >
                        {added ? <Check size={14} className="-mt-0.5 mr-1 inline" /> : '+ '}
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Vibe Selector */}
            <section className="mt-6">
              <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.2em] text-white/70">Pick the vibe</h2>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(CATEGORIES).map((c) => {
                  const selected = category === c.id;
                  const isCreator = c.id === 'creator';
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!selected) {
                          Synth.unlock();
                          Synth.click();
                          buzz(10);
                          setCategory(c.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !editingPack) setCategory(c.id);
                      }}
                      className="sr-press relative flex min-h-[150px] cursor-pointer flex-col justify-between overflow-hidden rounded-[24px] border-2 p-4"
                      style={{
                        borderColor: selected ? c.color : 'rgba(255,255,255,.08)',
                        background: isCreator
                          ? `linear-gradient(140deg, ${CORAL}${selected ? '40' : '1f'}, ${CYAN}${selected ? '33' : '14'})`
                          : selected
                            ? `${c.color}1f`
                            : 'rgba(255,255,255,.035)',
                        boxShadow: selected ? `0 0 30px ${isCreator ? CORAL : c.color}40` : 'none',
                      }}
                    >
                      {selected && (
                        <span className="sr-pop absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full" style={{ background: c.color, color: INK }}>
                          <Check size={15} strokeWidth={3.5} />
                        </span>
                      )}
                      <div className="text-[38px] leading-none">{c.emoji}</div>
                      {isCreator ? (
                        <div className="mt-3">
                          <span className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0A0A0C]">
                            <Star size={9} fill={INK} /> Sponsored
                          </span>
                          {editingPack ? (
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                savePack();
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                value={packDraft}
                                maxLength={28}
                                onChange={(e) => setPackDraft(e.target.value)}
                                className="w-full min-w-0 rounded-lg border border-white/30 bg-black/60 px-2 py-1 text-[12px] font-black uppercase text-white outline-none"
                              />
                              <button type="submit" aria-label="Save pack name" className="sr-press grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: LIME, color: INK }}>
                                <Check size={14} strokeWidth={3} />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-start gap-1">
                              <div className="sr-display text-[13px] font-black leading-tight text-white">{packName}</div>
                              <button
                                type="button"
                                aria-label="Edit pack name"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPackDraft(packName);
                                  setEditingPack(true);
                                  setCategory('creator');
                                }}
                                className="sr-press -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )}
                          <div className="mt-1 text-[11px] font-bold text-white/50">Creator Custom Pack</div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="text-[15px] font-black leading-tight text-white">{c.name}</div>
                          <div className="mt-1 text-[12px] font-bold" style={{ color: selected ? c.color : 'rgba(255,255,255,.45)' }}>
                            {c.tagline}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Sticky CTA */}
            <div className="fixed inset-x-0 bottom-0 z-30">
              <div className="mx-auto max-w-md bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
                <button
                  type="button"
                  onClick={handleLobbySpin}
                  className={`sr-press sr-display flex w-full items-center justify-center gap-2.5 rounded-[22px] px-3 py-5 text-[17px] font-black text-[#0A0A0C] ${players.length >= 2 ? 'sr-cta-pulse' : 'opacity-50'}`}
                  style={{ background: LIME }}
                >
                  <Dices size={24} strokeWidth={2.75} className="shrink-0" />
                  SPIN THE MISSION WHEEL
                </button>
                {players.length < 2 && (
                  <div className="mt-2 text-center text-xs font-bold text-white/40">Add {2 - players.length} more player{2 - players.length === 1 ? '' : 's'} to unlock</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            SCREEN 2 — DRAMATIC SLOT-MACHINE ROULETTE
           ================================================================ */}
        {screen === 'spin' && mission && cast && (
          <div className="relative flex min-h-screen flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
            {locked && <div key={`flash-${round}`} className="pointer-events-none fixed inset-0 z-40" style={{ background: LIME, animation: 'sr-flash .5s ease-out both' }} />}

            <header className="flex items-center justify-between">
              <IconButton label="Back to lobby" onClick={backToLobby}>
                <ChevronLeft size={22} />
              </IconButton>
              <Pill color={cat.color === '#FFFFFF' ? CORAL : cat.color}>
                {cat.emoji} {category === 'creator' ? packName : cat.name}
              </Pill>
              <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </IconButton>
            </header>

            <div className="mt-8 text-center">
              <div className="text-[12px] font-black uppercase tracking-[0.35em] text-white/50">Round {round}</div>
              <div className={`sr-display mt-1 text-[30px] font-black ${locked ? '' : 'animate-pulse'}`} style={{ color: locked ? LIME : '#fff' }}>
                {locked ? 'MISSION LOCKED' : 'SPINNING…'}
              </div>
            </div>

            {/* Slot reel */}
            <div className={`relative mt-6 ${locked ? 'sr-shake' : ''}`}>
              <div
                className="relative overflow-hidden rounded-[28px] border-4 bg-black"
                style={{ borderColor: locked ? LIME : 'rgba(255,255,255,.15)', boxShadow: locked ? `0 0 60px ${LIME}66` : 'none' }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute inset-y-0 left-0 z-10 w-2" style={{ background: locked ? LIME : CORAL }} />
                <div className="absolute inset-y-0 right-0 z-10 w-2" style={{ background: locked ? LIME : CORAL }} />
                <div className="flex h-[148px] items-center justify-center px-6 text-center">
                  <div
                    key={reelKey}
                    className="sr-display text-[30px] font-black leading-[1.05] text-white"
                    style={{ animation: spinning ? 'sr-reel .09s linear both' : 'sr-pop .5s cubic-bezier(.2,1.4,.4,1) both' }}
                  >
                    {reelTitle || '???'}
                  </div>
                </div>
              </div>
              {locked && (
                <div className="sr-pop mt-3 flex flex-wrap justify-center gap-2">
                  <Pill color={DIFFICULTY[mission.difficulty].color} solid>
                    {DIFFICULTY[mission.difficulty].label}
                  </Pill>
                  <Pill color={LIME}>+{mission.xp} XP</Pill>
                  <Pill color="#FFFFFF">
                    <Timer size={12} /> {formatTime(mission.duration)}
                  </Pill>
                </div>
              )}
            </div>

            {/* Role slots */}
            <div className="mt-6 space-y-2.5">
              {roleRows.map((r, i) => (
                <div
                  key={r.key}
                  className="flex items-center gap-3 overflow-hidden rounded-2xl border-2 bg-white/[0.03] px-4 py-3"
                  style={{ borderColor: locked ? `${r.color}99` : 'rgba(255,255,255,.08)' }}
                >
                  <div className="text-[26px]">{r.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: r.color }}>
                      [{r.label}]
                    </div>
                    <div
                      key={locked ? `locked-${i}` : `${reelKey}-${i}`}
                      className={`truncate text-[22px] font-black ${locked ? 'sr-pop' : ''}`}
                      style={{ animationDelay: locked ? `${i * 110}ms` : undefined, opacity: locked ? 1 : 0.55 }}
                    >
                      {locked ? r.name : flickerNames[i] || '—'}
                    </div>
                  </div>
                  {locked ? <Lock size={18} style={{ color: r.color }} /> : <Dices size={18} className="text-white/30" />}
                </div>
              ))}
              {cast.extras.length > 0 && (
                <div className="text-center text-xs font-bold text-white/50">
                  📣 Hype crew: {cast.extras.map((p) => p.name).join(', ')}
                </div>
              )}
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                disabled={!locked}
                onClick={() => {
                  Synth.whoosh();
                  buzz(20);
                  setScreen('mission');
                }}
                className={`sr-press sr-display flex w-full items-center justify-center gap-2 rounded-[22px] py-5 text-[18px] font-black text-[#0A0A0C] transition-opacity ${locked ? 'sr-cta-pulse' : 'opacity-20'}`}
                style={{ background: LIME }}
              >
                OPEN MISSION BRIEFING <ArrowRight size={22} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            SCREEN 3 — ACTIVE MISSION BRIEFING & LIVE TIMER
           ================================================================ */}
        {screen === 'mission' && mission && cast && (
          <div className={`sr-fade relative px-5 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))] ${urgent ? 'sr-urgent' : ''}`}>
            <header className="flex items-center justify-between">
              <IconButton label="Back to lobby" onClick={backToLobby}>
                <House size={20} />
              </IconButton>
              <div className="text-center">
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-white/45">Round {round}</div>
                <div className="sr-display text-[15px] font-black">MISSION {missionNumber(mission)}</div>
              </div>
              <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </IconButton>
            </header>

            {/* Badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill color={cat.color === '#FFFFFF' ? CORAL : cat.color}>
                {cat.emoji} {category === 'creator' ? packName : cat.name}
              </Pill>
              <Pill color={DIFFICULTY[mission.difficulty].color} solid>
                {DIFFICULTY[mission.difficulty].label}
              </Pill>
              <Pill color={LIME} solid>
                <Zap size={12} fill={INK} /> +{mission.xp} XP
              </Pill>
            </div>

            {/* Mission card */}
            <div className="sr-slide-up relative mt-4 overflow-hidden rounded-[30px] border-2 border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-30 blur-2xl" style={{ background: CORAL }} />
              <div className="relative">
                <div className="sr-display text-[13px] font-black uppercase tracking-wide" style={{ color: LIME }}>
                  {fillText(mission.title, cast.names, packName)}
                </div>
                <p className={`mt-3 font-black leading-[1.16] text-white ${mission.prompt.length > 230 ? 'text-[23px]' : 'text-[26px]'}`}>
                  <RichText text={mission.prompt} names={cast.names} pack={packName} />
                </p>
              </div>
            </div>

            {/* Timer */}
            <div
              className="mt-4 rounded-[30px] border-2 p-5 transition-colors"
              style={{
                borderColor: urgent || timeUp ? CORAL : 'rgba(255,255,255,.1)',
                background: urgent ? `${CORAL}1f` : 'rgba(255,255,255,.035)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.2em] text-white/60">
                  <Timer size={15} /> {timeUp ? "Time's up!" : running ? 'Live' : 'Paused'}
                  {running && <span className="h-2 w-2 rounded-full sr-blink" style={{ background: CORAL }} />}
                </div>
                <button type="button" onClick={resetTimer} aria-label="Reset timer" className="sr-press flex items-center gap-1 text-xs font-bold text-white/50">
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
              <div
                key={urgent ? `u-${timeLeft}` : 'calm'}
                className={`sr-display sr-tnum mt-1 text-center text-[76px] font-black leading-none ${urgent ? 'sr-pop' : ''}`}
                style={{ color: urgent || timeUp ? CORAL : '#fff', textShadow: urgent ? `0 0 30px ${CORAL}` : 'none' }}
              >
                {formatTime(timeLeft)}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progress}%`, background: urgent || timeUp ? CORAL : LIME }} />
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={toggleTimer}
                  className="sr-press flex items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-black"
                  style={{ background: running ? '#fff' : LIME, color: INK }}
                >
                  {running ? <Pause size={22} fill={INK} /> : <Play size={22} fill={INK} />}
                  {running ? 'PAUSE' : timeUp ? 'RESTART' : timeLeft === mission.duration ? 'START MISSION' : 'RESUME'}
                </button>
                <button type="button" onClick={addMinute} className="sr-press rounded-2xl border-2 border-white/15 px-5 text-[16px] font-black text-white">
                  +1 MIN
                </button>
              </div>
              <button
                type="button"
                onClick={simulateLast10}
                className="sr-press mt-2 w-full rounded-2xl border-2 border-dashed py-2.5 text-[12px] font-black uppercase tracking-[0.15em]"
                style={{ borderColor: `${CORAL}88`, color: CORAL }}
              >
                ⚠ Simulate last 10 seconds (test)
              </button>
            </div>

            {/* POV REC */}
            <button
              type="button"
              onClick={() => {
                Synth.unlock();
                Synth.whoosh();
                buzz(25);
                setCameraOpen(true);
              }}
              className="sr-press mt-4 flex w-full items-center justify-between rounded-[26px] border-2 px-5 py-4"
              style={{ borderColor: CORAL, background: `${CORAL}1a` }}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: CORAL }}>
                  <Video size={22} />
                </span>
                <span className="text-left">
                  <span className="block text-[17px] font-black">POV REC / STAMP MODE</span>
                  <span className="block text-xs font-bold text-white/55">Camera + official mission watermark</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs font-black" style={{ color: CORAL }}>
                <span className="h-2.5 w-2.5 rounded-full sr-blink" style={{ background: CORAL }} /> REC
              </span>
            </button>

            {/* Role cards */}
            <h3 className="mb-3 mt-7 text-[13px] font-black uppercase tracking-[0.2em] text-white/70">The cast</h3>
            <div className="space-y-3">
              {[
                { def: ROLE_DEFS[1], name: cast.p1.name, text: mission.roles.p1 },
                { def: ROLE_DEFS[0], name: cast.p2.name, text: mission.roles.p2 },
                { def: ROLE_DEFS[2], name: cast.p3 ? cast.p3.name : 'THE WHOLE SQUAD', text: mission.roles.p3 },
              ].map(({ def, name, text }, i) => (
                <div key={def.key} className="sr-slide-up rounded-[24px] border-2 bg-white/[0.03] p-4" style={{ borderColor: `${def.color}55`, animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: def.color }}>
                      {def.emoji} {def.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[24px] font-black leading-tight" style={{ color: def.color }}>
                    {name}
                  </div>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug text-white/80">
                    <RichText text={text} names={cast.names} pack={packName} />
                  </p>
                </div>
              ))}

              {cast.extras.map((p) => (
                <div key={p.id} className="rounded-[24px] border-2 border-white/10 bg-white/[0.03] p-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">📣 HYPE CREW</span>
                  <div className="mt-1 text-[22px] font-black">{p.name}</div>
                  <p className="mt-1 text-[15px] font-semibold text-white/70">Crowd reactions, gasps, slow claps and keeping the energy at 1000%. Earn +{HYPE_CREW_XP} XP if the squad completes it.</p>
                </div>
              ))}

              {/* Secret twist */}
              <button
                type="button"
                onClick={() => {
                  Synth.click();
                  buzz(twistRevealed ? 10 : [20, 30, 20]);
                  setTwistRevealed((v) => !v);
                }}
                className="sr-press relative w-full overflow-hidden rounded-[24px] border-2 p-4 text-left"
                style={{
                  borderColor: twistRevealed ? '#fff' : 'rgba(255,255,255,.25)',
                  borderStyle: twistRevealed ? 'solid' : 'dashed',
                  background: twistRevealed ? 'rgba(255,255,255,.08)' : 'repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 12px, transparent 12px 24px)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">🕵️ SECRET SABOTEUR</span>
                  {twistRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
                <div className="mt-1 text-[24px] font-black">
                  {cast.saboteur.name}
                  {cast.saboteur === cast.p2 || cast.saboteur === cast.p3 ? (
                    <span className="ml-2 align-middle text-[11px] font-black uppercase tracking-wider text-white/50">(double agent)</span>
                  ) : null}
                </div>
                {twistRevealed ? (
                  <p className="sr-pop mt-2 text-[17px] font-black leading-snug" style={{ color: LIME }}>
                    {fillText(mission.twist, cast.names, packName)}
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-[15px] font-black text-white/70">
                    <Lock size={16} /> Tap to reveal secret twist — {cast.saboteur.name}'s eyes only 👀
                  </div>
                )}
              </button>
            </div>

            {/* End mission CTA */}
            <div className="fixed inset-x-0 bottom-0 z-30">
              <div className="mx-auto max-w-md bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
                <button
                  type="button"
                  onClick={() => {
                    Synth.click();
                    buzz(20);
                    setRunning(false);
                    setScreen('results');
                  }}
                  className={`sr-press sr-display flex w-full items-center justify-center gap-2 rounded-[22px] py-5 text-[17px] font-black ${timeUp ? 'sr-cta-pulse' : ''}`}
                  style={{ background: timeUp ? LIME : '#fff', color: INK }}
                >
                  <Trophy size={22} strokeWidth={2.75} /> END MISSION &amp; SCORE IT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            SCREEN 4 — MISSION ACCOMPLISHED & SQUAD LEADERBOARD
           ================================================================ */}
        {screen === 'results' && mission && cast && (
          <div className="sr-fade relative px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
            {outcome === 'complete' && <Confetti seed={confettiSeed} />}

            <header className="flex items-center justify-between">
              <IconButton
                label="Back to mission"
                onClick={() => {
                  if (!outcome) setScreen('mission');
                }}
              >
                <ChevronLeft size={22} className={outcome ? 'opacity-30' : ''} />
              </IconButton>
              <div className="sr-display text-[15px] font-black">ROUND {round} RESULTS</div>
              <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </IconButton>
            </header>

            {!outcome && (
              <div className="sr-slide-up">
                <div className="mt-8 text-center">
                  <div className="text-[12px] font-black uppercase tracking-[0.3em] text-white/50">Mission {missionNumber(mission)}</div>
                  <div className="sr-display mt-2 text-[32px] font-black leading-[1.05]">
                    DID THE SQUAD <span style={{ color: LIME }}>PULL IT OFF?</span>
                  </div>
                  <div className="mt-3 text-[15px] font-bold text-white/60">{fillText(mission.title, cast.names, packName)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    Synth.click();
                    buzz(10);
                    setSaboteurWon((v) => !v);
                  }}
                  className="sr-press mt-7 flex w-full items-center gap-3 rounded-[22px] border-2 p-4 text-left"
                  style={{ borderColor: saboteurWon ? LIME : 'rgba(255,255,255,.12)', background: saboteurWon ? `${LIME}14` : 'transparent' }}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2"
                    style={{ borderColor: saboteurWon ? LIME : 'rgba(255,255,255,.3)', background: saboteurWon ? LIME : 'transparent', color: INK }}
                  >
                    {saboteurWon && <Check size={16} strokeWidth={3.5} />}
                  </span>
                  <span>
                    <span className="block text-[16px] font-black">🕵️ {cast.saboteur.name} pulled off the secret twist</span>
                    <span className="block text-xs font-bold text-white/50">
                      Nobody caught it → +{SABOTEUR_BONUS} XP bonus. Reveal: "{fillText(mission.twist, cast.names, packName).slice(0, 60)}…"
                    </span>
                  </span>
                </button>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => resolveMission('complete')}
                    className="sr-press sr-display flex flex-col items-center rounded-[26px] py-6 text-[22px] font-black text-[#0A0A0C]"
                    style={{ background: LIME, boxShadow: `0 0 40px ${LIME}55` }}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={24} strokeWidth={2.75} /> MISSION COMPLETE
                    </span>
                    <span className="mt-1 font-sans text-[13px] font-black opacity-70">
                      +{mission.xp} XP each{timeLeft > 0 ? ` · +${SPEED_BONUS} beat-the-clock bonus` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveMission('chicken')}
                    className="sr-press sr-display flex flex-col items-center rounded-[26px] border-2 py-6 text-[22px] font-black"
                    style={{ borderColor: CORAL, color: CORAL, background: `${CORAL}12` }}
                  >
                    <span>🐔 CHICKENED OUT</span>
                    <span className="mt-1 font-sans text-[13px] font-black opacity-80">Penalty: −{CHICKEN_PENALTY} XP + a dare</span>
                  </button>
                </div>
              </div>
            )}

            {outcome && (
              <div>
                <div className="sr-pop mt-8 text-center">
                  <div className="text-[54px] leading-none">{outcome === 'complete' ? '🏆' : '🐔'}</div>
                  <div className="sr-display mt-3 text-[34px] font-black leading-[1.02]" style={{ color: outcome === 'complete' ? LIME : CORAL }}>
                    {outcome === 'complete' ? 'MISSION ACCOMPLISHED' : 'CHICKENED OUT'}
                  </div>
                </div>

                {outcome === 'chicken' && penalty && (
                  <div className="sr-shake mt-5 rounded-[24px] border-2 p-4" style={{ borderColor: CORAL, background: `${CORAL}1a` }}>
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: CORAL }}>
                      <Skull size={14} /> Penalty dare
                    </div>
                    <p className="mt-1.5 text-[19px] font-black leading-snug">{penalty}</p>
                  </div>
                )}

                {Object.keys(awards).length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {players
                      .filter((p) => awards[p.id])
                      .map((p) => (
                        <span
                          key={p.id}
                          className="sr-pop rounded-full px-3 py-1.5 text-sm font-black"
                          style={{
                            background: awards[p.id] > 0 ? `${LIME}1f` : `${CORAL}1f`,
                            color: awards[p.id] > 0 ? LIME : CORAL,
                            border: `1.5px solid ${awards[p.id] > 0 ? LIME : CORAL}`,
                          }}
                        >
                          {p.name} {awards[p.id] > 0 ? '+' : ''}
                          {awards[p.id]} XP
                        </span>
                      ))}
                  </div>
                )}

                <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.2em] text-white/70">
                  <Flame size={16} style={{ color: CORAL }} /> Tonight's squad leaderboard
                </h3>
                <Leaderboard players={players} awards={awards} />

                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={handleNextRound}
                    className="sr-press sr-display sr-cta-pulse flex w-full items-center justify-center gap-2 rounded-[22px] py-5 text-[19px] font-black text-[#0A0A0C]"
                    style={{ background: LIME }}
                  >
                    <Dices size={24} strokeWidth={2.75} /> NEXT ROUND
                  </button>
                  <div className="text-center text-xs font-bold text-white/40">Roles rotate automatically · same vibe</div>
                  <button
                    type="button"
                    onClick={backToLobby}
                    className="sr-press flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-white/15 py-4 text-[15px] font-black text-white"
                  >
                    <House size={18} /> Change vibe / squad
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showQR && <QrModal roomCode={roomCode} playerCount={players.length} onClose={() => setShowQR(false)} />}

      {cameraOpen && mission && cast && (
        <CameraView
          mission={mission}
          names={cast.names}
          pack={packName}
          timeLeft={timeLeft}
          running={running}
          onToggleTimer={toggleTimer}
          onClose={() => {
            Synth.click();
            setCameraOpen(false);
          }}
        />
      )}
    </div>
  );
}
