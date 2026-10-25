// Mission database: 4 vibes × 4 missions.
// {Player1} = Main Character · {Player2} = Director · {Player3} = Cameraman · {Pack} = Creator Pack name.

export const MISSIONS = [
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

export const PENALTY_DARES = [
  '{name} must perform a 15-second interpretive dance titled "My Shame" — right now, on camera.',
  '{name} can only speak in a movie-trailer voice until the next mission ends.',
  '{name} owes every squad member a compliment delivered as a Shakespearean monologue.',
  '{name} must narrate the next 2 minutes of their life like a nature documentary.',
  '{name} must do 10 dramatic slow-motion squats while the squad hums an epic soundtrack.',
  '{name} sets their phone wallpaper to a squad-chosen photo until midnight.',
];
