import { useCallback, useEffect, useState } from 'react';
import { getPolls } from '../api.js';

export default function PollList({ onSelect, onCreate }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      setPolls(await getPolls(signal));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!signal || !signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">Active polls</h1>

      {loading && (
        <div className="flex items-center gap-3 text-slate-500" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Loading polls&hellip;
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="mb-3 font-medium">Could not load polls</p>
          <p className="mb-3 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && polls.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="mb-4 text-slate-600">No polls yet. Be the first to create one!</p>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create a poll
          </button>
        </div>
      )}

      {!loading && !error && polls.length > 0 && (
        <ul className="space-y-3">
          {polls.map((poll) => (
            <li key={poll.id}>
              <button
                type="button"
                onClick={() => onSelect(poll.id)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow"
              >
                <span className="block font-semibold text-slate-900">{poll.question}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {poll.options.length} options &middot; {poll.totalVotes}{' '}
                  {poll.totalVotes === 1 ? 'vote' : 'votes'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
