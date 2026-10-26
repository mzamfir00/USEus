// In-app Privacy Policy and Terms of Use. The same documents open without an account at
// ?legal=privacy and ?legal=terms, which is the public URL given to the app stores.
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_UPDATED, legalDocuments } from '../legal/content';
import { Sheet } from './primitives';

export const LEGAL = legalDocuments({ supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || null });

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
