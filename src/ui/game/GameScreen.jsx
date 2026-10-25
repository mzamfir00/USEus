import React from 'react';
import { ARENAS, GAMES } from '../../game/games';
import { FloorLava, HideSeekHider, HideSeekSeeker, MarcoHunter, MarcoPolo, Sardines, ZombieTag } from './Classics';
import HotPotato from './HotPotato';
import { PaparazziReview, PaparazziSniper } from './Paparazzi';
import { RedLightRunner, RedLightWatcher } from './RedLight';
import { DarumaShadow, DarumaWalker, Doppelganger, MidnightCandle, MidnightHunter, SilenceHunter, SilenceSurvivor, StatueEntity, StatueWatcher } from './Rituals';
import { SonarHunter, SonarSurvivor } from './Sonar';
import { TeleprompterActor, TeleprompterDirector, TeleprompterSaboteur } from './Teleprompter';
import { UndercoverPlay, UndercoverVote } from './Undercover';
import { GameShell, IntentContext } from './shared';

export const roundKeyOf = (view) => `${view.code}:${view.round.n}:${view.round.spinId}`;

// Picks the right interactive screen for this phone's role.
export default function GameScreen(props) {
  return (
    <IntentContext.Provider value={props.intent}>
      <RoleScreen {...props} />
    </IntentContext.Provider>
  );
}

function RoleScreen({ view, serverNow, intent, media, onLeave }) {
  const r = view.round;
  const role = r.roles[view.me];
  const hud = {
    title: GAMES[r.game].name,
    location: r.location || ARENAS[r.arena].full,
    room: view.code,
    roundKey: roundKeyOf(view),
    game: r.game,
  };
  const props = { view, serverNow, intent, media, onLeave, hud };

  if (!role) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Spectating" onLeave={onLeave}>
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <div className="text-[26px] font-bold">Round in progress</div>
            <div className="mt-2 text-[15px] text-white/60">You joined mid-round — you’ll be dealt in next time.</div>
          </div>
        </div>
      </GameShell>
    );
  }

  switch (r.game) {
    case 'blind_sonar':
      return role === 'hunter' ? <SonarHunter {...props} /> : <SonarSurvivor {...props} />;
    case 'paparazzi':
      return <PaparazziSniper {...props} />;
    case 'teleprompter':
      if (role === 'actor') return <TeleprompterActor {...props} />;
      if (role === 'director') return <TeleprompterDirector {...props} />;
      return <TeleprompterSaboteur {...props} />;
    case 'red_light':
      return role === 'watcher' ? <RedLightWatcher {...props} /> : <RedLightRunner {...props} />;
    case 'hot_potato':
      return <HotPotato {...props} />;
    case 'undercover':
      return <UndercoverPlay {...props} />;
    case 'hide_seek':
      return role === 'seeker' ? <HideSeekSeeker {...props} /> : <HideSeekHider {...props} />;
    case 'sardines':
      return <Sardines {...props} />;
    case 'floor_lava':
      return <FloorLava {...props} />;
    case 'zombie_tag':
      return <ZombieTag {...props} />;
    case 'marco_polo':
      return role === 'marco' ? <MarcoHunter {...props} /> : <MarcoPolo {...props} />;
    case 'midnight_man':
      return role === 'midnight' ? <MidnightHunter {...props} /> : <MidnightCandle {...props} />;
    case 'weeping_statue':
      return role === 'statue' ? <StatueEntity {...props} /> : <StatueWatcher {...props} />;
    case 'daruma':
      return role === 'shadow' ? <DarumaShadow {...props} /> : <DarumaWalker {...props} />;
    case 'dead_silence':
      return role === 'hunter' ? <SilenceHunter {...props} /> : <SilenceSurvivor {...props} />;
    case 'doppelganger':
      return <Doppelganger {...props} />;
    default:
      return null;
  }
}

export function ReviewScreen({ view, intent, media }) {
  if (view.round.game === 'paparazzi') return <PaparazziReview view={view} intent={intent} media={media} />;
  if (view.round.game === 'undercover') return <UndercoverVote view={view} intent={intent} />;
  return null;
}
