// Mission Briefing content for every game: how to set up the space right now, what each role
// does in real life, which buttons their phone shows, and what gets them penalised.
//
//   setup      numbered physical steps everyone reads before the countdown
//   roles[id]  irl / controls / penalty (personal bullets) + summary (what the others see)
//   hidden     a secret role: never listed by name on anyone else's briefing

export const SNITCH_LINE = 'Snitch Protocol: stopping the recording, leaving the app or covering the lens sets off a siren and a strobe (−50 XP).';
export const SNITCH_DARK_LINE = 'Snitch Protocol: stopping the recording or leaving the app sets off a siren and a strobe (−50 XP). Darkness is fine.';

export const BRIEFINGS = {
  mafia: {
    setup: [
      'Sit in a circle where everyone can hear the Storyteller phone, and turn its volume all the way up.',
      'Hold the card on your phone to see your secret role. Let go, keep a straight face, then tap ready.',
      'Night: everyone closes their eyes. Open them only when the Storyteller calls your role, and tap on your screen in silence.',
      'Day: talk, accuse, defend. When the timer ends, every living player votes on their own phone.',
    ],
    roles: {
      mafia: {
        irl: 'Wake up when the Storyteller calls Mafia. Silently tap a player on your screen to eliminate them. Blend in during the day.',
        controls: 'At night your screen shows the living players: tap one, then confirm. With a partner, you both have to land on the same name.',
        penalty: 'Caught by the town vote and you’re out.',
        summary: 'Wakes at night and silently picks someone to eliminate. Pretends to be a citizen by day.',
        hidden: true,
      },
      doctor: {
        irl: 'Wake up when the Storyteller calls the Doctor. Tap one player (including yourself) to protect them from the Mafia tonight.',
        controls: 'Tap a name, then Protect.',
        penalty: null,
        summary: 'Wakes at night and protects one player. If the Mafia picked them, nobody dies.',
        hidden: true,
      },
      detective: {
        irl: 'Wake up when the Storyteller calls the Detective. Tap one player to immediately see on your screen if they are MAFIA or INNOCENT.',
        controls: 'Tap a name, then Investigate: the verdict shows for 4 seconds, only on your screen.',
        penalty: null,
        summary: 'Wakes at night and checks one player: Mafia or innocent. Only they see the answer.',
        hidden: true,
      },
      citizen: {
        irl: 'Keep your eyes closed all night. During the day, listen for clues and vote out the Mafia.',
        controls: 'Your screen stays dark at night. By day: the morning report, the debate timer and your ballot.',
        penalty: null,
        summary: 'Sleeps all night. Finds the Mafia by talking, then votes them out.',
        hidden: true,
      },
    },
  },
  blind_sonar: {
    setup: [
      'Clear the room or a patch of grass of anything you could trip over.',
      'Blindfold the Blind Hunter (or they keep their eyes shut) in the middle.',
      'Survivors: phone volume to 100% — the beeps are the game.',
      'Survivors spread out at least 3 metres from the hunter before the countdown ends.',
    ],
    roles: {
      hunter: {
        irl: 'Stay blind the whole round. Move slowly, listen for beeps, then grab a survivor.',
        controls: 'Your whole screen is one button: tap to fire a sonar pulse (12 s cooldown). Caught someone? Tap “I caught someone” and pick them.',
        penalty: 'Peeking is cheating — every survivor is filming you.',
        summary: 'Blind. Every 12 s they can fire a sonar pulse that makes all survivor phones beep after a 3-2-1 warning, then they catch by touch.',
      },
      survivor: {
        irl: 'Keep the hunter in frame and stay silent. When the 3-2-1 warning flashes, get ready to dodge.',
        controls: 'Camera that records automatically, plus “Near miss” when the hunter passes within a metre (3 max, +150 XP each).',
        penalty: null,
        summary: 'Film the hunter. Their phones beep on every pulse, which gives away where they stand.',
      },
    },
  },
  teleprompter: {
    setup: [
      'Pick a product spot (shelf, table, bench) with decent light.',
      'The Director stands about 2 metres in front of the Actor.',
      'Saboteurs gather behind the Director, out of shot.',
      'Actor: turn your phone volume up and hold it at chest height.',
    ],
    roles: {
      actor: {
        irl: 'Read the teleprompter out loud like a real TV ad, holding the product.',
        controls: 'Your phone is the teleprompter: the script scrolls on its own and stage directions flash on screen.',
        penalty: 'Ignore a stage direction and the squad makes you redo it — commit instantly.',
        summary: 'Reads a live ad off their phone and must obey every stage direction that appears.',
      },
      director: {
        irl: 'Frame the Actor and film the whole take. Cue them if they lose their place.',
        controls: 'Camera with the script mirrored along the bottom and “End take”. With only two players you can inject directions too.',
        penalty: null,
        summary: 'Films the commercial with the script mirrored on screen and calls cut.',
      },
      saboteur: {
        irl: 'Stay out of shot and watch the Actor’s face.',
        controls: 'A grid of stage directions: tap one to drop it onto the Actor’s teleprompter (5 s cooldown, +25 XP each).',
        penalty: 'None — sabotage is the job.',
        summary: 'Inject stage directions straight onto the Actor’s teleprompter mid-take.',
      },
    },
  },
  red_light: {
    setup: [
      'The Watcher stands at one end, back turned to the runners.',
      'Runners line up at least 10 metres away.',
      'Agree what counts as a tag (a tap on the Watcher’s shoulder).',
    ],
    roles: {
      watcher: {
        irl: 'Face away on green. Spin round the moment you call red.',
        controls: 'One giant toggle: tap for red (FREEZE), tap again for green. Each flip locks for 1.5 s.',
        penalty: 'None — but every flip shows on the runners’ screens.',
        summary: 'Controls the light. On red, the runners’ phones watch their motion sensors.',
      },
      runner: {
        irl: 'Creep towards the Watcher on green. On red, freeze completely — phone included.',
        controls: 'Camera with the light on top and “I tagged the watcher”. Without a motion sensor you hold a button to stay frozen.',
        penalty: 'Moving on red (after a 0.7 s grace) puts you out.',
        summary: 'Film and creep forward. Any motion on red knocks them out.',
      },
    },
  },
  hide_seek: {
    setup: [
      'Agree the boundaries: which rooms or area are in play.',
      'The Seeker stands at base facing a wall.',
      'Hiders: volume up — pings and alarms are part of the game.',
      'Hiders get 30 seconds to hide once the countdown ends.',
    ],
    roles: {
      seeker: {
        irl: 'Eyes closed while your phone counts 30 s, then hunt.',
        controls: 'Camera with flashlight, a flash-pulse button and 3 sound pings that make every hider’s phone beep. “Found someone” for each find.',
        penalty: 'Peeking during the countdown is cheating — your phone shows it full-screen.',
        summary: 'Counts 30 s, then hunts with a flashlight, flash pulses and 3 sound pings that make hiders’ phones beep.',
      },
      hider: {
        irl: 'Hide and keep filming. Every 45 s a Peek Check makes you pan your camera out of your spot.',
        controls: 'Camera, a noise meter and the Peek Check banner.',
        penalty: 'Missing a Peek Check or making noise for over a second flashes your light and alerts the Seeker.',
        summary: 'Hide and film. Their phones beep on pings and snitch on noise.',
      },
    },
  },
  sardines: {
    setup: ['Agree the boundaries.', 'The Sardine hides while everyone else closes their eyes for 45 s.', 'Volume up — laughing gets snitched.'],
    roles: {
      sardine: {
        irl: 'Hide somewhere with room for others. Film the hunters as they squeeze in.',
        controls: 'Camera with a noise meter.',
        penalty: 'Noise above the line for over a second chirps and flashes your light.',
        summary: 'Hides first; everyone else must find them and squeeze in silently.',
      },
      hunter: {
        irl: 'Eyes closed for 45 s, then search alone. Found the Sardine? Squeeze in without a sound.',
        controls: 'Camera with a noise meter and “I found them” once you’re in the spot.',
        penalty: 'The last hunter still searching loses 50 XP.',
        summary: 'Search alone and join the Sardine’s hiding spot.',
      },
    },
  },
  floor_lava: {
    setup: ['Scatter safe spots: chairs, cushions, benches, steps.', 'Walk around between calls — no camping on a chair.', 'Volume up — the siren is your warning.'],
    roles: {
      player: {
        irl: 'When the countdown hits zero, get both feet off the floor.',
        controls: 'Camera. At zero, point it down at your feet — the phone checks the angle and takes a proof photo. No motion sensor? Tap “I’m safe”.',
        penalty: 'Feet on the floor (or no proof) at zero = burned, −50 XP.',
        summary: 'Everyone plays the same: feet up at zero, camera pointing down as proof.',
      },
    },
  },
  zombie_tag: {
    setup: ['Agree the boundaries.', 'Patient Zero starts in the middle; survivors scatter during the countdown.', 'Volume up.'],
    roles: {
      zombie: {
        irl: 'Chase and tag survivors by touch.',
        controls: 'Camera with your flashlight strobing as a zombie beacon.',
        penalty: 'None — but the beacon gives you away.',
        summary: 'Zombies strobe their flashlight and tag survivors by touch.',
      },
      survivor: {
        irl: 'Run, hide and keep filming. If a zombie tags you, own up.',
        controls: 'Camera and “I got tagged” — then you join the horde.',
        penalty: null,
        summary: 'Survivors film and run; anyone tagged joins the horde.',
      },
    },
  },
  marco_polo: {
    setup: ['Clear an indoor space; Marco stands in the middle with eyes closed.', 'Polos: volume to 100%.', 'Nobody leaves the room.'],
    roles: {
      marco: {
        irl: 'Eyes shut. Call MARCO, listen for every Polo, tag by touch.',
        controls: 'One big MARCO button (20 s cooldown) and “I tagged someone”.',
        penalty: 'Opening your eyes is cheating — the polos are filming.',
        summary: 'Eyes closed. Every MARCO makes all polo phones shout “Polo!” and flash.',
      },
      polo: {
        irl: 'Film Marco from your spot. Move between calls; freeze when your phone answers.',
        controls: 'Camera. Your phone answers every MARCO out loud and flashes on its own.',
        penalty: null,
        summary: 'Their phones answer each MARCO with a loud “Polo!” and a flash.',
      },
    },
  },

  /* --------------------------- Halloween Rituals --------------------------- */
  midnight_man: {
    setup: [
      'Turn off every light in the house (or head to a dark outdoor spot).',
      'Survivors: phone volume to 100%. The app controls your flashlight — that is your candle.',
      'The Midnight Man waits in the hallway with eyes closed through a 10-second head start.',
      'Clear anything you could trip over. Nobody turns a light on until 3:33 AM.',
    ],
    roles: {
      midnight: {
        irl: 'Hunt the candles in the dark and catch survivors by touch. Exposed phones shriek where they are.',
        controls: '“Extinguish candle” (25 s cooldown) blows out a random candle — or pick one by name. “I caught someone” when you touch a survivor.',
        penalty: 'Turning on the room lights breaks the ritual. Don’t.',
        summary: 'Every 25 s they can blow out a survivor’s flashlight with a whisper in their speaker, then catch them by touch.',
      },
      candle: {
        irl: 'Keep filming and keep your candle lit. Move quietly — he hunts by light and sound.',
        controls: 'Your flashlight is locked ON. If it goes out, 5 matches appear: tap them in order within 10 s to relight. “He got me” if you’re caught.',
        penalty: 'Miss the 10 seconds and your phone shrieks and strobes until you relight (−50 XP).',
        summary: 'Survivors carry a candle (their flashlight). Fail to relight it within 10 s and their phone shrieks.',
      },
    },
  },
  weeping_statue: {
    setup: [
      'Find a dark hallway, room or park path and kill the lights.',
      'Survivors stand at one end facing the dark, phones out.',
      'The Statue starts at the far end and puts their phone in a pocket.',
      'Volume to 100% — a heavy shutter click marks every switch between light and dark.',
    ],
    roles: {
      statue: {
        irl: 'Move only during the 5 s blackouts. Freeze in a creepy pose the instant the light returns. Tag survivors by touch.',
        controls:
          'Your screen shows MOVE or FREEZE with a countdown and buzzes on every switch. Keep the phone in your pocket — its motion sensor is watching. “I tagged someone” to log a catch.',
        penalty: 'Moving in the light (after a 0.5 s grace) costs 50 XP and tells every survivor.',
        summary: 'Can only move during the blackouts. Its own phone snitches if it moves in the light.',
      },
      watcher: {
        irl: 'Film the dark ahead and never look away. Each time the light comes on, find the Statue.',
        controls: 'No flashlight button: every phone runs 3 s light / 5 s total blackout in sync, with a shutter click. “It got me” if you’re tagged.',
        penalty: null,
        summary: 'Survivors film the dark; every phone flashes 3 s on, 5 s off, all in sync.',
      },
    },
  },
  daruma: {
    setup: [
      'Plan a route through 2–3 rooms or a dark path. Lights low.',
      'Walkers face forward and never turn their heads — that’s the curse.',
      'The Shadow starts about 10 metres behind the walkers.',
      'Volume up so everyone hears “TOMARE!”.',
    ],
    roles: {
      shadow: {
        irl: 'Creep up behind the walkers silently and tag them by touch. When anyone calls TOMARE, freeze where you stand.',
        controls: 'A dark screen with your status. On TOMARE it shouts and shows a 5 s FREEZE. “I caught someone” logs a catch (locked while frozen).',
        penalty: 'Moving while frozen breaks the ritual — the walkers’ selfie cameras are recording you.',
        summary: 'Stalks from behind. Every TOMARE freezes it for 5 seconds.',
      },
      walker: {
        irl: 'Walk to your 3 checkpoints filming your own face. Never turn around — watch the background of your selfie.',
        controls: 'Selfie camera (locked) with a soft glow, your checkpoints to tick off, and “TOMARE! (FREEZE SHADOW)” when it’s within 2 m (3 uses, 12 s cooldown).',
        penalty: 'Turning your head is cheating and it’s on your own recording. Caught = −50 XP.',
        summary: 'Walkers film their own faces, spot the Shadow behind them and call TOMARE to freeze it.',
      },
    },
  },
  dead_silence: {
    setup: [
      'Blindfold the Hunter and seat them in the centre of the room.',
      'Dim the lights.',
      'Survivors start against the walls with phones recording.',
      'Total silence from the moment the countdown ends.',
    ],
    roles: {
      hunter: {
        irl: 'Stay blindfolded. Listen for footsteps, breathing and chimes, then lunge and grab.',
        controls: 'Your screen pulses on every noise a survivor makes — the chime itself plays from their phone. Caught survivors log themselves.',
        penalty: 'Lifting the blindfold forfeits your catches.',
        summary: 'Blindfolded in the centre, hunting by sound. Every noise chimes from the guilty phone.',
      },
      mouse: {
        irl: 'Finish your 3 noisy tasks while filming — without a sound.',
        controls: 'An ultra-sensitive mic meter (whisper threshold) and your 3 tasks to tick off. “The hunter got me” if you’re grabbed.',
        penalty: 'Any sound over the line plays a music-box chime and flashes your light for 0.5 s (−25 XP).',
        summary: 'Survivors do noisy tasks in silence; their mics chime and flash on the faintest sound.',
      },
    },
  },
  doppelganger: {
    setup: [
      'Split into pairs and explore rooms or zones with flashlights on (the app lights them).',
      'Stay close to your partner — being alone in a blackout is how you get taken.',
      'Every 60 s the power dies for 10 s: stop where you are until it comes back.',
    ],
    roles: {
      explorer: {
        irl: 'Explore with your partner and watch who keeps wandering off.',
        controls: 'Camera with the flashlight locked on; everything goes black in a blackout. “Accuse” votes someone out — a majority unmasks or banishes them.',
        penalty: 'Vote out an innocent and they’re banished from the round.',
        summary: 'Explorers stick together and vote out whoever they suspect.',
      },
      doppelganger: {
        hidden: true,
        irl: 'Act exactly like an explorer. During a blackout, claim the player standing next to you.',
        controls: 'The same screen as everyone, plus “CLAIM VICTIM” during blackouts (one per blackout).',
        penalty: 'A majority vote against you ends the round for you.',
        summary: 'One explorer is secretly the Doppelgänger, claiming victims during blackouts.',
      },
    },
  },
};
