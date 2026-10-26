import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { ageFromDob, logIn, MIN_AGE, normalizeEmail, normalizePhone, signUp } from '../lib/database';
import { useTheme } from '../theme';
import { LegalLinks, LegalSheet } from './Legal';
import { Button, Field, Labeled, Notice, Segmented, Select, Sheet, T, Title } from './primitives';

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
  let region = '';
  try {
    region = (Intl.DateTimeFormat().resolvedOptions().locale || '').split('-')[1]?.toUpperCase() || '';
  } catch (e) {
    region = '';
  }
  return COUNTRIES.find((c) => c[1] === region || (region === 'CA' && c[1] === 'US'))?.[0] || '+1';
};

export default function Auth({ invite, onAuthed, notice }) {
  const t = useTheme();
  const [mode, setMode] = useState('signup');
  const [legal, setLegal] = useState(null);
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

  const setDobPart = (k) => (value) => {
    const next = { ...dob, [k]: String(value) };
    const max = next.m && next.y ? new Date(Number(next.y), Number(next.m), 0).getDate() : 31;
    if (Number(next.d) > max) next.d = String(max);
    setDob(next);
    const iso = next.d && next.m && next.y ? `${next.y}-${String(next.m).padStart(2, '0')}-${String(next.d).padStart(2, '0')}` : '';
    // Strict gate: block the moment a full date under 16 is entered.
    if (iso && ageFromDob(iso) < MIN_AGE) setUnderage(true);
  };

  const submit = async () => {
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
  const ready = contactReady && password.length >= 4 && (mode === 'login' || (name.trim().length >= 2 && username.length >= 3 && dobIso));

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 36 }} testID="auth">
          <T size={44} w={700} ls={-2}>
            USEus
          </T>
          <T muted size={16} lh={1.35} style={{ marginTop: 8 }}>
            {invite ? `You're invited to room ${invite}. Sign in to join.` : 'The IRL party game. Every player on their own phone.'}
          </T>
          {notice ? (
            <Notice style={{ marginTop: 20 }} testID="notice">
              {notice}
            </Notice>
          ) : null}

          <Segmented
            style={{ marginTop: 40 }}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError('');
            }}
            options={[
              { value: 'signup', label: 'Create account', testID: 'mode-signup' },
              { value: 'login', label: 'Log in', testID: 'mode-login' },
            ]}
          />

          <View style={{ marginTop: 32, gap: 20 }}>
            {mode === 'signup' && (
              <>
                <Labeled label="Full name">
                  <Field value={name} onChangeText={setName} placeholder="Alex Rivera" autoComplete="name" textContentType="name" maxLength={40} testID="name" />
                </Labeled>
                <Labeled label="Username">
                  <Field
                    value={username}
                    onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20))}
                    placeholder="alexr"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    testID="username"
                    left={
                      <T muted size={17} style={{ marginRight: 4 }}>
                        @
                      </T>
                    }
                  />
                </Labeled>
              </>
            )}

            <View>
              <Segmented
                value={method}
                onChange={setMethod}
                options={[
                  { value: 'phone', label: 'Phone number', testID: 'method-phone' },
                  { value: 'email', label: 'Email', testID: 'method-email' },
                ]}
              />
              <View style={{ marginTop: 12 }}>
                {method === 'phone' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Select
                      label="Country code"
                      value={prefix}
                      onChange={setPrefix}
                      style={{ width: 112 }}
                      options={COUNTRIES.map(([code, iso, label]) => ({ value: code, label: `${iso} ${code} · ${label}`, short: `${iso} ${code}` }))}
                    />
                    <Field
                      style={{ flex: 1 }}
                      value={phone}
                      onChangeText={(v) => setPhone(v.replace(/[^\d\s]/g, '').slice(0, 16))}
                      placeholder="712 345 678"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      accessibilityLabel="Phone number"
                      testID="phone"
                    />
                  </View>
                ) : (
                  <Field
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    accessibilityLabel="Email"
                    testID="email"
                  />
                )}
              </View>
            </View>

            <Labeled label="PIN or password" hint={mode === 'signup' ? 'At least 4 characters. You’ll use it to log in on any device.' : null}>
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder="••••"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                testID="password"
                right={
                  <TouchableOpacity onPress={() => setShowPass((v) => !v)} accessibilityLabel={showPass ? 'Hide password' : 'Show password'} hitSlop={10}>
                    {showPass ? <EyeOff size={18} color={t.c.muted} /> : <Eye size={18} color={t.c.muted} />}
                  </TouchableOpacity>
                }
              />
            </Labeled>

            {mode === 'signup' && (
              <Labeled label="Date of birth" hint={`You must be ${MIN_AGE} or older.`}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Select
                    label="Day"
                    placeholder="Day"
                    value={dob.d}
                    onChange={setDobPart('d')}
                    style={{ flex: 1 }}
                    testID="dob-day"
                    options={Array.from({ length: daysInMonth }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  />
                  <Select
                    label="Month"
                    placeholder="Month"
                    value={dob.m}
                    onChange={setDobPart('m')}
                    style={{ flex: 1.6 }}
                    testID="dob-month"
                    options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                  />
                  <Select
                    label="Year"
                    placeholder="Year"
                    value={dob.y}
                    onChange={setDobPart('y')}
                    style={{ flex: 1.2 }}
                    testID="dob-year"
                    options={years.map((y) => ({ value: String(y), label: String(y) }))}
                  />
                </View>
              </Labeled>
            )}

            {error ? (
              <Notice testID="auth-error">
                <T size={14} accessibilityRole="alert">
                  {error}
                </T>
              </Notice>
            ) : null}

            <Button
              title={busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
              iconRight={busy ? null : ArrowRight}
              disabled={!ready || busy}
              onPress={submit}
              testID="submit"
              style={{ marginTop: 12 }}
            />
            <T muted size={12.5} lh={1.5} center style={{ paddingHorizontal: 8 }}>
              {mode === 'signup'
                ? 'By creating an account you confirm you are 16 or older and agree to the Terms of Use and Privacy Policy.'
                : 'Use the phone number or email you signed up with.'}
            </T>
            <LegalLinks onOpen={setLegal} style={{ marginTop: -8 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}

      {underage && (
        <Sheet onClose={() => setUnderage(false)} testID="underage">
          <View style={{ paddingVertical: 8, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: t.c.border, alignItems: 'center', justifyContent: 'center' }}>
              <T size={20} w={700}>
                {MIN_AGE}+
              </T>
            </View>
            <Title size={22} style={{ marginTop: 20, textAlign: 'center' }}>
              You must be at least {MIN_AGE} years old to play USEus.
            </Title>
            <T muted size={14} center style={{ marginTop: 8 }}>
              Registration is not available for this date of birth.
            </T>
            <Button
              title="OK"
              style={{ marginTop: 28, alignSelf: 'stretch' }}
              onPress={() => {
                setUnderage(false);
                setDob({ d: '', m: '', y: '' });
              }}
            />
          </View>
        </Sheet>
      )}
    </SafeAreaView>
  );
}
