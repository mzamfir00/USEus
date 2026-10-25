import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ChevronLeft, Copy, QrCode, Share2, Volume2, VolumeX } from 'lucide-react';
import { DNA_STYLES } from '../game/constants';
import { dnaInfo } from '../game/engine';
import { Synth } from '../lib/sound';
import { errorText } from '../hooks/useRoom';
import { Briefing, SpinStage } from './Round';
import CameraView from './CameraView';
import Lobby from './Lobby';
import Results from './Results';
import { DnaBands, DnaMeter, IconBtn, Sheet } from './ui';

export const roomLink = (code) => `${window.location.origin}${import.meta.env.BASE_URL}?room=${code}`;

function QrSheet({ code, onClose }) {
  const [src, setSrc] = useState('');
  const [copied, setCopied] = useState(false);
  const link = roomLink(code);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 560, errorCorrectionLevel: 'M', color: { dark: '#09090B', light: '#FAFAFA' } }).then(setSrc);
  }, [link]);
  return (
    <Sheet title="Invite to room" onClose={onClose}>
      <div className="display tnum text-center text-[64px] tracking-[0.08em]">{code}</div>
      <div className="mx-auto mt-4 w-full max-w-[280px] bg-[#FAFAFA] p-3">{src && <img src={src} alt={`QR code to join room ${code}`} className="block w-full" />}</div>
      <div className="mono mt-4 break-all text-center text-[11px] text-[var(--zinc)]">{link}</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch (e) {
              setCopied(false);
            }
          }}
        >
          <Copy size={16} /> {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigator.share?.({ title: 'Squad Roulette', text: `Join my Squad Roulette room ${code}`, url: link }).catch(() => {})}
          disabled={!navigator.share}
        >
          <Share2 size={16} /> Share
        </button>
      </div>
    </Sheet>
  );
}

function Evolution({ info, onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    Synth.success();
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, []);
  const style = DNA_STYLES[info.style];
  return (
    <div className="fade fixed inset-0 z-[60] grid place-items-center bg-[var(--paper)] px-8 text-[var(--ink)]" onClick={onDone}>
      <div className="pop w-full max-w-sm">
        <div className="mono text-[11px] uppercase tracking-[0.3em] opacity-60">Room DNA evolved</div>
        <div className="display mt-4 text-[96px] leading-[0.85]">LV.{info.stage}</div>
        <div className="display mt-3 text-[clamp(26px,8.5vw,34px)]">{style.name}</div>
        <div className="mt-6 h-px bg-[var(--ink)] opacity-20" />
        <p className="mono mt-4 text-[12px] leading-relaxed opacity-70">{style.motto}</p>
      </div>
    </div>
  );
}

const StatusScreen = ({ title, body, onBack, busy }) => (
  <div className="flex flex-1 flex-col justify-center pb-20">
    <div className="label">{busy ? 'Status' : 'Room'}</div>
    <h2 className="display mt-3 text-[clamp(32px,10vw,44px)]">{title}</h2>
    {body && <p className="muted mt-3 text-[15px] leading-snug">{body}</p>}
    {busy && (
      <div className="mt-8 h-[2px] overflow-hidden bg-[var(--line)]">
        <div className="h-full w-1/3 bg-[var(--paper)]" style={{ animation: 'sr-march 1s linear infinite, sr-scan 1.2s ease-in-out infinite alternate' }} />
      </div>
    )}
    <button type="button" className="btn-ghost mt-10 w-full" onClick={onBack}>
      <ChevronLeft size={16} /> Back home
    </button>
  </div>
);

export default function RoomScreen({ room, code, muted, setMuted, onExit }) {
  const { status, view, error, transport, serverNow, intent, role } = room;
  const [qr, setQr] = useState(false);
  const [camera, setCamera] = useState(false);
  const [openSpin, setOpenSpin] = useState(null);
  const [evolved, setEvolved] = useState(null);
  const lastDna = useRef(null);

  const info = dnaInfo(view?.dna);
  useEffect(() => {
    if (!view) return;
    const sig = `${info.stage}:${info.style}`;
    if (lastDna.current && lastDna.current !== sig && info.stage > 0) setEvolved(info);
    lastDna.current = sig;
  }, [view, info]);

  useEffect(() => {
    if (view?.phase !== 'round') setCamera(false);
  }, [view?.phase]);

  const roomCode = view?.code || code;
  const live = status === 'live' && view;
  const localIds = view ? [view.me, ...(role === 'host' ? view.players.filter((p) => p.isBot).map((p) => p.id) : [])] : [];

  return (
    <div className="content mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="hdr relative border-b border-[var(--line)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <IconBtn label="Leave room" onClick={onExit}>
            <ChevronLeft size={18} />
          </IconBtn>
          <div className="hdr-title min-w-0 flex-1">
            <div className="display text-[22px]">Room #{roomCode || '····'}</div>
            <div className="mono mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--zinc)]">
              <span className={`dot ${status === 'live' ? 'blink' : 'bg-transparent border border-[var(--zinc)]'}`} />
              {status === 'live' ? 'Live' : status} {transport && `· ${transport === 'cloud' ? 'Supabase' : transport.replace('p2p', 'P2P').replace('cloud', 'Supabase')}`}
              {role === 'host' && ' · Host'}
            </div>
          </div>
          {live && (
            <IconBtn label="Invite / QR code" onClick={() => setQr(true)}>
              <QrCode size={18} />
            </IconBtn>
          )}
          <IconBtn label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </IconBtn>
        </div>
        {live && (
          <>
            <div className="mt-3">
              <DnaMeter info={info} />
            </div>
            <DnaBands code={roomCode} />
          </>
        )}
      </header>

      {status === 'reconnecting' && (
        <div className="mono mt-3 flex items-center gap-2 border border-[var(--paper)] px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          <span className="dot blink" /> Connection lost — reconnecting…
        </div>
      )}

      {status === 'connecting' && (
        <StatusScreen busy title={role === 'host' ? 'Opening room…' : `Joining #${code}…`} body={role === 'host' ? 'Reserving a room code on the network.' : 'Finding the host phone.'} onBack={onExit} />
      )}
      {status === 'error' && <StatusScreen title="Can't connect" body={error || errorText()} onBack={onExit} />}
      {status === 'ended' && <StatusScreen title="Room closed" body="The host has left this room." onBack={onExit} />}
      {status === 'kicked' && <StatusScreen title="Removed" body="The host removed you from this room." onBack={onExit} />}

      {view && (status === 'live' || status === 'reconnecting') && (
        <main className="flex flex-1 flex-col">
          {view.phase === 'lobby' && <Lobby view={view} intent={intent} onQr={() => setQr(true)} />}
          {view.phase === 'round' &&
            (openSpin === view.round.spinId ? (
              <Briefing view={view} serverNow={serverNow} intent={intent} localIds={localIds} onCamera={() => setCamera(true)} />
            ) : (
              <SpinStage key={view.round.spinId} view={view} serverNow={serverNow} onOpen={() => setOpenSpin(view.round.spinId)} />
            ))}
          {view.phase === 'results' && <Results key={view.round.spinId} view={view} intent={intent} serverNow={serverNow} />}
        </main>
      )}

      {qr && roomCode && <QrSheet code={roomCode} onClose={() => setQr(false)} />}
      {camera && view?.phase === 'round' && <CameraView view={view} serverNow={serverNow} onClose={() => setCamera(false)} />}
      {evolved && <Evolution info={evolved} onDone={() => setEvolved(null)} />}
    </div>
  );
}
