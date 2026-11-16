import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, Lock, Mail, User, type LucideIcon } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  type Auth,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureProfile } from '@/lib/firestore';
import { getAuthErrorMessage } from '@/lib/errors';

type Mode = 'signin' | 'signup';

interface AuthFormProps {
  title: string;
  subtitle: string;
}

export default function AuthForm({ title, subtitle }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);

  const isSignup = mode === 'signup';

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (isSignup && fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, { displayName: fullName.trim() });
        await ensureProfile(cred.user.uid, trimmedEmail, fullName.trim());
        setNotice('Your account has been created. Please sign in to continue.');
        await auth.signOut();
        switchMode('signin');
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 sm:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
        {(['signin', 'signup'] as Mode[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => switchMode(option)}
            className={`rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
              mode === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {option === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <Field icon={User} label="Full name" htmlFor="auth-name">
            <input
              id="auth-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="As it appears on your PAN card"
              required
            />
          </Field>
        )}
        <Field icon={Mail} label="Email" htmlFor="auth-email">
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field icon={Lock} label="Password" htmlFor="auth-password">
          <input
            id="auth-password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
            minLength={6}
            required
          />
        </Field>

        {!isSignup && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowReset(true);
                setError(null);
                setNotice(null);
              }}
              className="text-xs font-medium text-teal-700 transition-colors hover:text-teal-800"
            >
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-600/20">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {showReset && (
        <PasswordResetModal
          authInstance={auth}
          initialEmail={email}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20';

interface FieldProps {
  icon: LucideIcon;
  label: string;
  htmlFor: string;
  children: ReactNode;
}

function Field({ icon: Icon, label, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        {label}
      </label>
      {children}
    </div>
  );
}

interface PasswordResetModalProps {
  authInstance: Auth;
  initialEmail: string;
  onClose: () => void;
}

type ResetStep = 'request' | 'check-email' | 'enter-code' | 'new-password' | 'done';

function PasswordResetModal({ authInstance, initialEmail, onClose }: PasswordResetModalProps) {
  const [step, setStep] = useState<ResetStep>('request');
  const [resetEmail, setResetEmail] = useState(initialEmail.trim());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const captchaNumA = useRef(Math.floor(Math.random() * 8) + 2);
  const captchaNumB = useRef(Math.floor(Math.random() * 8) + 2);
  const captchaExpected = useRef(captchaNumA.current + captchaNumB.current);

  const verifyCaptcha = () => {
    if (parseInt(captchaAnswer, 10) === captchaExpected.current) {
      setCaptchaVerified(true);
      setResetError(null);
    } else {
      setResetError('Incorrect captcha answer. Please try again.');
      captchaNumA.current = Math.floor(Math.random() * 8) + 2;
      captchaNumB.current = Math.floor(Math.random() * 8) + 2;
      captchaExpected.current = captchaNumA.current + captchaNumB.current;
      setCaptchaAnswer('');
    }
  };

  const refreshCaptcha = () => {
    captchaNumA.current = Math.floor(Math.random() * 8) + 2;
    captchaNumB.current = Math.floor(Math.random() * 8) + 2;
    captchaExpected.current = captchaNumA.current + captchaNumB.current;
    setCaptchaAnswer('');
    setCaptchaVerified(false);
    setResetError(null);
  };

  const sendResetLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!captchaVerified) {
      setResetError('Please complete the captcha verification first.');
      return;
    }
    setBusy(true);
    setResetError(null);
    try {
      await sendPasswordResetEmail(authInstance, resetEmail, {
        url: window.location.origin,
        handleCodeInApp: true,
      });
      setResetNotice('A password reset link has been sent to your email. Click the link in the email to reset your password, then paste the code here.');
      setStep('check-email');
    } catch (cause) {
      setResetError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const proceedToCodeEntry = () => {
    setStep('enter-code');
    setResetNotice(null);
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setResetError(null);
    try {
      await verifyPasswordResetCode(authInstance, resetCode);
      setStep('new-password');
    } catch {
      setResetError('The code is invalid or has expired. Please request a new reset link.');
    } finally {
      setBusy(false);
    }
  };

  const setNewPasswordHandler = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setResetError(null);
    try {
      await confirmPasswordReset(authInstance, resetCode, newPassword);
      setStep('done');
    } catch (cause) {
      setResetError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="reset-title" className="text-lg font-semibold text-slate-900">Reset your password</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'request' && (
          <form onSubmit={sendResetLink} className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500">
              Enter your registered email address and complete the captcha to receive a password reset link.
            </p>
            <Field icon={Mail} label="Registered email" htmlFor="reset-email">
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Captcha verification
              </label>
              {!captchaVerified ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200">
                    <span className="font-mono text-lg font-semibold text-slate-800 select-none">
                      {captchaNumA.current} + {captchaNumB.current} = ?
                    </span>
                    <button type="button" onClick={refreshCaptcha} className="ml-auto text-xs font-medium text-teal-700 hover:text-teal-800">
                      Refresh
                    </button>
                  </div>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className={inputClass}
                    placeholder="Enter the answer"
                  />
                  <button
                    type="button"
                    onClick={verifyCaptcha}
                    disabled={!captchaAnswer}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                  >
                    Verify captcha
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Captcha verified
                </div>
              )}
            </div>

            {resetError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
                {resetError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Send reset link
            </button>
          </form>
        )}

        {step === 'check-email' && (
          <div className="space-y-4">
            {resetNotice && (
              <p role="status" className="rounded-lg bg-emerald-50 px-3 py-3 text-sm leading-relaxed text-emerald-700 ring-1 ring-emerald-600/20">
                {resetNotice}
              </p>
            )}
            <p className="text-sm leading-relaxed text-slate-500">
              Once you click the link in your email, you'll be redirected back here to enter a new password. If you already have the reset code, continue below.
            </p>
            <button
              type="button"
              onClick={proceedToCodeEntry}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800"
            >
              I have the code — enter it now
            </button>
            <button
              type="button"
              onClick={() => { setStep('request'); setResetNotice(null); refreshCaptcha(); }}
              className="w-full text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              Didn't receive it? Try again
            </button>
          </div>
        )}

        {step === 'enter-code' && (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500">
              Enter the reset code from the email link to continue.
            </p>
            <Field icon={Lock} label="Reset code" htmlFor="reset-code">
              <input
                id="reset-code"
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className={inputClass}
                placeholder="Paste the code from the email"
                required
              />
            </Field>
            {resetError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
                {resetError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Verify code
            </button>
          </form>
        )}

        {step === 'new-password' && (
          <form onSubmit={setNewPasswordHandler} className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500">
              Code verified. Choose a new password for your account.
            </p>
            <Field icon={Lock} label="New password" htmlFor="new-pass">
              <input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </Field>
            <Field icon={Lock} label="Confirm password" htmlFor="confirm-pass">
              <input
                id="confirm-pass"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter your new password"
                minLength={6}
                required
              />
            </Field>
            {resetError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
                {resetError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Reset password
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-600/20">
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-center text-sm font-medium text-slate-800">
                Your password has been reset successfully.
              </p>
              <p className="text-center text-xs text-slate-500">
                Please sign in with your new password.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
