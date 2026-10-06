import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

const INPUT_CLASS =
  'w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/**
 * One form for both flows.
 *   mode="login"  -> identifier (username or email) + password
 *   mode="signup" -> username + email + password + confirm
 */
export default function AuthForm({ mode, onSuccess, onSwitchMode }) {
  const { login, register } = useAuth();
  const isSignup = mode === 'signup';

  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function validate() {
    if (!isSignup) return '';
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      return 'Username must be 3-30 characters: letters, numbers and underscores only.';
    }
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (password !== confirm) return 'Passwords do not match.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (isSignup) {
        await register({ username: username.trim(), email: email.trim(), password });
      } else {
        await login({ identifier: identifier.trim(), password });
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">{isSignup ? 'Create your account' : 'Log in'}</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        {isSignup ? (
          <>
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                maxLength={30}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
                required
              />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="identifier" className="mb-1 block text-sm font-medium">
              Username or email
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              maxLength={255}
              onChange={(e) => setIdentifier(e.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
            required
          />
          {isSignup && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
        </div>

        {isSignup && (
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>

        <p className="text-center text-sm text-slate-600">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </section>
  );
}
