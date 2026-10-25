import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Play as PlayIcon, User, Users } from 'lucide-react';
import { dnaInfo } from './game/engine';
import { useRoom } from './hooks/useRoom';
import { currentAccount, refreshAccount, signOut } from './lib/database';
import { Synth } from './lib/sound';
import Auth from './ui/Auth';
import { BgFx } from './ui/primitives';
import Room from './ui/room/Room';
import History from './ui/tabs/History';
import Play from './ui/tabs/Play';
import Profile from './ui/tabs/Profile';
import Squad from './ui/tabs/Squad';

const TABS = [
  { id: 'play', label: 'Play', icon: PlayIcon },
  { id: 'squad', label: 'Squad', icon: Users },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'profile', label: 'Profile', icon: User },
];

const SOUND_KEY = 'useus.sound';

const inviteFromUrl = () => {
  const code = new URLSearchParams(window.location.search).get('room');
  return /^\d{4}$/.test(code || '') ? code : null;
};

const clearInvite = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
};

export default function App() {
  const [account, setAccount] = useState(() => currentAccount());
  const [tab, setTab] = useState('play');
  const [roomCode, setRoomCode] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [invite, setInvite] = useState(() => inviteFromUrl());
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off');
  const room = useRoom(account, setAccount);

  useEffect(() => {
    Synth.setMuted(!sound);
    localStorage.setItem(SOUND_KEY, sound ? 'on' : 'off');
  }, [sound]);

  useEffect(() => {
    if (account) refreshAccount(account).then((a) => a && setAccount(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  const join = useCallback(
    (code) => {
      Synth.unlock();
      setRoomCode(code);
      setInRoom(true);
      room.join(code);
    },
    [room]
  );

  const create = useCallback(
    (code) => {
      Synth.unlock();
      setRoomCode(code || null);
      setInRoom(true);
      room.host(code);
    },
    [room]
  );

  // QR / invite links (?room=1234) join as soon as the player is signed in.
  useEffect(() => {
    if (account && invite) {
      join(invite);
      setInvite(null);
      clearInvite();
    }
  }, [account, invite, join]);

  const leave = () => {
    room.leave();
    setInRoom(false);
    setRoomCode(null);
  };

  // Inside a room the Room DNA drives the look; elsewhere the player's chosen aesthetic.
  let style = 'none';
  let stage = 0;
  if (inRoom && room.view) {
    const info = dnaInfo(room.view.dna);
    style = info.style;
    stage = info.stage;
  } else if (account?.theme && account.theme !== 'none') {
    style = account.theme;
    stage = 2;
  }
  const themeClass = `st-${style} ${stage >= 1 ? 'lv1' : ''} ${stage >= 2 ? 'lv2' : ''} ${stage >= 3 ? 'lv3' : ''}`;

  let body;
  if (!account) body = <Auth invite={invite} onAuthed={setAccount} />;
  else if (inRoom) body = <Room room={room} code={roomCode} onLeave={leave} />;
  else {
    body = (
      <>
        <main key={tab} className="screen mx-auto max-w-md px-6 pb-[calc(96px+var(--safe-bottom))]">
          {tab === 'play' && <Play account={account} onCreate={create} onJoin={join} />}
          {tab === 'squad' && <Squad account={account} onAccount={setAccount} />}
          {tab === 'history' && <History account={account} />}
          {tab === 'profile' && (
            <Profile
              account={account}
              onAccount={setAccount}
              sound={sound}
              setSound={setSound}
              onSignOut={() => {
                signOut();
                setAccount(null);
                setTab('play');
              }}
            />
          )}
        </main>
        <nav className="tabbar" aria-label="Main">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </>
    );
  }

  return (
    <div className={`app ${themeClass}`}>
      <BgFx />
      {body}
    </div>
  );
}
