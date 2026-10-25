# 🎲 SQUAD ROULETTE

An IRL multiplayer party game built as a mobile web app: spin the wheel, get cast, film the chaos.

The whole game is one React component, [`src/SquadRoulette.jsx`](src/SquadRoulette.jsx). It uses Tailwind CSS and `lucide-react`, and synthesizes all of its sound effects with the Web Audio API, so there are no audio files.

## Run it

```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi)
npm run build    # production build in dist/
```

## Flow

1. **Lobby**: room code badge with a QR join modal, the squad roster (quick-add chips, 2–8 players), and the vibe selector. The ⭐ Creator Pack name is editable, so you can rename it for any influencer.
2. **Roulette**: a 2.5 s slot-machine reel. The mechanical ticks slow down, then a bass-drop lock-in. Players are cast as 🎬 Director, 🎭 Main Character, 📹 Cameraman and 🕵️ Secret Saboteur. A 5th player or more joins the 📣 Hype Crew.
3. **Briefing**: a large mission card with the player names highlighted. It has role cards, a tap-to-reveal secret twist, and a live timer with Play/Pause, +1 Min, Reset and "Simulate last 10 seconds". The last 10 seconds beep and the end of the timer sounds an alarm. **POV REC / Stamp Mode** opens the camera (or a simulated viewfinder if it's blocked) with a REC + timer watermark and the mission banner overlaid.
4. **Results**: Mission Complete (XP, a beat-the-clock bonus and a saboteur bonus) or Chickened Out (an XP penalty and a dare). The night's leaderboard follows, then **Next Round**, which rotates roles automatically.

## Missions

There are 16 missions, 4 per vibe. They use `{Player1}`, `{Player2}`, `{Player3}` and `{Pack}` placeholders, which are filled with the live squad's names. Missions don't repeat until a vibe's pool runs out.
