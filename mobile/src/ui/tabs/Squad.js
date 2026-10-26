import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Check, Search, UserPlus, Users } from 'lucide-react-native';
import { addFriend, isCloud, knownPlayers, profilesFor, searchPeople } from '../../lib/database';
import { useTheme } from '../../theme';
import { useBlocked } from '../Moderation';
import { Avatar, Card, Divided, Empty, Field, Screen, ScreenHeader, SectionLabel, T } from '../primitives';

function PersonRow({ person, isFriend, onAdd }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
      <Avatar name={person.name} size={40} />
      <View style={{ flex: 1 }}>
        <T size={16} w={600} numberOfLines={1}>
          {person.name}
        </T>
        <T muted size={13.5} numberOfLines={1}>
          @{person.username}
        </T>
      </View>
      {isFriend ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Check size={15} color={t.c.muted} />
          <T muted size={13}>
            Friends
          </T>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => onAdd(person)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Add ${person.name}`}
          style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.c.fg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={15} color={t.c.bg} />
          <T size={14} w={500} color={t.c.bg}>
            Add
          </T>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Squad({ account, onAccount }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const friendIds = account.friends || [];
  const blocked = useBlocked(); // blocked players never show up here
  const visible = (p) => !blocked[p.username];

  useEffect(() => {
    profilesFor(friendIds).then(setFriends);
  }, [friendIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      setResults(await searchPeople(query, account));
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, account]);

  const add = async (person) => onAccount(await addFriend(account, person));
  const suggestions = knownPlayers()
    .filter((p) => !friendIds.includes(p.id) && p.id !== account.id && visible(p))
    .slice(0, 6);

  return (
    <Screen testID="tab-squad">
      <ScreenHeader title="Squad" />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="@username, phone or email"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search people"
        left={<Search size={18} color={t.c.muted} style={{ marginRight: 10 }} />}
      />

      {query.trim().length >= 2 ? (
        <>
          <SectionLabel>{searching ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}</SectionLabel>
          {results.length > 0 ? (
            <Card>
              <Divided>
                {results.filter(visible).map((p) => (
                  <PersonRow key={p.id} person={p} isFriend={friendIds.includes(p.id)} onAdd={add} />
                ))}
              </Divided>
            </Card>
          ) : (
            !searching && (
              <Empty
                icon={Search}
                title="No one found"
                body={isCloud() ? 'Check the username, or search the exact phone number (with +code) or email.' : 'Without the cloud database, search covers players you have met in rooms.'}
              />
            )
          )}
        </>
      ) : (
        <>
          <SectionLabel>Friends{friends.length ? ` · ${friends.length}` : ''}</SectionLabel>
          {friends.length > 0 ? (
            <Card>
              <Divided>
                {friends.filter(visible).map((p) => (
                  <PersonRow key={p.id} person={p} isFriend />
                ))}
              </Divided>
            </Card>
          ) : (
            <Empty icon={Users} title="No friends yet" body="Search by @username, phone or email — or add people you’ve played with." />
          )}
          {suggestions.length > 0 && (
            <>
              <SectionLabel>Played with recently</SectionLabel>
              <Card>
                <Divided>
                  {suggestions.map((p) => (
                    <PersonRow key={p.id} person={p} isFriend={false} onAdd={add} />
                  ))}
                </Divided>
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
