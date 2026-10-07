'use strict';

/**
 * Shared SQL fragments + helpers so every endpoint renders users the same way
 * (id, username, avatarUrl).
 *
 * Avatar rules:
 *   uploaded avatar  -> "/api/users/:id/avatar?v=<etag>" (served by users.js, cache-busted)
 *   external URL     -> the https:// URL itself
 *   neither          -> null (the UI draws a coloured initial instead)
 */

// Join to append after "users <alias>" - exposes <ua>.etag as the avatar version
const joinAvatar = (userAlias = 'u', avatarAlias = 'ua') =>
  `LEFT JOIN user_avatars ${avatarAlias} ON ${avatarAlias}.user_id = ${userAlias}.id`;

function avatarUrlFor(id, externalUrl, etag) {
  if (etag) return `/api/users/${id}/avatar?v=${encodeURIComponent(etag)}`;
  return externalUrl || null;
}

/** Row aliases: <prefix>id, <prefix>username, <prefix>avatar_url, <prefix>avatar_ver */
function publicUserFromRow(row, prefix = '') {
  const id = row[`${prefix}id`];
  return {
    id,
    username: row[`${prefix}username`],
    avatarUrl: avatarUrlFor(id, row[`${prefix}avatar_url`], row[`${prefix}avatar_ver`]),
  };
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { joinAvatar, avatarUrlFor, publicUserFromRow, asyncHandler };
