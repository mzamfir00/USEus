# USEus

An IRL party game where every player uses their own phone. Spin a mission, get your role, film the chaos.

**Live:** https://mzamfir00.github.io/USEus/

## Features

- **Accounts:** sign up with a phone number (with country code) or an email, plus a PIN or password. A date of birth is required, and anyone under 16 is blocked. Phone, email and @username must each be unique.
- **Permanent storage:** accounts, friends, rooms and mission logs are mirrored to IndexedDB and LocalStorage, plus Supabase Postgres when it's configured. Signing out never deletes anything, and the cloud schema blocks deletes outright.
- **Four tabs:**
  - **Play:** create a room, or join with a 4-digit code or by scanning its QR code.
  - **Squad:** search by @username, phone or email, and add friends.
  - **History:** past missions and Room DNA badges.
  - **Profile:** stats, Room Aesthetic selector, sound, cloud database and sign out.
- **Multi-phone rooms:** the host's phone runs the game. Each phone receives only its own view: its role and mission, a secret directive (on the saboteur's phone only; everyone else sees a locked indicator) and the squad's public assignments. The timer is synced across phones, and a fullscreen timer + camera overlay shows the mission watermark.
- **Room DNA:** completed missions level a room up (1–3) toward the style of its most-played vibe:
  - **Auteur Studio:** Supermarket and Creator pack.
  - **Classified Dossier:** City streets.
  - **Kinetic Brutalism:** Roadtrip.

  Playing in an evolved room unlocks that style as your personal Room Aesthetic.

## Cloud database (optional)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql). It creates `accounts`, `friendships`, `rooms` and `mission_logs`, along with row-level security, the login/search functions and the no-delete and 16+ triggers.
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
  game/engine.js        pure rules, Room DNA, per-phone filtered views
  game/missions.js      16 missions (4 per vibe)
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
