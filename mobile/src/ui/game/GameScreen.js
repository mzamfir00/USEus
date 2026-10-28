import React from 'react';
import { View } from 'react-native';
import { ARENAS, GAMES } from '../../core';
import { T } from '../primitives';
import { FloorLava, HideSeekHider, HideSeekSeeker, MarcoHunter, MarcoPolo, Sardines, ZombieTag } from './Classics';
import MafiaGame from './Mafia';
import { RedLightRunner, RedLightWatcher } from './RedLight';
import { DarumaShadow, DarumaWalker, Doppelganger, MidnightCandle, MidnightHunter, SilenceHunter, SilenceSurvivor, StatueEntity, StatueWatcher } from './Rituals';
import { SonarHunter, SonarSurvivor } from './Sonar';
import { TeleprompterActor, TeleprompterDirector, TeleprompterSaboteur } from './Teleprompter';
import { IntentContext } from './context';
import { GameShell } from './shared';

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
    title: GAMES[r.game]?.name || 'USEus',
    location: r.location || ARENAS[r.arena]?.full || '',
    room: view.code,
    roundKey: roundKeyOf(view),
    game: r.game,
  };
  const props = { view, serverNow, intent, media, onLeave, hud };

  if (!role) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Spectating" onLeave={onLeave}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} testID="spectating">
          <T size={26} w={700} color="#fff" center>
            Round in progress
          </T>
          <T size={15} color="rgba(255,255,255,0.6)" center style={{ marginTop: 8 }}>
            You joined mid-round — you’ll be dealt in next time.
          </T>
        </View>
      </GameShell>
    );
  }

  switch (r.game) {
    case 'mafia':
      return <MafiaGame {...props} />;
    case 'blind_sonar':
      return role === 'hunter' ? <SonarHunter {...props} /> : <SonarSurvivor {...props} />;
    case 'teleprompter':
      if (role === 'actor') return <TeleprompterActor {...props} />;
      if (role === 'director') return <TeleprompterDirector {...props} />;
      return <TeleprompterSaboteur {...props} />;
    case 'red_light':
      return role === 'watcher' ? <RedLightWatcher {...props} /> : <RedLightRunner {...props} />;
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
