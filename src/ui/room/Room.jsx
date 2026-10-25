import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Share2, X } from 'lucide-react';
import { DNA_STYLES } from '../../game/constants';
import { dnaInfo, timerRemaining } from '../../game/engine';
import { errorText } from '../../hooks/useRoom';
import { buzz, Synth } from '../../lib/sound';
import { LevelDots, Sheet } from '../primitives';
import Lobby from './Lobby';
import Mission from './Mission';
import Overlay from './Overlay';
import Results from './Results';
import Spin from './Spin';

export const roomLink = (code) => `${window.location.origin}${import.meta.env.BASE_URL}?room=${code}`;

function InviteSheet({ code, onClose }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const link = roomLink(code);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 600, color: { dark: '#000000', light: '#FFFFFF' } }).then(setQr);
  }, [link]);
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'USEus', text: `Join my USEus room: ${code}`, url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
  };
  return (
    <Sheet title="Invite friends" onClose={onClose}>
      <div className="mx-auto w-full max-w-[260px] rounded-[24px] bg-white p-4">{qr && <img src={qr} alt={`QR code for room ${code}`} className="block w-full" />}</div>
      <div className="tnum mt-6 text-center text-[44px] font-bold tracking-[0.14em]">{code}</div>
      <p className="muted mt-1 text-center text-[14px]">Friends scan the code or enter it in Play.</p>
      <button type="button" className="btn btn-primary mt-6" onClick={share}>
        <Share2 size={18} /> {copied ? 'Link copied' : 'Share invite link'}
      </button>
    </Sheet>
  );
}

function DnaSheet({ info, onClose }) {
  return (
    <Sheet title="Room DNA" onClose={onClose}>
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Level {info.stage} of 3</div>
          <div className="headline mt-1 text-[26px]">{DNA_STYLES[info.style].name}</div>
        </div>
        <LevelDots stage={info.stage} />
      </div>
      <p className="muted mt-3 text-[14.5px] leading-relaxed">{DNA_STYLES[info.style].motto}</p>
      <div className="card divide mt-6 overflow-hidden">
        {['auteur', 'dossier', 'kinetic'].map((id) => (
          <div key={id} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-[15px] font-medium">{DNA_STYLES[id].name}</span>
            <span className="muted text-[13px]">{id === 'auteur' ? 'Supermarket · Creator' : id === 'dossier' ? 'City streets' : 'Roadtrip'}</span>
          </div>
        ))}
      </div>
      <p className="muted mt-4 text-[13px] leading-relaxed">
        Every completed mission evolves the room. The vibe you play most decides its style. Players unlock each style for their profile.
      </p>
    </Sheet>
  );
}

function Evolution({ info, onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    Synth.success();
    buzz([30, 40, 80]);
    const t = setTimeout(() => done.current(), 2800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fade fixed inset-0 z-[60] grid place-items-center bg-white px-8 text-black" onClick={onDone}>
      <div className="pop text-center">
        <div className="text-[14px] font-medium text-black/50">Room evolved</div>
        <div className="mt-3 text-[64px] font-bold leading-none tracking-[-0.04em]">Level {info.stage}</div>
        <div className="mt-3 text-[22px] font-semibold">{DNA_STYLES[info.style].name}</div>
      </div>
    </div>
  );
}

// Countdown beeps + alarm on every phone, whichever screen is open.
function useTimerAlerts(view, serverNow) {
  const prev = useRef(null);
  useEffect(() => {
    if (view?.phase !== 'round') return undefined;
    const id = setInterval(() => {
      const t = view.round.timer;
      const secs = Math.ceil(timerRemaining(t, serverNow()) / 1000);
      if (prev.current !== null && secs !== prev.current) {
        if (t.running && secs <= 10 && secs > 0) {
          Synth.beep(secs <= 3);
          buzz(secs <= 3 ? 50 : 20);
        }
        if (secs === 0 && prev.current > 0) {
          Synth.alarm();
          buzz([200, 80, 200, 80, 400]);
        }
      }
      prev.current = secs;
    }, 200);
    return () => clearInterval(id);
  }, [view, serverNow]);
}

function Status({ title, body, busy, onLeave }) {
  return (
    <div className="enter flex flex-1 flex-col items-center justify-center pb-24 text-center">
      {busy && <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--fg)]" />}
      <h2 className="headline text-[24px]">{title}</h2>
      {body && <p className="muted mt-2 max-w-[30ch] text-[15px] leading-snug">{body}</p>}
      {!busy && (
        <button type="button" className="btn btn-secondary mt-8 !w-auto px-8" onClick={onLeave}>
          Back
        </button>
      )}
    </div>
  );
}

export default function Room({ room, code, onLeave }) {
  const { status, view, error, serverNow, intent, role } = room;
  const [sheet, setSheet] = useState(null); // invite | dna
  const [overlay, setOverlay] = useState(false);
  const [seenSpin, setSeenSpin] = useState(null);
  const [evolved, setEvolved] = useState(null);
  const lastDna = useRef(null);
  const info = dnaInfo(view?.dna);
  useTimerAlerts(view, serverNow);

  useEffect(() => {
    if (!view) return;
    const sig = `${info.stage}:${info.style}`;
    if (lastDna.current && lastDna.current !== sig && info.stage > 0) setEvolved(info);
    lastDna.current = sig;
  }, [view, info]);

  useEffect(() => {
    if (view?.phase !== 'round') setOverlay(false);
  }, [view?.phase]);

  const live = view && (status === 'live' || status === 'reconnecting');
  const roomCode = view?.code || code;

  return (
    <div className="screen mx-auto flex min-h-[100dvh] max-w-md flex-col px-6">
      <header className="sticky top-0 z-20 -mx-6 bg-[var(--bg)]/90 px-6 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Leave room" className="icon-btn" onClick={onLeave}>
            <X size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[15px] font-semibold">{roomCode ? `Room ${roomCode}` : 'Room'}</div>
            <div className="muted text-[12px]">{status === 'live' ? (role === 'host' ? 'You’re hosting' : 'Connected') : status === 'reconnecting' ? 'Reconnecting…' : ' '}</div>
          </div>
          {live ? (
            <button type="button" onClick={() => setSheet('dna')} className="pill !h-10 !px-3" aria-label="Room DNA">
              <LevelDots stage={info.stage} />
              <span className="text-[13px]">{DNA_STYLES[info.style].short}</span>
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
        {live && <div className="hazard fx fx-kinetic fx-1 mt-3" />}
      </header>

      {status === 'connecting' && <Status busy title={role === 'host' ? 'Creating room' : `Joining room ${code}`} body={role === 'host' ? null : 'Connecting to the host’s phone…'} />}
      {status === 'error' && <Status title="Couldn’t connect" body={error || errorText()} onLeave={onLeave} />}
      {status === 'ended' && <Status title="Room closed" body="The host has ended this room." onLeave={onLeave} />}
      {status === 'kicked' && <Status title="Removed from room" body="The host removed you from this room." onLeave={onLeave} />}

      {live && (
        <main className="flex flex-1 flex-col pt-2">
          {view.phase === 'lobby' && <Lobby view={view} intent={intent} onInvite={() => setSheet('invite')} />}
          {view.phase === 'round' &&
            (seenSpin === view.round.spinId ? (
              <Mission view={view} serverNow={serverNow} intent={intent} onOverlay={() => setOverlay(true)} />
            ) : (
              <Spin key={view.round.spinId} view={view} serverNow={serverNow} onDone={() => setSeenSpin(view.round.spinId)} />
            ))}
          {view.phase === 'results' && <Results key={view.round.spinId} view={view} intent={intent} serverNow={serverNow} />}
        </main>
      )}

      {sheet === 'invite' && roomCode && <InviteSheet code={roomCode} onClose={() => setSheet(null)} />}
      {sheet === 'dna' && <DnaSheet info={info} onClose={() => setSheet(null)} />}
      {overlay && view?.phase === 'round' && <Overlay view={view} serverNow={serverNow} intent={intent} onClose={() => setOverlay(false)} />}
      {evolved && <Evolution info={evolved} onDone={() => setEvolved(null)} />}
    </div>
  );
}
