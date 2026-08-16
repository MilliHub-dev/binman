'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, tokens } from '@/lib/api';
import { requestOtp, verifyOtp } from '@/lib/driver';

/**
 * Driver login (driver.md §1) — phone + OTP, the same auth every BinMan
 * account uses.
 *
 * Client-rendered rather than a server action: the session lives in
 * localStorage for the PWA, so the exchange has to happen in the browser.
 */
export default function DriverLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Already signed in — skip straight to the job list.
  useEffect(() => {
    if (tokens.get()) router.replace('/driver/jobs');
  }, [router]);

  const digits = phone.replace(/\D/g, '');
  const phoneValid = digits.length === 10 || digits.length === 11;

  const sendCode = async () => {
    if (!phoneValid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await requestOtp(digits);
      setStep('otp');
      if (result.debugCode) setCode(result.debugCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your code.');
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (code.length < 4 || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const session = await verifyOtp(digits, code);

      // The customer app and the driver app share one identity system, so an
      // ordinary customer could sign in here. Refuse it rather than showing
      // them an empty job list they cannot explain.
      if (!['DRIVER', 'CLEANER', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
        setError('This number is not registered as a BinMan driver.');
        return;
      }

      tokens.set({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      router.replace('/driver/jobs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <Image src="/img/logo.png" alt="BinMan" width={64} height={64} className="mx-auto h-16 w-16" priority />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Driver sign in</h1>
        <p className="mt-2 text-ink-600">
          {step === 'phone'
            ? 'Enter the phone number registered with BinMan.'
            : `Enter the code we sent to +234 ${digits.replace(/^0/, '')}`}
        </p>
      </div>

      {step === 'phone' ? (
        <>
          <label htmlFor="phone" className="mb-2 block text-sm font-semibold">
            Phone number
          </label>
          <div className="flex items-center rounded-xl border-2 border-ink-200 bg-white px-4 focus-within:border-brand">
            <span className="mr-2 text-ink-500">🇳🇬 +234</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && sendCode()}
              placeholder="801 234 5678"
              className="tap-target w-full bg-transparent text-lg outline-none"
            />
          </div>

          {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

          <button
            type="button"
            onClick={sendCode}
            disabled={!phoneValid || busy}
            className="tap-target mt-6 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-45"
          >
            {busy ? 'Sending…' : 'Send Code'}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="otp" className="mb-2 block text-sm font-semibold">
            Verification code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(event) => event.key === 'Enter' && signIn()}
            placeholder="000000"
            autoFocus
            className="tap-target w-full rounded-xl border-2 border-ink-200 bg-white px-4 text-center text-3xl font-bold tracking-[0.4em] outline-none focus:border-brand"
          />

          {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

          <button
            type="button"
            onClick={signIn}
            disabled={code.length < 4 || busy}
            className="tap-target mt-6 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-45"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError(undefined);
            }}
            className="tap-target mt-2 w-full text-ink-600"
          >
            Use a different number
          </button>
        </>
      )}
    </main>
  );
}
