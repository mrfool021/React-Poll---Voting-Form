// Thin wrapper around fetch. The base path is relative ("/api") so the browser
// talks to the same origin that served the page (Nginx proxy in Docker, Vite
// dev-server proxy locally) - no hard-coded hosts, no CORS problems.
const BASE = import.meta.env.VITE_API_BASE || '/api';

// ---------------------------------------------------------------------------
// Token storage. localStorage keeps the user logged in across page reloads.
// Every access is wrapped in try/catch because storage can be unavailable
// (private windows, blocked site data).
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'playhub_token';
export const AUTH_EXPIRED_EVENT = 'playhub:auth-expired';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable - the session simply won't survive a reload */
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = getToken();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    // A 401 while holding a token means it expired or was revoked: drop it and
    // tell the app so the UI can switch back to the logged-out state.
    // (A failed login has no token yet, so it does not trigger this.)
    if (response.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const details = Array.isArray(data?.details) ? ` ${data.details.join(' ')}` : '';
    const error = new Error(`${data?.error || `Request failed (${response.status}).`}${details}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const getPolls = (scope, signal) =>
  request(`/polls${scope === 'following' ? '?scope=following' : ''}`, { signal });
export const getPoll = (id, signal) => request(`/polls/${id}`, { signal });
export const createPoll = (poll) => request('/polls', { method: 'POST', body: poll });
export const votePoll = (id, optionId) =>
  request(`/polls/${id}/vote`, { method: 'POST', body: { optionId } });

export const registerUser = (credentials) =>
  request('/auth/register', { method: 'POST', body: credentials });
export const loginUser = (credentials) =>
  request('/auth/login', { method: 'POST', body: credentials });
export const getMe = (signal) => request('/auth/me', { signal });

// ---- comments ------------------------------------------------------------
export const getComments = (pollId, { before, signal } = {}) =>
  request(`/polls/${pollId}/comments${before ? `?before=${before}` : ''}`, { signal });
export const postComment = (pollId, { body, parentId }) =>
  request(`/polls/${pollId}/comments`, { method: 'POST', body: { body, parentId } });
export const deleteComment = (pollId, commentId) =>
  request(`/polls/${pollId}/comments/${commentId}`, { method: 'DELETE' });

// ---- social graph --------------------------------------------------------
export const followUser = (id) => request(`/users/${id}/follow`, { method: 'POST' });
export const unfollowUser = (id) => request(`/users/${id}/follow`, { method: 'DELETE' });
export const getFollowList = (id, tab, page = 1, signal) =>
  request(`/users/${id}/${tab}?page=${page}`, { signal });

// ---- avatars -------------------------------------------------------------
export const setAvatarImage = (image) => request('/users/me/avatar', { method: 'PUT', body: { image } });
export const setAvatarUrl = (url) => request('/users/me/avatar', { method: 'PUT', body: { url } });
export const removeAvatar = () => request('/users/me/avatar', { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Protected images. <img src> cannot send an Authorization header, so photos
// and avatars served by the API are fetched with the token and shown through a
// blob: URL. Results are cached per URL (avatar URLs carry ?v=<etag>, so a new
// upload automatically gets a new cache entry).
// ---------------------------------------------------------------------------
const imageCache = new Map();

export function fetchImageUrl(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const promise = (async () => {
    const token = getToken();
    const response = await fetch(`${BASE.replace(/\/api$/, '')}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (response.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
    return URL.createObjectURL(await response.blob());
  })();
  imageCache.set(path, promise);
  promise.catch(() => imageCache.delete(path)); // allow a retry after a failure
  return promise;
}

export function clearImageCache() {
  for (const p of imageCache.values()) p.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  imageCache.clear();
}

export const searchAll = (q, signal) =>
  request(`/search?q=${encodeURIComponent(q)}`, { signal });
export const getUser = (id, signal) => request(`/users/${id}`, { signal });
