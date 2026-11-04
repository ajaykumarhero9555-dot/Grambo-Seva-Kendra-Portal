import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, Lock, Mail, User, type LucideIcon } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
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
