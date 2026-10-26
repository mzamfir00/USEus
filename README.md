# USEus

An IRL party game where every player uses their own phone. Spin a mission, get your role, film the chaos.

**Live:** https://mzamfir00.github.io/USEus/ · **Android app:** https://github.com/mzamfir00/USEus/releases/latest/download/USEus-release.apk

## Features

- **Accounts:** sign up with a phone number (with country code) or an email, plus a PIN or password and a date of birth (16+ only). Phone, email and @username must be unique. Accounts are stored on the device (IndexedDB + LocalStorage on the web, AsyncStorage in the phone apps) and mirrored to Supabase until the owner deletes them.
- **Tabs:**
  - **Play:** create a room, or join by code or QR.
  - **Squad:** find and add friends.
  - **History:** past rounds, with location and result.
  - **Profile:** stats, Room Aesthetics, sound, cloud database and sign out.
- **Host setup:**
  - **Arena:** Indoor, Park, Forest, Supermarket / Mall, City Streets or Roadtrip.
  - **Exact location:** typed, or filled in with one tap from GPS. It's stamped on the camera video and saved in the match history.
  - **Game choice:** **Random roulette** (a synced monochrome wheel over the games that fit the arena) or **Choose game**, with an optional pick of who starts. A pack filter switches between all games and the seasonal Halloween Horror Pack.
- **Mission Briefing & ready-up gate (every game):** after the wheel or the host's pick, every phone shows a briefing before any timer or camera starts:
  - **Physical setup:** step-by-step instructions for preparing the room or space right now.
  - **Your role & phone controls:** three personal bullets covering what to do in real life, which buttons your screen shows, and what gets you penalised.
  - **How the other roles work:** a summary of the other side's abilities. Secret roles stay hidden.

  A live "READY: 3/4 PLAYERS" counter tracks "I UNDERSTAND THE RULES — READY" taps. The countdown starts when every connected player is ready, or when the host taps Force start. During play, a "?" button reopens your briefing without pausing the camera or triggering the Snitch Protocol.
- **Six party games**, with every phone as a controller:
  - **Blind Sonar:** the blind hunter's phone is one giant tap target. Each pulse (12 s cooldown) counts down 3-2-1 and then makes every survivor's phone beep loudly while they film. Survivors can claim a Near miss.
  - **Paparazzi Sniper:** each player has a private target in a circular chain. A sniper viewfinder takes stamped photos, and the squad votes on each shot: clean hit or spotted.
  - **Blind Teleprompter:** a time-synced script on the actor's phone, mirrored on the director's camera. Saboteurs inject live stage directions.
  - **Red Light Freeze Cam:** the watcher gets a giant toggle. On red, runners' phones play a siren and flash, then watch the motion sensor. Without a sensor, players must hold a button.
  - **Timebomb Hot Potato:** an accelerating tick plays on the holder's phone. They do a 5-second dare, then pass the bomb to a named player. The fuse is hidden.
  - **Undercover Saboteur:** everyone films a shared challenge. The saboteur alone gets 3 covert tasks, then every phone votes.
- **Five childhood classics:**
  - **Hide & Seek: Snitch Cam:** the seeker counts down 30 s, then hunts with a camera, flashlight, flash pulse and 3 sound pings. Hiders face a 10-second peek check every 45 s.
  - **Sardines:** hiders silently squeeze in with the first hider; the last one still searching loses.
  - **The Floor Is Lava:** random 5-second siren countdowns. Phones judge camera-down orientation (or a tap fallback) and take proof photos.
  - **Infected Zombie Tag:** the zombie's flashlight strobes as a beacon, and tagged survivors join the horde.
  - **Marco Polo: Flash Edition:** "MARCO!" with a 20 s cooldown makes every hider's phone say "Polo!" and flash.
- **Halloween Rituals (limited time, Oct 1 – Nov 7):** five urban-legend games with noir / analog-horror styling (VHS scanlines, grain, flicker):
  - **The Midnight Man:** survivors' flashlights are their candles. The Midnight Man can blow one out every 25 s, with a whisper through that phone's speaker. The survivor then has 10 s to relight by tapping 5 matches in order; failing that, the phone shrieks and strobes until relit.
  - **Don't Blink: The Weeping Statue:** every phone runs 3 s of flashlight, then 5 s of total blackout, in sync with a shutter clunk. The Statue's own motion sensor snitches if it moves in the light.
  - **Daruma-san:** walkers are locked to the selfie camera with a soft glow and must hit 3 checkpoints without turning around. "TOMARE! (FREEZE SHADOW)" freezes the Shadow for 5 s and saves a proof selfie.
  - **Dead Silence:** a blindfolded hunter sits in the centre while survivors do 3 noisy tasks. An ultra-sensitive whisper-threshold mic plays a music-box chime and a 0.5 s flash on any sound.
  - **The Doppelgänger:** one secret impostor. Every 60 s a 10 s power outage kills every flashlight and screen, and only then can the Doppelgänger claim the player beside them. A live majority vote unmasks them, or banishes an innocent.
- **Snitch Protocol (mandatory filming):** every filming role auto-records. Any of these sets off a continuous siren (it ignores the mute toggle), a 250 ms torch strobe and a white/black screen strobe, and alerts the room with "@user STOPPED FILMING":
  - stopping the recording or losing the camera;
  - leaving the app;
  - a covered lens with a motionless phone for 8 s, after a 3-2-1 warning;
  - a missed peek check.

  It stops only when filming resumes. Each violation costs 50 XP.
- **GPS Playzone** (Park, Forest, Mall, City Streets): a live boundary built on `navigator.geolocation.watchPosition` and Haversine distances in metres, drawn on a Leaflet map with CartoDB Dark Matter tiles (OpenStreetMap data, no API key).
  - **Setup:** the host locks the arena center with one tap and picks a radius: 30 m Compact, 75 m Mall / Plaza, 150 m Park / Forest or 300 m Urban Sector. Two optional switches:
    - **Shrinking battle-royale ring:** −20% every 45 s in the final 3 minutes.
    - **Simulated GPS:** for indoor testing, phones move with an on-screen pad.
  - **Out of bounds:** leaving the zone (with a 5 m jitter buffer) starts a full-screen 10-second countdown, with a compass arrow and the distance back to the zone. At zero the phone plays a siren with a flashlight + screen strobe, costs 200 XP, and streams its live pin to the other side's map until it's back inside.
  - **Hunts** (Hide & Seek, Sardines, Infected):
    - **Radar ping:** each hunter gets 2 pings at −150 XP each. A ping shows the remaining hiders on the tactical map for exactly 3 s and alerts every hider.
    - **Decoy:** each hider can drop 1 decoy, which puts a fake blip 35 m away on the hunters' next radar.
    - **Heartbeat:** an ECG appears on the hider's HUD when a hunter is within 20 m, and speeds up at 10 m and 5 m.
    - **Supply drop:** lands mid-round. The first hider within 8 m gets +300 XP and Ghost Immunity, which hides them from the next radar ping.
  - **Results:** a replay map with the zone, everyone's movement trails, radar ping spots and penalties.
- **Camera tools:** flashlight toggle (hardware torch, or a front screen light as fallback), flash pulse for hunters, a mid-round flip that never counts as a violation, and a live noise meter. In stealth games, noise above the threshold for over a second flashes the hider's light, chirps, and alerts the seekers.
- **Real video:** a canvas compositor (grayscale camera plus a REC / game / location / room stamp) records through `MediaRecorder`. Clips can be replayed, saved or shared from the results screen.
- **Room DNA:** finished rounds level a room up toward the style of its most-played arena, and unlock that style for each player's profile.

## App Store / Google Play compliance

- **In-app account deletion** (Apple 5.1.1, Google Play): Profile → **Delete Account Permanently**, confirmed by typing DELETE. The owner-verified `delete_account()` RPC erases the cloud account, friendships, hosted rooms and their logs, the username in other rooms' scores and logs, and the user's reports. Every local copy (LocalStorage + IndexedDB on the web, the app's storage on phones) is wiped too. If the phone is offline, the cloud deletion retries the next time the app opens online.
- **IRL safety warning:** shown on first launch, and again in the briefing before every outdoor or dark round, with an "I Understand & Agree" button.
- **Moderation** (Apple 1.2):
  - Hosts can remove a player from the lobby or the in-game menu; removed players can't rejoin that room.
  - Every player can **Block** someone (hidden on this phone: name, photos, search and friends) or **Report** them. Reports are logged locally and in the write-only `reports` table.
  - The Terms promise review of reports within 24 hours.
- **Privacy Policy & Terms of Use (16+):** in-app documents on the sign-up screen and in Profile. They cover how the camera, microphone (noise meter), GPS location (playzone), motion sensors and account data are used and deleted. The same pages are public, for store listings:
  - `https://mzamfir00.github.io/USEus/?legal=privacy`
  - `https://mzamfir00.github.io/USEus/?legal=terms`

  Set `VITE_SUPPORT_EMAIL` at build time to show a contact address.

## Native phone apps (React Native + Expo SDK 52)

The Android and iOS apps are a true native React Native app in [`mobile/`](mobile) — native views (`View`, `Text`, `Modal`, `FlatList`…), no WebView. They run the same game engine as the web app (`src/game/*`, `src/lib/geo.js`, `src/legal/*` are shared through Metro) and speak the same Supabase Realtime room protocol, so phones and browsers can play in one room.

- **App:** `com.useus.game` (Android package and iOS bundle id), portrait, dark, new architecture.
- **Native modules:**
  - **Camera** (`expo-camera` `CameraView`): live viewfinder, `recordAsync` clips, `enableTorch` for the flashlight, strobes and candles, QR scanning in Play.
  - **Haptics** (`expo-haptics`): roulette ticks, a heartbeat that speeds up as the hunter closes in, sonar pulses, out-of-bounds warnings.
  - **Keep awake** (`expo-keep-awake`): the screen stays on in lobbies and rounds.
  - **Audio** (`expo-av`): the sound effects (WAVs rendered offline from the web synth by `mobile/scripts/make-sounds.py`), clip playback, and `Audio.Recording` metering for the noise snitch.
  - **Clips:** saved to the photo library (`expo-media-library`) or shared to TikTok / Reels / WhatsApp (`expo-sharing`).
  - **GPS Playzone:** `expo-location` `watchPositionAsync` with `Accuracy.BestForNavigation`, a compass from `watchHeadingAsync`, place names from the phone's geocoder. The tactical map is drawn natively: CARTO Dark Matter tiles plus SVG overlays.
  - **Motion** (`expo-sensors`): Red Light, the Weeping Statue, Floor Is Lava and peek checks.
  - **Login:** AsyncStorage keeps the session and history on the phone; Supabase syncs accounts.
- **Native differences:**
  - Video is recorded in colour, and the REC / location stamp is an on-screen overlay rather than burned into the clip.
  - Android detects a covered phone with the ambient light sensor plus stillness; iOS has no light-sensor API, so it relies on the other Snitch checks.
  - Clips record with sound (720p at about 4 Mbps; a new clip starts every 10 minutes). The exception is while the noise snitch is listening, because the meter needs the microphone.
  - Rooms survive network changes. Moving from Wi-Fi to 4G/5G (or coming back from the background) rebuilds the realtime channels, and the host restores your role, score and timer.
  - During a room, Android's back button or swipe-back asks "Abandon current round?" instead of leaving.
  - Temporary clips and photos from earlier rounds are deleted from the cache when a new round starts and when the app opens.
  - If a screen fails, an error screen offers "Reconnect / Recover round" instead of crashing.
  - On Android, a proof photo taken during recording (Floor Is Lava) briefly splits the clip. TOMARE skips the selfie there rather than delay the freeze.
- **Permissions:** Android asks for CAMERA, RECORD_AUDIO, location, VIBRATE and WAKE_LOCK, and blocks the READ_MEDIA_* permissions (saving to the gallery doesn't need them). On iOS, `app.json` carries the camera, microphone, location, motion and photo-library-add usage strings, plus `ITSAppUsesNonExemptEncryption = false`.
- **Icons:** `mobile/assets/source/icon.svg` is the source for the app icon, adaptive icon, splash screen and the web icons in `public/`.

```bash
cd mobile
npm install
npm run check          # lint + compile the Android JS bundle
npx expo run:android   # build and run on a device or emulator (needs the Android SDK)
npx expo run:ios       # macOS + Xcode
```

**Android CI:** `.github/workflows/build-native-android.yml` runs on every push to `main`, or manually from the Actions tab.
- Steps: Node 20, JDK 17 (Temurin) and the Android SDK, then `npm install`, lint and an Android bundle check, `npx expo prebuild --platform android --clean`, and `./gradlew assembleRelease bundleRelease`.
- Outputs: the **USEus-release-apk** and **USEus-release-aab** artifacts.
- Launch test: the APK is installed on an Android 14 emulator. The test checks that it starts without crashing, shows the safety warning, reaches the sign-up screen and opens the Privacy Policy. Screenshots and logcat are kept as the **USEus-launch-test** artifact.
- Release: only after the launch test passes is the APK published on a GitHub Release. The newest one is always at `https://github.com/mzamfir00/USEus/releases/latest/download/USEus-release.apk`.
- Version: `1.0.<run number>`, and the versionCode follows the run number.
- **Signing:** add the repository secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 your.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` to sign every build with your key, which Google Play requires. Without them, each run signs with a fresh key generated just for that build. The key is never stored or uploaded, so to update an installed copy you have to uninstall it first.

## Cloud database (optional)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql). **Re-run it after updating the app.** It's idempotent, and it adds the `delete_account()` RPC and the `reports` table that in-app deletion and reporting need. It creates `accounts`, `friendships`, `rooms`, `mission_logs` and `reports`, along with row-level security, the login/search/delete functions, and the owner-only-delete and 16+ triggers.
2. Add the repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The Pages workflow passes them to the build. Alternatively, connect from **Profile → Cloud database** on a single device.

With the cloud database, players can log in on any device with their phone or email + PIN, and find each other by phone or email. Without it, accounts live permanently on the device where they were created.

## Architecture

```
src/
  App.jsx               auth gate, tab shell, room routing, theme classes
  lib/database.js       accounts / friends / rooms / logs: Supabase + IndexedDB + LocalStorage
  lib/net.js            room transport: PeerJS (WebRTC) + Supabase Realtime
  lib/sound.js          Web Audio synth
  hooks/useRoom.js      host loop (authoritative state) + client loop (reconnects)
  game/engine.js        host-authoritative rules for every game + the GPS Playzone, scoring, Room DNA, per-phone views
  game/games.js         arenas, game definitions, scripts, dares, covert tasks, XP table
  game/missions.js      challenges used by Undercover Saboteur
  game/briefings.js     Mission Briefing content: setup steps, per-role controls and penalties
  lib/clips.js          recorded clips (replay / save / share)
  lib/motion.js         shared motion + orientation + compass feed (iOS permission flow)
  lib/platform.js       public web address for invite links
  lib/geo.js            Haversine / bearing / destination maths, zone radius + shrinking ring
  ui/game/zone/*        GPS Playzone HUD, out-of-bounds penalty, radar, decoy, heartbeat, Leaflet map
  ui/game/Briefing.jsx  ready-up gate + the in-game "?" rules drawer
  ui/game/Rituals.jsx   Halloween Rituals screens (+ HorrorFx analog-horror overlay)
  ui/game/*             interactive role screens, roulette wheel, camera recorder
  ui/Auth.jsx, ui/tabs/*, ui/room/*, ui/primitives.jsx
  ui/Legal.jsx          Privacy Policy + Terms of Use (in-app and ?legal=…)
  ui/Safety.jsx         IRL safety warning gate
  ui/Moderation.jsx     block / report / remove player sheets
  styles/theme.css      #000 / #FFF / #141414 / #262626 design system + DNA mutations
  legal/content.js      Privacy Policy + Terms text (web and native variants)
  game/brief.js         per-role briefing builder shared by web and native

mobile/                 React Native app (Expo SDK 52), reuses src/game, src/lib/geo.js, src/legal
  App.js                fonts, storage hydrate, auth gate, bottom tabs, safety gate, deep links
  src/core.js           re-exports the shared engine
  src/lib/*             AsyncStorage database, Supabase transport, sounds + haptics, motion, clips
  src/hooks/useRoom.js  host / client loops (same protocol as the web app)
  src/theme/            monochrome tokens, fonts, Room DNA styles
  src/ui/*              native screens: auth, tabs, room, lobby, results, every game, GPS Playzone
  plugins/              config plugin that signs release builds from CI secrets
```

## Develop

```bash
npm install
npm run dev
npm run build
```

Every push to `main` deploys the web app to GitHub Pages (`.github/workflows/deploy.yml`) and builds the Android app (`.github/workflows/build-native-android.yml`).
