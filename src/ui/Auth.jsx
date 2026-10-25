import React, { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { ageFromDob, logIn, MIN_AGE, normalizeEmail, normalizePhone, signUp } from '../lib/database';
import { Sheet } from './primitives';

const COUNTRIES = [
  ['+1', 'US', 'United States / Canada'],
  ['+44', 'GB', 'United Kingdom'],
  ['+40', 'RO', 'Romania'],
  ['+49', 'DE', 'Germany'],
  ['+33', 'FR', 'France'],
  ['+39', 'IT', 'Italy'],
  ['+34', 'ES', 'Spain'],
  ['+31', 'NL', 'Netherlands'],
  ['+353', 'IE', 'Ireland'],
  ['+48', 'PL', 'Poland'],
  ['+351', 'PT', 'Portugal'],
  ['+46', 'SE', 'Sweden'],
  ['+61', 'AU', 'Australia'],
  ['+91', 'IN', 'India'],
  ['+55', 'BR', 'Brazil'],
  ['+52', 'MX', 'Mexico'],
  ['+971', 'AE', 'UAE'],
  ['+27', 'ZA', 'South Africa'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const defaultPrefix = () => {
  const region = (navigator.language || '').split('-')[1]?.toUpperCase();
  return COUNTRIES.find((c) => c[1] === region || (region === 'CA' && c[1] === 'US'))?.[0] || '+1';
};

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block px-1">{label}</span>
      {children}
      {hint && <span className="muted mt-1.5 block px-1 text-[12.5px]">{hint}</span>}
    </label>
  );
}

export default function Auth({ invite, onAuthed }) {
  const [mode, setMode] = useState('signup');
  const [method, setMethod] = useState('phone');
  const [prefix, setPrefix] = useState(defaultPrefix);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState({ d: '', m: '', y: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [underage, setUnderage] = useState(false);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => now - i);
  }, []);
  const daysInMonth = dob.m && dob.y ? new Date(Number(dob.y), Number(dob.m), 0).getDate() : 31;
  const dobIso = dob.d && dob.m && dob.y ? `${dob.y}-${String(dob.m).padStart(2, '0')}-${String(dob.d).padStart(2, '0')}` : '';

  const setDobPart = (k) => (e) => {
    const next = { ...dob, [k]: e.target.value };
    const max = next.m && next.y ? new Date(Number(next.y), Number(next.m), 0).getDate() : 31;
    if (Number(next.d) > max) next.d = String(max);
    setDob(next);
    const iso = next.d && next.m && next.y ? `${next.y}-${String(next.m).padStart(2, '0')}-${String(next.d).padStart(2, '0')}` : '';
    // Strict gate: block the moment a full date under 16 is entered.
    if (iso && ageFromDob(iso) < MIN_AGE) setUnderage(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const fullPhone = normalizePhone(prefix, phone);
    const cleanEmail = normalizeEmail(email);
    if (mode === 'signup' && dobIso && ageFromDob(dobIso) < MIN_AGE) {
      setUnderage(true);
      return;
    }
    setBusy(true);
    try {
      const account =
        mode === 'signup'
          ? await signUp({ name, username, method, phone: fullPhone, email: cleanEmail, password, dob: dobIso })
          : await logIn({ method, phone: fullPhone, email: cleanEmail, password });
      onAuthed(account);
    } catch (err) {
      if (err.code === 'underage') setUnderage(true);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const contactReady = method === 'phone' ? phone.replace(/\D/g, '').length >= 6 : email.includes('@');
  const ready =
    contactReady && password.length >= 4 && (mode === 'login' || (name.trim().length >= 2 && username.length >= 3 && dobIso));

  return (
    <div className="screen mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-10 pt-[max(48px,env(safe-area-inset-top))]">
      <div className="enter">
        <div className="text-[44px] font-bold tracking-[-0.045em]">USEus</div>
        <p className="muted mt-2 text-[16px] leading-snug">
          {invite ? `You're invited to room ${invite}. Sign in to join.` : 'The IRL party game. Every player on their own phone.'}
        </p>
      </div>

      <div className="segmented mt-10" role="tablist">
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>
          Create account
        </button>
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>
          Log in
        </button>
      </div>

      <form key={mode} className="enter mt-8 space-y-5" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <>
            <Field label="Full name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" maxLength={40} />
            </Field>
            <Field label="Username">
              <div className="relative">
                <span className="muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[17px]">@</span>
                <input
                  className="field !pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20))}
                  placeholder="alexr"
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </div>
            </Field>
          </>
        )}

        <div>
          <div className="segmented">
            <button type="button" aria-pressed={method === 'phone'} onClick={() => setMethod('phone')}>
              Phone number
            </button>
            <button type="button" aria-pressed={method === 'email'} onClick={() => setMethod('email')}>
              Email
            </button>
          </div>
          <div className="mt-3">
            {method === 'phone' ? (
              <div className="flex gap-2">
                <select className="field !w-[104px] shrink-0 text-center" value={prefix} onChange={(e) => setPrefix(e.target.value)} aria-label="Country code">
                  {COUNTRIES.map(([code, iso, label]) => (
                    <option key={iso} value={code} title={label}>
                      {iso} {code}
                    </option>
                  ))}
                </select>
                <input
                  className="field tnum"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 16))}
                  placeholder="712 345 678"
                  inputMode="tel"
                  autoComplete="tel-national"
                  aria-label="Phone number"
                />
              </div>
            ) : (
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                aria-label="Email"
              />
            )}
          </div>
        </div>

        <Field label="PIN or password" hint={mode === 'signup' ? 'At least 4 characters. You’ll use it to log in on any device.' : null}>
          <div className="relative">
            <input
              className="field !pr-12"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              aria-label={showPass ? 'Hide password' : 'Show password'}
              onClick={() => setShowPass((v) => !v)}
              className="muted absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        {mode === 'signup' && (
          <Field label="Date of birth" hint={`You must be ${MIN_AGE} or older.`}>
            <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
              <select className="field" value={dob.d} onChange={setDobPart('d')} aria-label="Day">
                <option value="">Day</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select className="field" value={dob.m} onChange={setDobPart('m')} aria-label="Month">
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select className="field" value={dob.y} onChange={setDobPart('y')} aria-label="Year">
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        )}

        {error && (
          <div className="shake rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[14px]" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary !mt-8" disabled={!ready || busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
          {!busy && <ArrowRight size={18} />}
        </button>
        <p className="muted px-2 text-center text-[12.5px] leading-relaxed">
          {mode === 'signup' ? 'Your account is permanent — log back in any time with the same details.' : 'Use the phone number or email you signed up with.'}
        </p>
      </form>

      {underage && (
        <Sheet onClose={() => setUnderage(false)}>
          <div className="pb-2 pt-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--border)] text-[20px] font-bold">{MIN_AGE}+</div>
            <div className="headline mt-5 text-[22px]">You must be at least {MIN_AGE} years old to play USEus.</div>
            <p className="muted mt-2 text-[14px]">Registration is not available for this date of birth.</p>
            <button
              type="button"
              className="btn btn-primary mt-7"
              onClick={() => {
                setUnderage(false);
                setDob({ d: '', m: '', y: '' });
              }}
            >
              OK
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
