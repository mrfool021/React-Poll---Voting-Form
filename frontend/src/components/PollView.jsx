import { useCallback, useEffect, useState } from 'react';
import { getPoll, votePoll } from '../api.js';
import ResultsBar from './ResultsBar.jsx';

const NOTICE_STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  error: 'border-red-200 bg-red-50 text-red-800',
};

export default function PollView({ pollId, onBack, onSelectUser }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        setPoll(await getPoll(pollId, signal));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!signal || !signal.aborted) setLoading(false);
      }
    },
    [pollId]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleVote(event) {
    event.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setNotice(null);
    try {
      setPoll(await votePoll(pollId, selected));
      setVoted(true);
      setNotice({ type: 'success', text: 'Your vote was recorded. Thank you!' });
    } catch (err) {
      if (err.status === 409) {
        setVoted(true);
        setNotice({ type: 'info', text: err.message });
        try {
          setPoll(await getPoll(pollId));
        } catch {
          /* keep showing the previously loaded results */
        }
      } else {
        setNotice({ type: 'error', text: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

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
          Loading poll&hellip;
        </div>
      </section>
    );
  }

  if (error || !poll) {
    return (
      <section>
        {backButton}
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="mb-3 text-sm">{error || 'Poll not found.'}</p>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const topVotes = Math.max(...poll.options.map((o) => o.votes));
  const canVote = poll.isActive && !voted;

  return (
    <section>
      {backButton}
      <h1 className="mb-1 text-2xl font-bold">{poll.question}</h1>
      {poll.creator && (
        <p className="mb-1 text-sm text-slate-500">
          Created by{' '}
          {onSelectUser ? (
            <button
              type="button"
              onClick={() => onSelectUser(poll.creator.id)}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              {poll.creator.username}
            </button>
          ) : (
            poll.creator.username
          )}
        </p>
      )}
      <p className="mb-6 text-sm text-slate-500">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} in total
        {!poll.isActive && ' · This poll is closed'}
      </p>

      {notice && (
        <p
          role="status"
          className={`mb-5 rounded-md border p-3 text-sm ${NOTICE_STYLES[notice.type]}`}
        >
          {notice.text}
        </p>
      )}

      {canVote && (
        <form onSubmit={handleVote} className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Choose one option</legend>
            <div className="space-y-2">
              {poll.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="option"
                    value={option.id}
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={!selected || submitting}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit vote'}
          </button>
        </form>
      )}

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Results</h2>
        {poll.options.map((option) => (
          <ResultsBar
            key={option.id}
            label={option.label}
            votes={option.votes}
            total={poll.totalVotes}
            highlight={topVotes > 0 && option.votes === topVotes}
          />
        ))}
      </div>
    </section>
  );
}
