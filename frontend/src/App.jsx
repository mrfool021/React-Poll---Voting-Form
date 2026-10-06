import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import PollList from './components/PollList.jsx';
import CreatePoll from './components/CreatePoll.jsx';
import PollView from './components/PollView.jsx';
import AuthForm from './components/AuthForm.jsx';
import SearchView from './components/SearchView.jsx';
import ProfileView from './components/ProfileView.jsx';
import Footer from './components/Footer.jsx';

const brandClass = 'text-xl font-bold text-indigo-600 hover:text-indigo-700';

export default function App() {
  const { user, checking, logout } = useAuth();

  // Tiny view-state router:
  //   { name: 'list' | 'create' | 'poll' | 'search' | 'profile', id?, q? }
  const [view, setView] = useState({ name: 'list' });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [searchText, setSearchText] = useState('');

  const goList = () => setView({ name: 'list' });
  const goPoll = (id) => setView({ name: 'poll', id });
  const goProfile = (id) => setView({ name: 'profile', id });

  function handleSearch(event) {
    event.preventDefault();
    const q = searchText.trim();
    if (q.length >= 2) setView({ name: 'search', q });
  }

  function handleLogout() {
    logout();
    setSearchText('');
    setAuthMode('login');
    goList();
  }

  // ---- 1. Checking a stored token on first load --------------------------
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <p role="status" className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Loading&hellip;
        </p>
      </div>
    );
  }

  // ---- 2. Logged out: login / sign up is the only thing available --------
  // (This also takes over if a token expires while the app is open.)
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <span className={brandClass}>Poll &amp; Voting</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <p className="mb-6 text-center text-slate-600">
            Log in or create an account to create polls, vote and search.
          </p>
          <AuthForm
            key={authMode}
            mode={authMode}
            onSuccess={goList}
            onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  // ---- 3. Logged in: the full app ----------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <button type="button" onClick={goList} className={brandClass}>
            Poll &amp; Voting
          </button>

          <form onSubmit={handleSearch} role="search" className="flex flex-1 basis-56 gap-2 sm:max-w-xs">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search polls and profiles"
              aria-label="Search polls and profiles"
              minLength={2}
              maxLength={50}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={searchText.trim().length < 2}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Search
            </button>
          </form>

          <nav className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goList}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Polls
            </button>
            <button
              type="button"
              onClick={() => setView({ name: 'create' })}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              New poll
            </button>
            <button
              type="button"
              onClick={() => goProfile(user.id)}
              title="View your profile"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {user.username}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {view.name === 'list' && (
          <PollList onSelect={goPoll} onCreate={() => setView({ name: 'create' })} />
        )}
        {view.name === 'create' && <CreatePoll onCreated={goPoll} onCancel={goList} />}
        {view.name === 'poll' && (
          <PollView pollId={view.id} onBack={goList} onSelectUser={goProfile} />
        )}
        {view.name === 'search' && (
          <SearchView query={view.q} onSelectPoll={goPoll} onSelectUser={goProfile} />
        )}
        {view.name === 'profile' && (
          <ProfileView
            userId={view.id}
            isSelf={view.id === user.id}
            onSelectPoll={goPoll}
            onBack={goList}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
