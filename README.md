# USEus

An IRL party game where every player uses their own phone. Spin a mission, get your role, film the chaos.

**Live:** https://mzamfir00.github.io/USEus/

## Features

- **Accounts:** sign up with a phone number (with country code) or an email, plus a PIN or password and a date of birth (16+ only). Phone, email and @username must be unique. Storage is permanent: IndexedDB + LocalStorage, mirrored to Supabase.
- **Tabs:**
  - **Play:** create a room, or join by code or QR.
  - **Squad:** find and add friends.
  - **History:** past rounds, with location and result.
  - **Profile:** stats, Room Aesthetics, sound, cloud database and sign out.
- **Host setup:**
  - **Arena:** Indoor, Park, Supermarket, City Streets or Roadtrip.
  - **Exact location:** typed, or filled in with one tap from GPS. It's stamped on the camera video and saved in the match history.
  - **Game choice:** **Random roulette** (a synced monochrome wheel over the games that fit the arena) or **Choose game**, with an optional pick of who starts.
- **Six party games**, with every phone as a controller:
  - **Blind Sonar:** the blind hunter's phone is one giant tap target. Each pulse (12 s cooldown) counts down 3-2-1 and then makes every survivor's phone beep loudly while they film. Survivors can claim a Near miss.
  - **Paparazzi Sniper:** each player has a private target in a circular chain. A sniper viewfinder takes stamped photos, and the squad votes on each shot: clean hit or spotted.
  - **Blind Teleprompter:** a time-synced script on the actor's phone, mirrored on the director's camera. Saboteurs inject live stage directions.
  - **Red Light Freeze Cam:** the watcher gets a giant toggle. On red, runners' phones play a siren and flash, then watch the motion sensor. Without a sensor, players must hold a button.
  - **Timebomb Hot Potato:** an accelerating tick plays on the holder's phone. They do a 5-second dare, then pass the bomb to a named player. The fuse is hidden.
  - **Undercover Saboteur:** everyone films a shared challenge. The saboteur alone gets 3 covert tasks, then every phone votes.
- **Five childhood classics:**
  - **Hide & Seek: Snitch Cam:** the seeker counts down 30 s, then hunts with a camera, flashlight, flash pulse and 3 radar pings. Hiders face a 10-second peek check every 45 s.
  - **Sardines:** hiders silently squeeze in with the first hider; the last one still searching loses.
  - **The Floor Is Lava:** random 5-second siren countdowns. Phones judge camera-down orientation (or a tap fallback) and take proof photos.
  - **Infected Zombie Tag:** the zombie's flashlight strobes as a beacon, and tagged survivors join the horde.
  - **Marco Polo: Flash Edition:** "MARCO!" with a 20 s cooldown makes every hider's phone say "Polo!" and flash.
- **Snitch Protocol (mandatory filming):** every filming role auto-records. Any of these sets off a continuous siren (it ignores the mute toggle), a 250 ms torch strobe and a white/black screen strobe, and alerts the room with "@user STOPPED FILMING":
  - stopping the recording or losing the camera;
  - leaving the app;
  - a covered lens with a motionless phone for 8 s, after a 3-2-1 warning;
  - a missed peek check.

  It stops only when filming resumes. Each violation costs 50 XP.
- **Camera tools:** flashlight toggle (hardware torch, or a front screen light as fallback), flash pulse for hunters, a mid-round flip that never counts as a violation, and a live noise meter. In stealth games, noise above the threshold for over a second flashes the hider's light, chirps, and alerts the seekers.
- **Real video:** a canvas compositor (grayscale camera plus a REC / game / location / room stamp) records through `MediaRecorder`. Clips can be replayed, saved or shared from the results screen.
- **Room DNA:** finished rounds level a room up toward the style of its most-played arena, and unlock that style for each player's profile.

## Cloud database (optional)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql). It's safe to re-run after updates: it also adds the `game` and `location` columns to `mission_logs`. It creates `accounts`, `friendships`, `rooms` and `mission_logs`, along with row-level security, the login/search functions and the no-delete and 16+ triggers.
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
  game/engine.js        host-authoritative rules for all six games, scoring, Room DNA, per-phone views
  game/games.js         arenas, game definitions, scripts, dares, covert tasks, XP table
  game/missions.js      challenges used by Undercover Saboteur
  lib/clips.js          recorded clips (replay / save / share)
  lib/motion.js         shared motion + orientation feed (iOS permission flow)
  ui/game/*             interactive role screens, roulette wheel, camera recorder
  ui/Auth.jsx, ui/tabs/*, ui/room/*, ui/primitives.jsx
  styles/theme.css      #000 / #FFF / #141414 / #262626 design system + DNA mutations
```

## Develop

```bash
npm install
npm run dev
npm run build
```

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
