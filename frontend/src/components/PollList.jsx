import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { getPolls } from '../api.js';
import { links } from '../router.js';
import Icon from './Icons.jsx';
import PollCard from './PollCard.jsx';

const TABS = [
  ['all', 'All polls'],
  ['following', 'Following'],
];

function SkeletonCard() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-video rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-6 w-4/5" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}

export default function PollList() {
  const { user } = useAuth();
  const [scope, setScope] = useState('all');
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      setPolls(await getPolls(scope, signal));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!signal || !signal.aborted) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section>
      {/* Hero */}
      <div className="card relative mb-8 overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <p className="section-title relative text-accent">Welcome back, {user.username}</p>
        <h1 className="relative mt-2 font-display text-3xl font-extrabold leading-tight sm:text-5xl">
          Settle every <span className="text-gradient">gaming debate.</span>
        </h1>
        <p className="relative mt-3 max-w-xl text-muted">
          Drop a poll, rally the squad and watch the results roll in live.
        </p>
        <a href={links.create()} className="btn-primary relative mt-5 w-full sm:w-auto">
          <Icon name="plus" className="h-4 w-4" /> Create a poll
        </a>
      </div>

      {/* Feed tabs */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Feed" className="inline-flex rounded-xl border border-line bg-surface/70 p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition ${
                scope === key ? 'bg-gradient-to-r from-brand to-accent text-brand-ink shadow-glow' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={() => load()} aria-label="Refresh polls" title="Refresh">
          <Icon name="refresh" />
        </button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3" role="status" aria-label="Loading polls">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="notice-error">
          <p className="mb-1 font-semibold">Could not load polls</p>
          <p className="mb-3">{error}</p>
          <button type="button" onClick={() => load()} className="btn-danger btn-sm">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && polls.length === 0 && (
        <div className="card border-dashed p-8 text-center sm:p-12">
          <p className="mb-4 text-muted">
            {scope === 'following'
              ? 'Nothing here yet. Follow some players and their polls will show up in this feed.'
              : 'No polls yet. Be the first to create one!'}
          </p>
          {scope === 'following' ? (
            <button type="button" onClick={() => setScope('all')} className="btn-primary">
              Browse all polls
            </button>
          ) : (
            <a href={links.create()} className="btn-primary">
              Create a poll
            </a>
          )}
        </div>
      )}

      {!loading && !error && polls.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {polls.map((poll, i) => (
            <li key={poll.id}>
              <PollCard poll={poll} index={i} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
