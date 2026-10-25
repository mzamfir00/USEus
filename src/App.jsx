import React, { useCallback, useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import HomeScreen, { ProfileMenu, SettingsSheet } from './components/HomeScreen';
import RoomScreen from './components/RoomScreen';
import { BgFx } from './components/ui';
import { dnaInfo } from './game/engine';
import { useRoom } from './hooks/useRoom';
import { currentUser, logOut, refreshProfile } from './lib/db';
import { Synth } from './lib/sound';

const readRoomParam = () => {
  const code = new URLSearchParams(window.location.search).get('room');
  return /^\d{4}$/.test(code || '') ? code : null;
};

const clearRoomParam = () => {
  const url = new URL(window.location.href);
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
};

export default function App() {
  const [profile, setProfile] = useState(() => currentUser());
  const [screen, setScreen] = useState('home'); // home | room
  const [roomCode, setRoomCode] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(() => readRoomParam());
  const [sheet, setSheet] = useState(null); // menu | settings
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState('');
  const room = useRoom(profile, setProfile);

  useEffect(() => Synth.setMuted(muted), [muted]);

  useEffect(() => {
    if (profile) refreshProfile(profile.username).then((p) => p && setProfile(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username]);

  const join = useCallback(
    (code) => {
      setNotice('');
      setRoomCode(code);
      setScreen('room');
      room.join(code);
    },
    [room]
  );

  const create = useCallback(
    (code) => {
      setNotice('');
      setRoomCode(code || null);
      setScreen('room');
      room.host(code);
    },
    [room]
  );

  // QR / invite links: ?room=1234 joins as soon as the player is signed in.
  useEffect(() => {
    if (profile && pendingRoom) {
      join(pendingRoom);
      setPendingRoom(null);
      clearRoomParam();
    }
  }, [profile, pendingRoom, join]);

  const exitRoom = () => {
    Synth.click();
    room.leave();
    setScreen('home');
    setRoomCode(null);
  };

  const info = screen === 'room' && room.view ? dnaInfo(room.view.dna) : dnaInfo(null);
  const themeClass = `st-${info.style} ${info.stage >= 1 ? 'lv1' : ''} ${info.stage >= 2 ? 'lv2' : ''} ${info.stage >= 3 ? 'lv3' : ''}`;

  return (
    <div className={`app ${themeClass}`}>
      <BgFx />
      {!profile ? (
        <AuthScreen pendingRoom={pendingRoom} onAuthed={setProfile} />
      ) : screen === 'room' ? (
        <RoomScreen room={room} code={roomCode} muted={muted} setMuted={setMuted} onExit={exitRoom} />
      ) : (
        <HomeScreen profile={profile} notice={notice} onCreate={create} onJoin={join} onMenu={() => setSheet('menu')} />
      )}

      {sheet === 'menu' && profile && (
        <ProfileMenu
          profile={profile}
          onClose={() => setSheet(null)}
          onSettings={() => setSheet('settings')}
          onLogout={() => {
            room.leave();
            logOut();
            setProfile(null);
            setScreen('home');
            setSheet(null);
          }}
        />
      )}
      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
