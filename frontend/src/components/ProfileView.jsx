import { useEffect, useState } from 'react';
import { getUser } from '../api.js';

const formatDate = (value) => new Date(value).toLocaleDateString();

export default function ProfileView({ userId, isSelf, onSelectPoll, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);
    getUser(userId, controller.signal)
      .then((data) => setProfile(data))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [userId]);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
    >
      &larr; Back to polls
    </button>
  );

  if (loading) {
    return (
      <section>
        {backButton}
        <div className="flex items-center gap-3 text-slate-500" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Loading profile&hellip;
        </div>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section>
        {backButton}
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error || 'Profile not found.'}
        </p>
      </section>
    );
  }

  return (
    <section>
      {backButton}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold uppercase text-white"
          >
            {profile.username.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {profile.username}
              {isSelf && <span className="ml-2 text-sm font-medium text-slate-500">(you)</span>}
            </h1>
            <p className="text-sm text-slate-500">Joined {formatDate(profile.createdAt)}</p>
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Polls created ({profile.polls.length})
      </h2>
      {profile.polls.length === 0 ? (
        <p className="text-sm text-slate-500">No polls yet.</p>
      ) : (
        <ul className="space-y-2">
          {profile.polls.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectPoll(p.id)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="block font-medium">{p.question}</span>
                <span className="text-xs text-slate-500">{formatDate(p.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
