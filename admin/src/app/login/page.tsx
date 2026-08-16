'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, tokens } from '@/lib/api';
import { changePassword, login, STAFF_ROLES } from '@/lib/admin';
import { Button, Field, Input } from '@/components/ui';

/**
 * Staff sign-in: email and password.
 *
 * Operations staff work at a desk, often on a shared machine — waiting for an
 * SMS every session is friction with no security benefit. Customers and drivers
 * still use OTP, where phone ownership is the thing being proven.
 *
 * A seeded or reset password lands the operator straight on a change form; they
 * cannot reach the console until it has been replaced.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'login' | 'change'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokens.get()) router.replace('/');
  }, [router]);

  const signIn = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(undefined);

    try {
      const session = await login(email.trim(), password);

      // The API already refuses non-staff, but the console checks too — a role
      // added server-side later should not silently gain access here.
      if (!STAFF_ROLES.includes(session.user.role)) {
        setError('This account does not have operations access.');
        return;
      }

      tokens.set({ accessToken: session.accessToken, refreshToken: session.refreshToken });

      if (session.mustChangePassword) {
        setStep('change');
        return;
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async () => {
    if (busy) return;
    if (newPassword !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setBusy(true);
    setError(undefined);

    try {
      await changePassword(password, newPassword);
      // Changing the password revokes other sessions; this one stays valid.
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-night px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <Image
            src="/img/logo.png"
            alt=""
            width={48}
            height={48}
            className="mx-auto h-12 w-12"
            priority
          />
          <h1 className="mt-4 font-display text-xl font-extrabold tracking-tight">
            {step === 'login' ? 'BinMan Operations' : 'Choose a new password'}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {step === 'login'
              ? 'Sign in with your staff account.'
              : 'Your account is on a temporary password. Set your own to continue.'}
          </p>
        </div>

        {step === 'login' ? (
          <>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && signIn()}
                placeholder="you@binman.com"
                autoFocus
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && signIn()}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-ink-500 hover:text-ink-800"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger-fg">
                {error}
              </p>
            ) : null}

            <Button
              onClick={signIn}
              disabled={!email.trim() || !password || busy}
              className="mt-5 w-full"
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>

            <p className="mt-5 text-center text-xs text-ink-500">
              Lost your password? Ask a super admin to reset it.
            </p>
          </>
        ) : (
          <>
            <Field
              label="New password"
              hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number."
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submitNewPassword()}
              />
            </Field>

            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger-fg">
                {error}
              </p>
            ) : null}

            <Button
              onClick={submitNewPassword}
              disabled={newPassword.length < 10 || !confirm || busy}
              className="mt-5 w-full"
            >
              {busy ? 'Saving…' : 'Set Password & Continue'}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
