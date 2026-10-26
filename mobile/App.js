import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Clock, PlayIcon, User, Users } from 'lucide-react-native';
import { dnaInfo } from './src/core';
import { useRoom } from './src/hooks/useRoom';
import { PREFS, currentAccount, getPref, hydrate, refreshAccount, retryPendingDeletions, setPref, signOut } from './src/lib/database';
import { codeFromInvite } from './src/lib/platform';
import { Synth } from './src/lib/sound';
import { FONT_FILES, ThemeContext, inter, makeTheme } from './src/theme';
import Auth from './src/ui/Auth';
import { LegalSheet } from './src/ui/Legal';
import SafetyGate, { acceptSafety, safetyAccepted } from './src/ui/Safety';
import { BgFx } from './src/ui/primitives';
import Room from './src/ui/room/Room';
import ErrorBoundary from './src/ui/ErrorBoundary';
import { purgeCameraCache } from './src/lib/clips';
import History from './src/ui/tabs/History';
import Play from './src/ui/tabs/Play';
import Profile from './src/ui/tabs/Profile';
import Squad from './src/ui/tabs/Squad';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const TAB_ICONS = { Play: PlayIcon, Squad: Users, History: Clock, Profile: User };

function Main() {
  const [account, setAccount] = useState(() => currentAccount());
  const [roomCode, setRoomCode] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [invite, setInvite] = useState(null);
  const [sound, setSound] = useState(() => getPref(PREFS.sound) !== 'off');
  const [safety, setSafety] = useState(() => !safetyAccepted());
  const [safetyTerms, setSafetyTerms] = useState(false);
  const [notice, setNotice] = useState('');
  const room = useRoom(account, setAccount);

  useEffect(() => {
    Synth.setMuted(!sound);
    setPref(PREFS.sound, sound ? 'on' : 'off');
  }, [sound]);

  useEffect(() => {
    Synth.unlock(); // preload the sound effects
  }, []);

  useEffect(() => {
    if (account) refreshAccount(account).then((a) => a && setAccount(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  // useus://join?room=1234 (and invite links handed to the app) join as soon as signed in.
  useEffect(() => {
    const take = (url) => {
      const code = codeFromInvite(url);
      if (code) setInvite(code);
    };
    Linking.getInitialURL()
      .then((url) => url && take(url))
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => take(url));
    return () => sub.remove();
  }, []);

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

  useEffect(() => {
    if (account && invite && !inRoom) {
      join(invite);
      setInvite(null);
    }
  }, [account, invite, inRoom, join]);

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
  const theme = useMemo(() => makeTheme(style, stage), [style, stage]);
  const navTheme = useMemo(
    () => ({ ...DarkTheme, dark: true, colors: { ...DarkTheme.colors, background: theme.c.bg, card: theme.c.bg, border: theme.c.border, primary: theme.c.fg, text: theme.c.fg } }),
    [theme]
  );

  let body;
  if (!account) {
    body = (
      <Auth
        invite={invite}
        notice={notice}
        onAuthed={(a) => {
          setNotice('');
          setAccount(a);
        }}
      />
    );
  } else if (inRoom) {
    body = (
      <ErrorBoundary global onRecover={room.resync} onLeave={leave}>
        <Room room={room} code={roomCode} onLeave={leave} />
      </ErrorBoundary>
    );
  } else {
    body = (
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            sceneStyle: { backgroundColor: theme.c.bg },
            tabBarActiveTintColor: theme.c.fg,
            tabBarInactiveTintColor: theme.c.faint,
            tabBarStyle: { backgroundColor: 'rgba(0,0,0,0.92)', borderTopColor: theme.c.border, borderTopWidth: 1 },
            tabBarLabelStyle: { fontFamily: inter(500), fontSize: 11 },
            tabBarButtonTestID: `tab-${route.name.toLowerCase()}-button`,
            tabBarIcon: ({ color, focused }) => {
              const Icon = TAB_ICONS[route.name];
              return <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />;
            },
          })}
        >
          <Tab.Screen name="Play">{() => <Play account={account} onCreate={create} onJoin={join} />}</Tab.Screen>
          <Tab.Screen name="Squad">{() => <Squad account={account} onAccount={setAccount} />}</Tab.Screen>
          <Tab.Screen name="History">{() => <History account={account} />}</Tab.Screen>
          <Tab.Screen name="Profile">
            {({ navigation }) => (
              <Profile
                account={account}
                onAccount={setAccount}
                sound={sound}
                setSound={setSound}
                onSignOut={() => {
                  signOut();
                  setAccount(null);
                  navigation.navigate('Play');
                }}
                onDeleted={(result) => {
                  setAccount(null);
                  setNotice(
                    result.cloud === 'done'
                      ? 'Your account and all of its data were permanently deleted.'
                      : 'Your account was deleted from this phone. The cloud copy will be erased automatically the next time USEus opens online.'
                  );
                }}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <View style={{ flex: 1, backgroundColor: theme.c.bg }}>
        <StatusBar style="light" backgroundColor="#000000" />
        <BgFx />
        {body}
        {safety && (
          <SafetyGate
            onAgree={() => {
              acceptSafety();
              setSafety(false);
            }}
            onTerms={() => setSafetyTerms(true)}
          >
            {safetyTerms && <LegalSheet doc="terms" onClose={() => setSafetyTerms(false)} />}
          </SafetyGate>
        )}
      </View>
    </ThemeContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [hydrated, setHydrated] = useState(false);

  // Restore the saved login and history before the first screen, then finish any account
  // deletion that couldn't reach the cloud last time.
  useEffect(() => {
    purgeCameraCache(); // temporary clips and photos from earlier sessions
    hydrate().finally(() => {
      setHydrated(true);
      retryPendingDeletions();
    });
  }, []);

  const ready = hydrated && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <SafeAreaProvider style={{ backgroundColor: '#000' }}>
      <ErrorBoundary global title="USEus needs a restart" label="Restart USEus">
        <Main />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
