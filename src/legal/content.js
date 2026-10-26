// Privacy Policy and Terms of Use text, shared by the web app (src/ui/Legal.jsx) and the
// native app (mobile/). Platform differences (storage, transport, geocoding) are spelled out
// so each build describes exactly what it does.

export const LEGAL_UPDATED = 'October 26, 2026';

export function legalDocuments({ supportEmail = null, native = false } = {}) {
  const contact = supportEmail ? `email ${supportEmail}` : 'use the support contact listed on the USEus store page';

  const PRIVACY = {
    title: 'Privacy Policy',
    intro: native
      ? 'USEus is an in-person party game: every player uses their own phone as a controller and camera. This policy explains what the app collects, why, who can see it, and how to delete it. The phone apps show ads from Google AdMob (never during play) and sell optional passes through Google Play and the App Store. USEus has no analytics SDKs and never sells personal data.'
      : 'USEus is an in-person party game: every player uses their own phone as a controller and camera. This policy explains what the app collects, why, who can see it, and how to delete it. USEus has no ads, no analytics or tracking SDKs, and never sells personal data.',
    sections: [
      {
        h: 'Your account',
        p: [
          'When you sign up we store your name, @username, phone number or email, date of birth, and a one-way SHA-256 hash of your PIN or password (never the PIN itself). We also keep your XP, match history, friends list and unlocked room styles.',
          'Your date of birth is only used to confirm you are 16 or older. Other players can see your name, @username, stats and room style. They can never see your phone number, email, date of birth or PIN hash.',
        ],
      },
      {
        h: 'Camera',
        p: [
          'The camera shows your viewfinder and records clips during a round. Clips stay on your phone and are never uploaded to our servers. You decide whether to save or share them.',
          native
            ? 'Game photos (Paparazzi shots, Floor Is Lava proofs, TOMARE selfies) go straight to the other phones in your room during that round and are discarded when the room closes.'
            : 'Game photos (Paparazzi shots, Floor Is Lava proofs, TOMARE selfies) go straight to the other phones in your room during that round and are discarded when the room closes. Your phone also measures brightness and movement in the picture to detect a covered lens or a camera pan; this is analysed on your phone only.',
          'The flashlight is switched on and off by some games (candles, strobes, blackouts).',
        ],
      },
      {
        h: 'Microphone',
        p: [
          'In stealth games the noise meter measures how loud it is on your phone and only reports “noise” or “no noise” to the room. No audio is recorded or sent anywhere. If you turn on “Record sound” for a clip, the audio stays inside that clip on your phone.',
        ],
      },
      {
        h: 'Location',
        p: [
          'Location is only used when the host turns on the GPS Playzone or taps “Use my location” in the lobby.',
          'During a Playzone round your position goes to the host’s phone to check the boundary. It is shown to the other team only if you leave the zone or a radar ping exposes you. Everyone’s movement trail appears on that round’s results screen and is then discarded. Positions are never stored on our servers.',
          native
            ? '“Use my location” asks your phone’s built-in geocoder (Apple or Google) for a place name. Map backgrounds are CARTO tiles of OpenStreetMap data.'
            : '“Use my location” sends the coordinates to OpenStreetMap Nominatim to look up a place name. Maps are drawn with CARTO map tiles.',
        ],
      },
      {
        h: 'Motion sensors',
        p: ['Accelerometer, gyroscope and compass readings are used on your phone only (Red Light, the Weeping Statue, Floor Is Lava, the Playzone compass).'],
      },
      ...(native
        ? [
            {
              h: 'Ads (Google AdMob)',
              p: [
                'The app shows rewarded videos you choose to watch (to unlock a game for one match, a pre-round boost or bonus XP) and an occasional ad between rounds. Ads never appear during a countdown or live play. Rooms hosted with a Pro Pass are ad-free.',
                'To show and measure ads, Google may use your device’s advertising ID, IP address, device and app information, and how you interact with ads. In the EEA, the UK and some US states, Google’s consent form asks before ads are personalised; Profile → Ad privacy choices changes your answer. Google’s use of data is described at policies.google.com/technologies/ads.',
              ],
            },
            {
              h: 'Purchases (RevenueCat)',
              p: [
                'Passes are bought through Google Play or the App Store; we never see your payment details. RevenueCat processes the purchase records, linked to your USEus account ID, so a pass bought on one phone can be restored on another. Your profile stores which pass you have and when a Weekend Pass ends.',
              ],
            },
          ]
        : []),
      {
        h: 'Rooms, matches and reports',
        p: [
          'Rooms store a code, the room’s style, and scores by @username. Match logs store the game, the location name the host typed, the result and the players’ usernames.',
          'If you report a player we store your username, theirs, the reason and your optional details so we can moderate. Players you block are hidden on your phone only.',
        ],
      },
      {
        h: 'Where data is stored',
        p: [
          `Everything is saved on your phone (${native ? 'the app’s private storage' : 'LocalStorage and IndexedDB'}). When the cloud database is enabled, accounts, friendships, rooms, match logs and reports are also stored in a Supabase database so you can log in on any device.`,
          native
            ? 'Live game messages travel between the phones in your room through Supabase Realtime. They are not stored.'
            : 'Live game messages travel phone-to-phone (WebRTC, connected through a PeerJS signalling server) or through Supabase Realtime. They are not stored.',
        ],
      },
      {
        h: 'Deleting your data',
        p: [
          'Profile → Delete Account Permanently erases your account, friendships, the rooms you hosted and their match logs, your username from other rooms’ scores and logs, and your reports. It does this in the cloud and on your phone, immediately. If your phone is offline, the cloud copy is erased the next time the app opens online.',
          native
            ? 'Clips are kept in the app’s temporary cache and are cleared by your phone unless you save them to your photo library.'
            : 'Clips live in memory and disappear when you close the app unless you saved them.',
        ],
      },
      {
        h: 'Children',
        p: ['USEus is for people aged 16 and over. Sign-up is blocked for younger dates of birth. Please report any player you believe is under 16.'],
      },
      {
        h: 'Your rights',
        p: [`You can access, correct, export or delete your data at any time. Delete it in the app, or ${contact} for anything else. We reply within 30 days.`],
      },
      {
        h: 'Changes',
        p: ['If this policy changes we will update the date at the top and show the new version in the app.'],
      },
    ],
  };

  const TERMS = {
    title: 'Terms of Use (16+)',
    intro: 'By creating an account or playing USEus you agree to these terms. Please read them — especially the safety rules.',
    sections: [
      { h: 'Age', p: ['You must be at least 16 years old to create an account or play.'] },
      {
        h: 'Play safely — you are responsible for yourself',
        p: [
          'USEus is played in the real world, often moving, in the dark or with eyes closed. Always stay aware of your surroundings. Do not trespass, do not run near traffic, water, stairs or drops, and obey all local laws and the rules of any venue.',
          'Never play while driving: in the Roadtrip arena only passengers play. Stop immediately if anyone is uncomfortable or at risk. You play at your own risk.',
        ],
      },
      {
        h: 'Consent and recording',
        p: [
          'Only film, photograph or track people who have agreed to play. Do not record bystanders or use the games to follow, harass or photograph anyone who is not playing. Respect privacy and recording laws where you play.',
        ],
      },
      {
        h: 'Community rules',
        p: [
          'No harassment, hate, threats, sexual content, nudity or content involving minors, and no cheating that ruins the game for others. Hosts can remove players from their room. Every player can block or report anyone.',
          'We review reports within 24 hours and remove content or accounts that break these rules.',
        ],
      },
      {
        h: 'Your content',
        p: ['Clips and photos you record are yours. You are responsible for what you save and share, including on other platforms.'],
      },
      {
        h: 'Your account',
        p: ['Keep your PIN private. You can delete your account at any time from Profile → Delete Account Permanently. We may suspend accounts that break these terms.'],
      },
      ...(native
        ? [
            {
              h: 'Purchases',
              p: [
                'Passes are one-time purchases through Google Play or the App Store; nothing renews. The Weekend Pass lasts 48 hours from purchase. Pro Host Lifetime lasts as long as USEus offers the app. Radar Pack pings are used up as you play. Pro unlocks games for rooms you host; it has no cash value and can’t be transferred.',
                'Refunds follow Google Play’s and Apple’s policies. Use Restore Purchases in the store or in Profile to bring passes back on a new phone signed in to the same USEus account.',
              ],
            },
          ]
        : []),
      {
        h: 'No warranty',
        p: [
          'USEus is provided “as is”. Games depend on your phone’s camera, sensors, GPS and network, which can be inaccurate or unavailable. To the extent the law allows, we are not liable for injury, loss or damage arising from playing.',
        ],
      },
      { h: 'Contact', p: [`For questions about these terms, ${contact}.`] },
    ],
  };

  return { privacy: PRIVACY, terms: TERMS };
}
