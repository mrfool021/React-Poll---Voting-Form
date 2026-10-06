export default function ResultsBar({ label, votes, total, highlight = false }) {
  const percent = total > 0 ? Math.round((votes / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className={highlight ? 'font-semibold text-slate-900' : 'text-slate-700'}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {votes} {votes === 1 ? 'vote' : 'votes'} &middot; {percent}%
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={`${label}: ${percent}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            highlight ? 'bg-indigo-600' : 'bg-indigo-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
