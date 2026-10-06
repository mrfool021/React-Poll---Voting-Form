'use strict';

/**
 * Input validation & sanitization helpers.
 *
 * Defense in depth:
 *  1. Every SQL statement is parameterized (see routes/polls.js)  -> SQL injection
 *  2. Text is sanitized here (tags / control characters removed)  -> stored XSS
 *  3. React escapes all rendered text on the client               -> XSS
 */

const LIMITS = {
  QUESTION_MIN: 5,
  QUESTION_MAX: 255,
  OPTION_MAX: 120,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 10,
};

const MAX_INT = 2147483647; // INT UNSIGNED columns are used, this is a conservative cap

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[<>]/g, '') // strip stray angle brackets
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // control characters -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns a positive integer or null. Accepts numbers and numeric strings only. */
function parseId(value) {
  const str = typeof value === 'number' ? String(value) : value;
  if (typeof str !== 'string' || !/^[1-9]\d{0,9}$/.test(str)) return null;
  const n = Number(str);
  return n <= MAX_INT ? n : null;
}

function validateNewPoll(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const question = sanitizeText(body.question);
  if (question.length < LIMITS.QUESTION_MIN || question.length > LIMITS.QUESTION_MAX) {
    errors.push(
      `question must be between ${LIMITS.QUESTION_MIN} and ${LIMITS.QUESTION_MAX} characters.`
    );
  }

  let options = [];
  if (!Array.isArray(body.options)) {
    errors.push('options must be an array of strings.');
  } else if (
    body.options.length < LIMITS.OPTIONS_MIN ||
    body.options.length > LIMITS.OPTIONS_MAX
  ) {
    errors.push(
      `options must contain between ${LIMITS.OPTIONS_MIN} and ${LIMITS.OPTIONS_MAX} items.`
    );
  } else {
    options = body.options.map(sanitizeText);
    if (options.some((o) => o.length < 1 || o.length > LIMITS.OPTION_MAX)) {
      errors.push(`each option must be between 1 and ${LIMITS.OPTION_MAX} characters.`);
    }
    const lowered = options.map((o) => o.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      errors.push('options must be unique.');
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], value: { question, options } };
}

// ---------------------------------------------------------------------------
// Authentication payloads
// ---------------------------------------------------------------------------
const AUTH_LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  EMAIL_MAX: 255,
  PASSWORD_MIN: 8,
  PASSWORD_MAX_BYTES: 72, // bcrypt silently ignores anything past 72 bytes
};

const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isPlainObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body);
}

function validateRegister(body) {
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const errors = [];

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (
    username.length < AUTH_LIMITS.USERNAME_MIN ||
    username.length > AUTH_LIMITS.USERNAME_MAX ||
    !USERNAME_RE.test(username)
  ) {
    errors.push(
      `username must be ${AUTH_LIMITS.USERNAME_MIN}-${AUTH_LIMITS.USERNAME_MAX} characters: letters, numbers and underscores only.`
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > AUTH_LIMITS.EMAIL_MAX || !EMAIL_RE.test(email)) {
    errors.push('email must be a valid email address.');
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (
    password.length < AUTH_LIMITS.PASSWORD_MIN ||
    Buffer.byteLength(password, 'utf8') > AUTH_LIMITS.PASSWORD_MAX_BYTES
  ) {
    errors.push(
      `password must be at least ${AUTH_LIMITS.PASSWORD_MIN} characters (max ${AUTH_LIMITS.PASSWORD_MAX_BYTES} bytes).`
    );
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], value: { username, email, password } };
}

/** `identifier` is either a username or an email address. */
function validateLogin(body) {
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!identifier || identifier.length > AUTH_LIMITS.EMAIL_MAX || !password || password.length > 256) {
    return { ok: false, errors: ['identifier and password are required.'] };
  }
  return { ok: true, errors: [], value: { identifier, password } };
}

module.exports = {
  LIMITS,
  AUTH_LIMITS,
  sanitizeText,
  parseId,
  validateNewPoll,
  validateRegister,
  validateLogin,
};
