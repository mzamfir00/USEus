# SQUAD ROULETTE

An IRL multiplayer party game where every player uses their own phone. Spin the wheel, get cast, film the chaos.

**Live:** https://mzamfir00.github.io/USEus/

## How a game works

1. **Accounts:** everyone signs up with a name, a unique @username, age (13+), a playstyle archetype and a 4-digit PIN.
2. **Host phone:** taps **Create room** and gets a 4-digit code plus a QR code that opens `…/USEus/?room=XXXX`.
3. **Friends' phones:** log in, tap **Join room** and enter the code, or scan the QR code. They show up in the host's lobby roster in real time.
4. **Spin:** the host spins and every phone plays the roulette at the same moment.
5. **Briefing:** each phone shows:
   - **My assignment:** that player's own role and instructions.
   - **🔒 Secret agenda:** only the saboteur's phone ever receives the secret. Everyone else sees *"1 player in this room has received a classified secret objective. Trust no one."*
   - **Squad public missions:** what everyone else is supposed to be doing.
6. **Play:** the mission timer is synced across phones. POV REC mode overlays the mission on the camera feed.
7. **Score:** the host scores the round. XP, completed missions, secret wins and squad history are saved to each player's account. Roles rotate every round.

**Solo testing:** the host can tap **+ Add simulated bot / pass-the-phone player** to fill a round from one phone.

## Adaptive Room DNA

Each room remembers the missions it has completed and which vibe the squad plays most, and the whole UI changes as it evolves. The **ROOM DNA / EVOLUTION LEVEL** meter in the header shows the current state.

| Level | Look |
| --- | --- |
| LV.0 | Clinical black and white wireframe |
| LV.1–3 | Gains the style of the squad's most-played vibe, more strongly at each level |

| Style | Vibes | Mutations |
| --- | --- | --- |
| **Auteur Studio** | Supermarket, Creator pack | 35mm film strips, viewfinder brackets, serif accents, ivory film grain |
| **Classified Dossier** | City streets | Radar grid, redaction bars, telemetry badges, topographic lines, radar sweep |
| **Kinetic Brutalism** | Roadtrip | Hazard stripes, hard drop shadows, stamp typography, diagonal motion |

Reopening a room from **Your rooms** keeps its DNA and leaderboard.

## Architecture

```
src/
  App.jsx                 auth gate → home → room
  hooks/useRoom.js        host loop (authoritative state, heartbeats) + client loop (reconnects)
  game/engine.js          pure game rules, Room DNA, per-phone filtered views
  game/missions.js        16 missions (4 per vibe)
  lib/net.js              transports: PeerJS (WebRTC) + Supabase Realtime
  lib/db.js               accounts, rooms, stats: localStorage + optional Supabase
  lib/sound.js            Web Audio synth (no audio files)
  components/             screens
  styles/theme.css        monochrome system + DNA mutations
supabase/schema.sql       tables, RLS policies, login RPC
```

- **Host-authoritative:** the host phone holds the full game state. Each phone receives only its own filtered view, so the saboteur's identity and twist never reach other phones.
- **Networking:** PeerJS (the public PeerJS signalling server, with STUN plus a public TURN relay) works with zero configuration. When Supabase is configured, the host also listens on Supabase Realtime, and joining phones try it first.
- **Storage:**
  - **On-device (default):** accounts, rooms and history live in `localStorage`. The profiles of players you meet are cached peer-to-peer.
  - **Supabase:** run `supabase/schema.sql`, then paste the URL and anon key in **Profile menu → Database / Cloud settings**, or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time. Profiles, rooms, `room_players` and `mission_history` then sync to Postgres, and logins work on any device.

## Develop

```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi)
npm run build
```

To test networking against a self-hosted PeerServer, set
`localStorage['sr.peerServer'] = '{"host":"localhost","port":9000,"path":"/","secure":false}'`.

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
