import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { getPoll, votePoll } from '../api.js';
import { links } from '../router.js';
import { plural, timeAgo } from '../utils.js';
import AuthImage from './AuthImage.jsx';
import Avatar from './Avatar.jsx';
import Comments from './Comments.jsx';
import Icon from './Icons.jsx';
import ResultsBar from './ResultsBar.jsx';

const NOTICE = { success: 'notice-success', info: 'notice-info', error: 'notice-error' };

const BackLink = () => (
  <a href={links.home()} className="btn-ghost -ml-3 mb-2 w-fit">
    <Icon name="arrowLeft" className="h-4 w-4" /> Back to polls
  </a>
);

export default function PollView({ pollId }) {
  const { user } = useAuth();
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
    setVoted(false);
    setSelected(null);
    setNotice(null);
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
      setNotice({ type: 'success', text: 'Your vote was recorded. GG!' });
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

  if (loading) {
    return (
      <section>
        <BackLink />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" role="status" aria-label="Loading poll">
          <div className="card space-y-4 p-6">
            <div className="skeleton h-48" />
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </div>
          <div className="card skeleton h-64" />
        </div>
      </section>
    );
  }

  if (error || !poll) {
    return (
      <section>
        <BackLink />
        <div role="alert" className="notice-error">
          <p className="mb-3">{error || 'Poll not found.'}</p>
          <button type="button" onClick={() => load()} className="btn-danger btn-sm">
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
      <BackLink />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ------------ Poll column ------------ */}
        <div className="space-y-5">
          <article className="card overflow-hidden">
            {poll.imageUrl && (
              <div className="flex max-h-[70vh] w-full items-center justify-center overflow-hidden bg-raised">
                <AuthImage
                  src={poll.imageUrl}
                  alt={`Image attached to the poll: ${poll.question}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>
            )}
            <div className="p-4 sm:p-6">
              {poll.creator && (
                <a href={links.user(poll.creator.id)} className="mb-3 flex w-fit items-center gap-2.5 text-sm text-muted hover:text-ink">
                  <Avatar user={poll.creator} size="md" />
                  <span>
                    <span className="block font-bold text-ink">{poll.creator.username}</span>
                    <span className="text-xs">{timeAgo(poll.createdAt)}</span>
                  </span>
                </a>
              )}
              <h1 className="break-words font-display text-2xl font-extrabold leading-tight sm:text-3xl">{poll.question}</h1>
              <p className="mt-2 text-sm text-muted">
                {plural(poll.totalVotes, 'vote')} in total
                {!poll.isActive && ' · This poll is closed'}
              </p>
            </div>
          </article>

          {notice && (
            <p role="status" className={NOTICE[notice.type]}>
              {notice.text}
            </p>
          )}

          {canVote && (
            <form onSubmit={handleVote} className="card p-4 sm:p-6">
              <fieldset>
                <legend className="section-title mb-3">Choose one option</legend>
                <div className="space-y-2">
                  {poll.options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                        selected === option.id ? 'border-brand bg-brand/10 shadow-glow' : 'border-line hover:border-brand/50 hover:bg-raised'
                      }`}
                    >
                      <input
                        type="radio"
                        name="option"
                        value={option.id}
                        checked={selected === option.id}
                        onChange={() => setSelected(option.id)}
                        className="h-5 w-5 shrink-0 accent-brand"
                      />
                      <span className="min-w-0 break-words">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" disabled={!selected || submitting} className="btn-primary mt-4 w-full sm:w-auto">
                {submitting ? 'Submitting…' : 'Submit vote'}
              </button>
            </form>
          )}

          <div className="card space-y-4 p-4 sm:p-6">
            <h2 className="section-title">Results</h2>
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
        </div>

        {/* ------------ Conversation column ------------ */}
        <Comments pollId={poll.id} key={poll.id} />
      </div>
    </section>
  );
}
