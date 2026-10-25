// In-app Privacy Policy and Terms of Use. The same documents open without an account at
// ?legal=privacy and ?legal=terms, which is the public URL given to the app stores.
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Sheet } from './primitives';

export const LEGAL_UPDATED = 'October 25, 2026';
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL || null;
const contact = SUPPORT ? `email ${SUPPORT}` : 'use the support contact listed on the USEus store page';

const PRIVACY = {
  title: 'Privacy Policy',
  intro:
    'USEus is an in-person party game: every player uses their own phone as a controller and camera. This policy explains what the app collects, why, who can see it, and how to delete it. USEus has no ads, no analytics or tracking SDKs, and never sells personal data.',
  sections: [
    {
      h: 'Your account',
      p: [
        'When you sign up we store your name, @username, phone number or email, date of birth, and a one-way SHA-256 hash of your PIN or password (never the PIN itself). We also keep your XP, match history, friends list and unlocked room styles.',
        'Your date of birth is only used to confirm you are 16 or older. Other players can see your name, @username, stats and room style. They can never see your phone number, email, date of birth or PIN hash.',
      ],
    },
    {
      h: 'Camera',
      p: [
        'The camera shows your viewfinder and records clips during a round. Clips stay on your phone and are never uploaded to our servers. You decide whether to save or share them.',
        'Game photos (Paparazzi shots, Floor Is Lava proofs, TOMARE selfies) go straight to the other phones in your room during that round and are discarded when the room closes. Your phone also measures brightness and movement in the picture to detect a covered lens or a camera pan; this is analysed on your phone only.',
        'The flashlight is switched on and off by some games (candles, strobes, blackouts).',
      ],
    },
    {
      h: 'Microphone',
      p: [
        'In stealth games the noise meter measures how loud it is on your phone and only reports “noise” or “no noise” to the room. No audio is recorded or sent anywhere. If you turn on “Record sound” for a clip, the audio stays inside that clip on your phone.',
      ],
    },
    {
      h: 'Location',
      p: [
        'Location is only used when the host turns on the GPS Playzone or taps “Use my location” in the lobby.',
        'During a Playzone round your position goes to the host’s phone to check the boundary. It is shown to the other team only if you leave the zone or a radar ping exposes you. Everyone’s movement trail appears on that round’s results screen and is then discarded. Positions are never stored on our servers.',
        '“Use my location” sends the coordinates to OpenStreetMap Nominatim to look up a place name. Maps are drawn with CARTO map tiles.',
      ],
    },
    {
      h: 'Motion sensors',
      p: ['Accelerometer, gyroscope and compass readings are used on your phone only (Red Light, the Weeping Statue, Floor Is Lava, the Playzone compass).'],
    },
    {
      h: 'Rooms, matches and reports',
      p: [
        'Rooms store a code, the room’s style, and scores by @username. Match logs store the game, the location name the host typed, the result and the players’ usernames.',
        'If you report a player we store your username, theirs, the reason and your optional details so we can moderate. Players you block are hidden on your phone only.',
      ],
    },
    {
      h: 'Where data is stored',
      p: [
        'Everything is saved on your phone (LocalStorage and IndexedDB). When the cloud database is enabled, accounts, friendships, rooms, match logs and reports are also stored in a Supabase database so you can log in on any device.',
        'Live game messages travel phone-to-phone (WebRTC, connected through a PeerJS signalling server) or through Supabase Realtime. They are not stored.',
      ],
    },
    {
      h: 'Deleting your data',
      p: [
        'Profile → Delete Account Permanently erases your account, friendships, the rooms you hosted and their match logs, your username from other rooms’ scores and logs, and your reports. It does this in the cloud and on your phone, immediately. If your phone is offline, the cloud copy is erased the next time the app opens online.',
        'Clips live in memory and disappear when you close the app unless you saved them.',
      ],
    },
    {
      h: 'Children',
      p: ['USEus is for people aged 16 and over. Sign-up is blocked for younger dates of birth. Please report any player you believe is under 16.'],
    },
    {
      h: 'Your rights',
      p: [`You can access, correct, export or delete your data at any time. Delete it in the app, or ${contact} for anything else. We reply within 30 days.`],
    },
    {
      h: 'Changes',
      p: ['If this policy changes we will update the date at the top and show the new version in the app.'],
    },
  ],
};

const TERMS = {
  title: 'Terms of Use (16+)',
  intro: 'By creating an account or playing USEus you agree to these terms. Please read them — especially the safety rules.',
  sections: [
    { h: 'Age', p: ['You must be at least 16 years old to create an account or play.'] },
    {
      h: 'Play safely — you are responsible for yourself',
      p: [
        'USEus is played in the real world, often moving, in the dark or with eyes closed. Always stay aware of your surroundings. Do not trespass, do not run near traffic, water, stairs or drops, and obey all local laws and the rules of any venue.',
        'Never play while driving: in the Roadtrip arena only passengers play. Stop immediately if anyone is uncomfortable or at risk. You play at your own risk.',
      ],
    },
    {
      h: 'Consent and recording',
      p: [
        'Only film, photograph or track people who have agreed to play. Do not record bystanders or use the games to follow, harass or photograph anyone who is not playing. Respect privacy and recording laws where you play.',
      ],
    },
    {
      h: 'Community rules',
      p: [
        'No harassment, hate, threats, sexual content, nudity or content involving minors, and no cheating that ruins the game for others. Hosts can remove players from their room. Every player can block or report anyone.',
        'We review reports within 24 hours and remove content or accounts that break these rules.',
      ],
    },
    {
      h: 'Your content',
      p: ['Clips and photos you record are yours. You are responsible for what you save and share, including on other platforms.'],
    },
    {
      h: 'Your account',
      p: ['Keep your PIN private. You can delete your account at any time from Profile → Delete Account Permanently. We may suspend accounts that break these terms.'],
    },
    {
      h: 'No warranty',
      p: [
        'USEus is provided “as is”. Games depend on your phone’s camera, sensors, GPS and network, which can be inaccurate or unavailable. To the extent the law allows, we are not liable for injury, loss or damage arising from playing.',
      ],
    },
    { h: 'Contact', p: [`For questions about these terms, ${contact}.`] },
  ],
};

export const LEGAL = { privacy: PRIVACY, terms: TERMS };

function Document({ doc }) {
  const d = LEGAL[doc];
  return (
    <article className="pb-4" data-legal={doc}>
      <div className="muted text-[12.5px]">Last updated {LEGAL_UPDATED}</div>
      <p className="mt-3 text-[15px] leading-relaxed">{d.intro}</p>
      {d.sections.map((s) => (
        <section key={s.h} className="mt-6">
          <h3 className="text-[16px] font-semibold">{s.h}</h3>
          {s.p.map((para) => (
            <p key={para.slice(0, 40)} className="muted mt-2 text-[14.5px] leading-relaxed">
              {para}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

export function LegalSheet({ doc, onClose }) {
  return (
    <Sheet title={LEGAL[doc].title} onClose={onClose}>
      <Document doc={doc} />
      <button type="button" className="btn btn-primary mt-4" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}

// Standalone page for the store listing URL (no account needed).
export function LegalPage({ doc, onBack }) {
  return (
    <main className="screen mx-auto max-w-md px-6 pb-16 pt-[max(20px,var(--safe-top))]">
      <button type="button" className="muted -ml-1 flex h-10 items-center gap-1.5 text-[14px]" onClick={onBack}>
        <ArrowLeft size={17} /> USEus
      </button>
      <h1 className="title mt-3">{LEGAL[doc].title}</h1>
      <div className="mt-4">
        <Document doc={doc} />
      </div>
    </main>
  );
}

export function LegalLinks({ onOpen, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-4 text-[13px] ${className}`}>
      <button type="button" className="underline underline-offset-4" onClick={() => onOpen('privacy')}>
        Privacy Policy
      </button>
      <span className="muted">·</span>
      <button type="button" className="underline underline-offset-4" onClick={() => onOpen('terms')}>
        Terms of Use (16+)
      </button>
    </div>
  );
}
