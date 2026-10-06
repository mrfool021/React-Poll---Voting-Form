// VITE_BUILD_NUMBER is injected at build time (Docker build arg <- BUILD_NUMBER).
// Changing it and redeploying makes a new CI/CD release visible right here.
const BUILD = import.meta.env.VITE_BUILD_NUMBER || 'dev';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500">
        <span>Poll &amp; Voting App &middot; College final project</span>
        <span data-testid="build-label" className="rounded bg-slate-100 px-2 py-1 font-mono">
          Build: {BUILD}
        </span>
      </div>
    </footer>
  );
}
