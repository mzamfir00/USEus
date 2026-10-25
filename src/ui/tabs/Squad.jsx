import React, { useEffect, useState } from 'react';
import { Check, Search, UserPlus, Users } from 'lucide-react';
import { addFriend, isCloud, knownPlayers, profilesFor, searchPeople } from '../../lib/database';
import { Avatar, Empty, ScreenHeader, SectionLabel } from '../primitives';

function PersonRow({ person, isFriend, onAdd }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Avatar name={person.name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{person.name}</div>
        <div className="muted truncate text-[13.5px]">@{person.username}</div>
      </div>
      {isFriend ? (
        <span className="muted flex items-center gap-1 text-[13px]">
          <Check size={15} /> Friends
        </span>
      ) : (
        <button type="button" onClick={() => onAdd(person)} className="pill pill-on !h-9 !px-4">
          <UserPlus size={15} /> Add
        </button>
      )}
    </div>
  );
}

export default function Squad({ account, onAccount }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const friendIds = account.friends || [];

  useEffect(() => {
    profilesFor(friendIds).then(setFriends);
  }, [friendIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      setResults(await searchPeople(query, account));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, account]);

  const add = async (person) => onAccount(await addFriend(account, person));
  const suggestions = knownPlayers().filter((p) => !friendIds.includes(p.id) && p.id !== account.id).slice(0, 6);

  return (
    <div className="enter">
      <ScreenHeader title="Squad" />
      <div className="relative">
        <Search size={18} className="muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          className="field !pl-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="@username, phone or email"
          autoCapitalize="none"
          aria-label="Search people"
        />
      </div>

      {query.trim().length >= 2 ? (
        <>
          <SectionLabel>{searching ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}</SectionLabel>
          {results.length > 0 ? (
            <div className="card divide overflow-hidden">
              {results.map((p) => (
                <PersonRow key={p.id} person={p} isFriend={friendIds.includes(p.id)} onAdd={add} />
              ))}
            </div>
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
            <div className="card divide overflow-hidden">
              {friends.map((p) => (
                <PersonRow key={p.id} person={p} isFriend />
              ))}
            </div>
          ) : (
            <Empty icon={Users} title="No friends yet" body="Search by @username, phone or email — or add people you’ve played with." />
          )}
          {suggestions.length > 0 && (
            <>
              <SectionLabel>Played with recently</SectionLabel>
              <div className="card divide overflow-hidden">
                {suggestions.map((p) => (
                  <PersonRow key={p.id} person={p} isFriend={false} onAdd={add} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
