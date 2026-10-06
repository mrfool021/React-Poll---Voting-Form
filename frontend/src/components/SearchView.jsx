import { useEffect, useState } from 'react';
import { searchAll } from '../api.js';

const formatDate = (value) => new Date(value).toLocaleDateString();

export default function SearchView({ query, onSelectPoll, onSelectUser }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    searchAll(query, controller.signal)
      .then((data) => setResults(data))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold">Search results</h1>
      <p className="mb-6 text-sm text-slate-500">
        Showing matches for <strong className="font-semibold">&ldquo;{query}&rdquo;</strong>
      </p>

      {loading && (
        <div className="flex items-center gap-3 text-slate-500" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Searching&hellip;
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && !error && results && (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Profiles ({results.users.length})
            </h2>
            {results.users.length === 0 ? (
              <p className="text-sm text-slate-500">No profiles match.</p>
            ) : (
              <ul className="space-y-2">
                {results.users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => onSelectUser(u.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="font-medium">{u.username}</span>
                      <span className="text-xs text-slate-500">Joined {formatDate(u.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Polls ({results.polls.length})
            </h2>
            {results.polls.length === 0 ? (
              <p className="text-sm text-slate-500">No polls match.</p>
            ) : (
              <ul className="space-y-2">
                {results.polls.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPoll(p.id)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="block font-medium">{p.question}</span>
                      <span className="text-xs text-slate-500">
                        {p.creator ? `by ${p.creator.username} · ` : ''}
                        {formatDate(p.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
