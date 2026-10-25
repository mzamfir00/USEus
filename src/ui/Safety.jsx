// IRL safety warning: shown on first launch and before every outdoor or dark round.
import React from 'react';
import { TriangleAlert } from 'lucide-react';

const KEY = 'useus.safety.v1';
export const safetyAccepted = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
};
export const acceptSafety = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch (e) {
    /* private mode: ask again next launch */
  }
};

export default function SafetyGate({ onAgree, extra, onTerms }) {
  return (
    <div className="fade fixed inset-0 z-[95] grid place-items-center bg-black/90 px-6 text-white" role="alertdialog" aria-label="IRL safety warning" data-safety>
      <div className="pop w-full max-w-sm rounded-[28px] border-2 border-white bg-black px-6 pb-6 pt-7 text-center">
        <TriangleAlert size={34} className="mx-auto" />
        <div className="mt-3 text-[12px] font-semibold tracking-[0.18em] text-white/60">IRL SAFETY WARNING</div>
        <div className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.02em]">PLAY SAFELY</div>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">
          Always stay aware of your physical surroundings. Do not trespass, do not run near traffic or stairs in the dark, and obey all local laws.
        </p>
        {extra && <p className="mt-3 text-[13.5px] leading-snug text-white/70">{extra}</p>}
        <button type="button" className="btn mt-6 bg-white text-black" onClick={onAgree}>
          I Understand & Agree
        </button>
        {onTerms && (
          <button type="button" className="mt-2 h-10 text-[13px] text-white/60 underline underline-offset-4" onClick={onTerms}>
            Read the Terms of Use
          </button>
        )}
      </div>
    </div>
  );
}
