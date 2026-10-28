// Mafia: The AI Storyteller Edition — the in-game screen every phone shows. The host's engine
// drives the night → morning → debate → vote cycle; the Storyteller phone reads each step out
// loud; at night every screen is pitch black except the role being called.
import React, { useEffect, useRef, useState } from 'react';
import { Moon, Volume2 } from 'lucide-react';
import { mafiaAlive, stepText, storytellerOf } from '../../game/mafia';
import { buzz, Synth } from '../../lib/sound';
import { narrate, stopNarration } from '../../lib/storyteller';
import { formatTime, useNow } from '../room/helpers';
import { Avatar } from '../primitives';
import Camera from './Camera';
import { RoleCard, roleTitle } from './MafiaBriefing';
import { GameShell, nameOf, userOf } from './shared';

const NIGHT = new Set(['dusk', 'mafia', 'mafiaSleep', 'doctor', 'doctorSleep', 'detective', 'detectiveSleep']);

function useStoryteller(view, serverNow) {
  const d = view.round.data;
  const step = d.step;
  const voice = storytellerOf(view) === view.me;
  const said = useRef(null);
  useEffect(() => {
    if (!voice || !step || said.current === step.id) return undefined;
    said.current = step.id;
    const wait = step.sayAt - serverNow();
    if (wait < -8000) return undefined; // joined late: never read an old line
    const text = stepText(step, d.lang);
    const timer = setTimeout(() => narrate(text, d.lang), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [voice, step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopNarration(), []);
  return voice;
}

/* ---------------------------------- night --------------------------------- */

function Sleep({ voice, n }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black" data-night>
      <div className="flex flex-col items-center text-center">
        <Moon size={22} className="text-[#3c3c3c]" />
        <div className="mt-3 text-[12.5px] font-bold tracking-[0.16em] text-[#3c3c3c]">NIGHT TIME — CLOSE YOUR EYES</div>
        <div className="mt-1.5 text-[11px] text-[#262626]">Night {n}</div>
      </div>
      {voice && (
        <div className="absolute bottom-12 flex items-center gap-1.5 text-[11px] text-[#262626]">
          <Volume2 size={12} /> Storyteller phone · volume up
        </div>
      )}
    </div>
  );
}

function NightPicker({ title, sub, ids, view, selected, onSelect, marks = {}, action, onAction, actionDisabled, deadline, serverNow, data }) {
  const left = deadline ? Math.max(0, Math.ceil((deadline - serverNow()) / 1000)) : null;
  return (
    <div className="absolute inset-0 flex flex-col bg-black px-5 pb-[calc(20px+var(--safe-bottom))] pt-[calc(28px+var(--safe-top))]" {...{ [`data-${data}`]: true }}>
      <div className="flex items-baseline justify-between text-[13px] font-extrabold tracking-[0.12em] text-[#8a8a8a]">
        <span>{title}</span>
        {left != null && <span className="tnum">{left}s</span>}
      </div>
      <div className="mt-1.5 text-[13px] leading-snug text-[#5a5a5a]">{sub}</div>
      <div className="noscroll mt-4 flex-1 space-y-2 overflow-y-auto pb-4">
        {ids.map((id) => {
          const on = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              data-night-pick={userOf(view, id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left ${on ? 'border-[#8a8a8a] bg-[#141414] text-[#c4c4c4]' : 'border-[#1f1f1f] bg-[#050505] text-[#8a8a8a]'}`}
            >
              <span className={`flex-1 truncate text-[16px] ${on ? 'font-bold' : 'font-medium'}`}>
                {nameOf(view, id)}
                {id === view.me ? ' (you)' : ''}
              </span>
              {marks[id] && <span className="text-[11.5px] font-semibold text-[#6a6a6a]">{marks[id]}</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        data-night-action
        className={`h-[52px] rounded-full border text-[14px] font-extrabold tracking-[0.08em] ${actionDisabled ? 'border-[#1f1f1f] text-[#3a3a3a]' : 'border-[#6a6a6a] bg-[#141414] text-[#c4c4c4]'}`}
      >
        {action}
      </button>
    </div>
  );
}

function MafiaTurn({ view, serverNow, intent }) {
  const mine = view.mine;
  const team = mine.team || [view.me];
  const ids = mafiaAlive(view.round).filter((id) => !team.includes(id));
  const picks = mine.picks || {};
  const marks = {};
  team
    .filter((id) => id !== view.me && picks[id])
    .forEach((id) => {
      marks[picks[id]] = `${nameOf(view, id).split(' ')[0]}${mine.locked?.[id] ? ' ✓' : ''}`;
    });
  const locked = !!mine.locked?.[view.me];
  const partners = team.filter((id) => id !== view.me && !view.round.data.dead[id]);
  return (
    <NightPicker
      data="mafia-turn"
      view={view}
      serverNow={serverNow}
      deadline={mine.deadline}
      title="🔪 MAFIA · CHOOSE YOUR TARGET"
      sub={partners.length ? `Agree with ${partners.map((id) => nameOf(view, id).split(' ')[0]).join(' & ')}: you all have to confirm the same name.` : 'Tap a player, then confirm. Stay silent.'}
      ids={ids}
      selected={picks[view.me]}
      marks={marks}
      onSelect={(id) => intent({ type: 'mafiaPick', id })}
      action={locked ? 'LOCKED · WAITING FOR YOUR PARTNER' : picks[view.me] ? `CONFIRM: ${nameOf(view, picks[view.me]).toUpperCase()}` : 'TAP A PLAYER'}
      actionDisabled={locked || !picks[view.me]}
      onAction={() => intent({ type: 'mafiaConfirm' })}
    />
  );
}

function SaveOrCheck({ view, serverNow, intent, role }) {
  const [sel, setSel] = useState(null);
  const doctor = role === 'doctor';
  const ids = mafiaAlive(view.round).filter((id) => doctor || id !== view.me);
  return (
    <NightPicker
      data={`${role}-turn`}
      view={view}
      serverNow={serverNow}
      deadline={view.mine.deadline}
      title={doctor ? '🩺 DOCTOR · WHO DO YOU SAVE?' : '🕵️ DETECTIVE · WHO DO YOU CHECK?'}
      sub={doctor ? 'Tap one player — yourself included — to protect them tonight.' : 'Tap one player to see, only on your screen, if they are Mafia.'}
      ids={ids}
      selected={sel}
      onSelect={setSel}
      action={sel ? `${doctor ? 'PROTECT' : 'INVESTIGATE'}: ${nameOf(view, sel).toUpperCase()}` : 'TAP A PLAYER'}
      actionDisabled={!sel}
      onAction={() => intent({ type: doctor ? 'mafiaProtect' : 'mafiaCheck', id: sel })}
    />
  );
}

function Verdict({ view, verdict }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black px-6 text-center" data-detective-verdict>
      <div>
        <div className="text-[13px] font-bold tracking-[0.12em] text-[#8a8a8a]">{nameOf(view, verdict.id).toUpperCase()} IS</div>
        <div className="mt-3 text-[44px] font-extrabold tracking-tight text-white" data-verdict-text>
          {verdict.mafia ? '[🔪 MAFIA]' : '[✅ INNOCENT]'}
        </div>
        <div className="mt-4 text-[12.5px] text-[#5a5a5a]">Remember it. Your screen goes dark in a moment.</div>
      </div>
    </div>
  );
}

function Night({ view, serverNow, intent, kind, voice }) {
  const d = view.round.data;
  const mine = view.mine || {};
  const awake = !d.dead[view.me];
  let turn = null;
  if (awake && kind === 'mafia' && mine.role === 'mafia' && !mine.target) turn = 'mafia';
  if (awake && kind === 'doctor' && mine.role === 'doctor' && !mine.picked) turn = 'doctor';
  if (awake && kind === 'detective' && mine.role === 'detective' && !mine.picked) turn = 'detective';
  const verdict = kind === 'detective' && mine.verdict && mine.verdict.until > serverNow() ? mine.verdict : null;
  const woke = useRef(null);
  useEffect(() => {
    if (turn && woke.current !== d.step.id) {
      woke.current = d.step.id;
      buzz([60, 120, 40]); // only the role being called feels its phone wake up
    }
  }, [turn, d.step?.id]);
  if (verdict) return <Verdict view={view} verdict={verdict} />;
  if (turn === 'mafia') return <MafiaTurn view={view} serverNow={serverNow} intent={intent} />;
  if (turn) return <SaveOrCheck key={d.step.id} view={view} serverNow={serverNow} intent={intent} role={turn} />;
  return <Sleep voice={voice} n={d.n} />;
}

/* ----------------------------------- day ---------------------------------- */

const Page = ({ children, light, data }) => (
  <div className={`noscroll absolute inset-0 overflow-y-auto px-[22px] pb-10 pt-[calc(76px+var(--safe-top))] ${light ? 'bg-[#f4f4f1] text-[#111]' : 'bg-black text-white'}`} {...{ [`data-${data}`]: true }}>
    {children}
  </div>
);

function Roster({ view }) {
  const d = view.round.data;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {view.round.participants.map((id) => {
        const out = !!d.dead[id];
        return (
          <div key={id} className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 ${out ? 'border-[#1f1f1f] opacity-45' : 'border-[#3a3a3a]'}`}>
            <Avatar name={nameOf(view, id)} size={24} inverted={id === view.me} />
            <span className={`text-[13px] font-medium ${out ? 'line-through' : ''}`}>{nameOf(view, id).split(' ')[0]}</span>
            {out && <span className="text-[11px]">👻</span>}
          </div>
        );
      })}
    </div>
  );
}

function Morning({ view }) {
  const d = view.round.data;
  const rep = d.report || {};
  const headline = rep.victim ? `${nameOf(view, rep.victim).toUpperCase()} WAS ELIMINATED LAST NIGHT` : rep.saved ? 'THE DOCTOR SAVED A LIFE' : 'A QUIET NIGHT IN THE CITY';
  const body = rep.victim
    ? `The Mafia struck while the city slept. @${userOf(view, rep.victim)} is out of the game.`
    : rep.saved
      ? 'The Mafia tried to strike, but the Doctor got there just in time. Nobody died.'
      : 'Nobody was attacked. Nobody died.';
  const alive = mafiaAlive(view.round);
  return (
    <Page light data="morning-report">
      <div className="text-center text-[11px] font-bold tracking-[0.2em] text-[#555]">MORNING EDITION · DAY {d.n}</div>
      <div className="headline mt-1.5 text-center !text-[38px] font-serif">The USEus Times</div>
      <div className="mt-2.5 h-[3px] bg-[#111]" />
      <div className="mt-[3px] h-px bg-[#111]" />
      <div className="mt-5 text-[30px] font-extrabold leading-[1.08] tracking-tight" data-morning-headline>
        {headline}
      </div>
      <p className="mt-3 text-[16px] leading-relaxed text-[#333]">{body}</p>
      {rep.victim === view.me && (
        <div className="mt-5 border-2 border-[#111] p-4">
          <div className="text-[14px] font-extrabold tracking-[0.04em]">👻 YOU’RE OUT — GHOST CAMERA MODE</div>
          <div className="mt-1.5 text-[14px] leading-snug text-[#333]">No talking and no voting from now on. Your phone becomes a camera: film the survivors’ reactions.</div>
        </div>
      )}
      <div className="mt-6 h-px bg-[#111]" />
      <div className="mt-3 text-[12px] font-bold tracking-[0.12em] text-[#555]">STILL STANDING · {alive.length}</div>
      <div className="mt-1 text-[15px] leading-relaxed">{alive.map((id) => nameOf(view, id)).join(' · ')}</div>
    </Page>
  );
}

function Debate({ view, serverNow, intent }) {
  const d = view.round.data;
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  return (
    <Page data="mafia-day">
      <div className="text-[12px] font-bold tracking-[0.16em] text-[#8a8a8a]">DAY {d.n} · DISCUSSION</div>
      <div className="tnum mt-1 text-[84px] font-extrabold leading-[1.1] tracking-[-0.04em]" data-day-timer>
        {formatTime(left)}
      </div>
      <p className="text-[16px] leading-relaxed">Who’s in the Mafia? Share what you noticed, accuse, defend. When the timer ends, everyone votes.</p>
      <Roster view={view} />
      {view.hostId === view.me && (
        <button type="button" className="btn btn-primary mt-6" onClick={() => intent({ type: 'mafiaSkip' })} data-skip-to-vote>
          Skip to Voting Early
        </button>
      )}
      <div className="mt-6">
        <RoleCard view={view} compact />
      </div>
    </Page>
  );
}

function Ballot({ view, serverNow, intent }) {
  const d = view.round.data;
  const [sel, setSel] = useState(null);
  const alive = mafiaAlive(view.round);
  const cast = Object.keys(d.voted || {}).length;
  const voted = !!d.voted?.[view.me];
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  return (
    <Page data="mafia-ballot">
      <div className="flex items-baseline justify-between text-[12px] font-bold tracking-[0.16em] text-[#8a8a8a]">
        <span>DAY {d.n} · TRIAL VOTE</span>
        <span className="tnum">{formatTime(left)}</span>
      </div>
      <div className="mt-2 text-[30px] font-extrabold tracking-tight" data-votes-cast>
        Votes Cast: {cast}/{alive.length}
      </div>
      {voted ? (
        <p className="mt-4 text-[16px] leading-relaxed" data-vote-done>
          Your vote is in. Everyone sees who voted for whom once the last ballot lands.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-snug text-[#8a8a8a]">Tap the player you want to eliminate, then confirm — or skip.</p>
          <div className="mt-4 space-y-2">
            {alive
              .filter((id) => id !== view.me)
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSel(id)}
                  data-ballot={userOf(view, id)}
                  className={`flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left ${sel === id ? 'border-white bg-white text-black' : 'border-[#262626] bg-[#0d0d0d]'}`}
                >
                  <Avatar name={nameOf(view, id)} size={32} inverted={sel !== id} />
                  <span className="flex-1 truncate text-[16px] font-semibold">{nameOf(view, id)}</span>
                </button>
              ))}
          </div>
          <button type="button" className="btn btn-primary mt-5" disabled={!sel} onClick={() => intent({ type: 'mafiaVote', id: sel })} data-cast-vote>
            {sel ? `Vote to eliminate ${nameOf(view, sel).split(' ')[0]}` : 'Pick a player'}
          </button>
          <button type="button" className="btn btn-secondary mt-2.5" onClick={() => intent({ type: 'mafiaVote', id: null })} data-skip-vote>
            Skip Vote (No Elimination)
          </button>
        </>
      )}
    </Page>
  );
}

function VoteReveal({ view }) {
  const d = view.round.data;
  const v = d.verdict || {};
  return (
    <Page data="mafia-verdict">
      <div className="text-[12px] font-bold tracking-[0.16em] text-[#8a8a8a]">THE TOWN HAS VOTED</div>
      {v.out ? (
        <>
          <div className="mt-2.5 text-[40px] font-extrabold leading-[1.05] tracking-tight">{nameOf(view, v.out)} is out</div>
          <div className="mt-4 rounded-[22px] bg-white p-[18px] text-black">
            <div className="text-[11.5px] font-bold tracking-[0.14em] text-black/50">TRUE ROLE</div>
            <div className="mt-1 text-[30px] font-extrabold" data-verdict-role>
              {roleTitle(v.role)}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2.5 text-[36px] font-extrabold leading-[1.05] tracking-tight" data-verdict-none>
            Nobody is eliminated
          </div>
          <div className="mt-2 text-[15px] text-[#8a8a8a]">A tie at the top, or as many skips as votes.</div>
        </>
      )}
      <div className="mt-7 text-[12px] font-bold tracking-[0.12em] text-[#8a8a8a]">WHO VOTED FOR WHOM</div>
      <div className="mt-2 divide-y divide-[#1a1a1a] rounded-[18px] border border-[#262626]">
        {Object.entries(d.ballots || {}).map(([voter, target]) => (
          <div key={voter} className="flex items-center gap-2.5 px-4 py-3 text-[15px]">
            <span className="flex-1 truncate font-semibold">{nameOf(view, voter)}</span>
            <span className={target ? '' : 'text-[#8a8a8a]'}>{target ? `→ ${nameOf(view, target)}` : 'Skipped'}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}

function TheEnd({ view }) {
  const town = view.round.data.winner === 'town';
  useEffect(() => {
    Synth.success();
  }, []);
  return (
    <div className={`absolute inset-0 grid place-items-center px-7 text-center ${town ? 'bg-white text-black' : 'bg-black text-white'}`} data-mafia-end>
      <div>
        <div className="text-[44px] font-extrabold leading-[1.05] tracking-tight">{town ? '🏆 CITIZENS WIN!' : '🔪 MAFIA WINS!'}</div>
        <div className={`mt-3 text-[15px] ${town ? 'text-black/60' : 'text-[#8a8a8a]'}`}>Revealing every secret role…</div>
      </div>
    </div>
  );
}

function GhostCam({ view, serverNow, hud, kind }) {
  const d = view.round.data;
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  const line = kind === 'vote' ? `Trial vote · Votes Cast: ${Object.keys(d.voted || {}).length}/${mafiaAlive(view.round).length}` : `Debate · ${formatTime(left)} left`;
  return (
    <Camera hud={hud} record>
      <div className="pointer-events-none absolute inset-x-4 bottom-[calc(110px+var(--safe-bottom))] rounded-[20px] border border-white/20 bg-black/75 p-4" data-ghost-cam>
        <div className="text-[13px] font-extrabold tracking-[0.1em]">👻 GHOST CAM</div>
        <div className="mt-1 text-[14px] leading-snug text-white/80">You’re out: no talking, no voting. Film the survivors’ reactions.</div>
        <div className="mt-2 text-[13px] font-semibold">{line}</div>
      </div>
    </Camera>
  );
}

export default function MafiaGame({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const d = view.round.data;
  const kind = d.step?.kind || 'dusk';
  const dead = !!d.dead[view.me];
  const night = NIGHT.has(kind);
  const voice = useStoryteller(view, serverNow);
  const label = dead ? 'Ghost · out of the game' : night ? `Night ${d.n}` : `Day ${d.n} · ${mafiaAlive(view.round).length} still standing`;

  let body;
  if (night) body = <Night view={view} serverNow={serverNow} intent={intent} kind={kind} voice={voice} />;
  else if (kind === 'morning') body = <Morning view={view} />;
  else if (kind === 'day') body = dead ? <GhostCam view={view} serverNow={serverNow} hud={hud} kind={kind} /> : <Debate view={view} serverNow={serverNow} intent={intent} />;
  else if (kind === 'vote') body = dead ? <GhostCam view={view} serverNow={serverNow} hud={hud} kind={kind} /> : <Ballot key={d.step.id} view={view} serverNow={serverNow} intent={intent} />;
  else if (kind === 'verdict') body = <VoteReveal view={view} />;
  else body = <TheEnd view={view} />;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={label} onLeave={onLeave} hud={!night && kind !== 'end'} light={kind === 'morning'}>
      {body}
    </GameShell>
  );
}
