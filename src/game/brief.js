// Pure Mission Briefing logic shared by the web app and the native app: which role this
// phone holds (including secret roles) and the personalised briefing to show for it.
import { BRIEFINGS, SNITCH_DARK_LINE, SNITCH_LINE } from './briefings';
import { GAMES, HUNT, XP } from './games';

const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';

// This phone's role, including secret roles only this phone may know about.
export function myRoleKey(view) {
  const r = view.round;
  if (r.game === 'mafia') return view.mine?.role || null;
  if (r.game === 'doppelganger' && view.mine?.doppelganger) return 'doppelganger';
  return r.roles[view.me] || null;
}

export function briefingFor(view) {
  const r = view.round;
  const g = GAMES[r.game];
  const b = BRIEFINGS[r.game];
  const key = myRoleKey(view);
  const role = b.roles[key];
  const fill = (t) => (t || '').replace('{target}', view.mine?.target ? nameOf(view, view.mine.target) : 'secret');
  const films = g.film.includes(r.roles[view.me]); // public role: secret roles film like everyone else
  const snitch = films ? (g.dark ? SNITCH_DARK_LINE : SNITCH_LINE) : null;
  const penalty = [fill(role?.penalty), snitch].filter(Boolean).join(' ') || 'No penalties — just play it straight.';
  const setup = [...b.setup];
  if (r.zone) setup.push(`GPS Playzone: stay within ${r.zone.radius} m of the arena center. Leave it for 10 s and your live position is revealed (${XP.zoneOut} XP).`);
  const others = Object.entries(b.roles)
    .filter(([k]) => k !== key)
    .map(([k, info]) => {
      const holders = info.hidden ? [] : r.participants.filter((id) => r.roles[id] === k && id !== view.me);
      return { key: k, label: g.roles[k]?.label || k, summary: info.summary, hidden: !!info.hidden, names: holders.map((id) => nameOf(view, id)) };
    })
    .filter((o) => o.hidden || o.names.length);
  const solo = r.participants.filter((id) => id !== view.me && r.roles[id] === r.roles[view.me]).map((id) => nameOf(view, id));
  let zoneLine = null;
  if (r.zone && r.hunt) {
    const hunter = r.roles[view.me] === HUNT[r.game].role;
    zoneLine = hunter
      ? `Playzone: “RADAR PING” shows the remaining ${HUNT[r.game].hiders} on your map for 3 s (2 per round, ${XP.radarPing} XP each).`
      : 'Playzone: one decoy ping, a heartbeat warning when a hunter is within 20 m, and a mid-round supply drop worth +300 XP.';
  }
  return {
    game: g,
    key,
    label: g.roles[key]?.label || 'Spectator',
    bullets: role ? [fill(role.irl), fill(role.controls), penalty] : [],
    setup,
    others,
    sameAs: !others.length && solo.length ? solo : null,
    zoneLine,
    horror: g.pack === 'halloween',
  };
}
