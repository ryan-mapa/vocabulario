// Vocabulario's API. This Worker also serves the app's static files, so the
// page and the API share one origin: no CORS, and the session can live in an
// HttpOnly cookie. Any request matching a file is served before this handler
// ever runs.
//
// Signing in is optional and always will be. The app works fully signed out on
// localStorage, exactly as it did before this existed; an account only adds
// progress that follows you between devices.

import { signJwt, verifyJwt } from './auth.js';
import { sync } from './sync.js';

const SESSION_COOKIE = 'vocabulario_session';
const COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 600;
const MAX_NAME = 24;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

const fail = (message, status = 400) => json({ error: message }, status);

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function sessionCookie(value, maxAge) {
  // Lax rather than Strict: the browser arrives back from Google by a
  // top-level redirect, and Strict would withhold the cookie on that hop.
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * A name off an OAuth profile. Control characters go, whitespace collapses, so
 * a name cannot be padded out with invisible characters. An over-long one is
 * truncated rather than rejected: the person did not choose its length, and
 * rejecting would drop them onto the fallback for no reason.
 */
export function accountName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return null;
  return name.length <= MAX_NAME ? name : `${name.slice(0, MAX_NAME - 1).trimEnd()}…`;
}

function currentUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  return token ? verifyJwt(token, env.JWT_SECRET) : Promise.resolve(null);
}

// GET /me — lets the page show sign-in state without ever seeing the token.
async function whoAmI(request, env) {
  const user = await currentUser(request, env);
  return user ? json({ signedIn: true, name: user.name }) : json({ signedIn: false });
}

// GET /auth/google/start
async function authStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID) return fail('sign-in is not configured on this deployment', 503);

  const state = await signJwt({ purpose: 'oauth' }, env.JWT_SECRET, STATE_TTL_SECONDS);

  const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  target.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  target.searchParams.set('redirect_uri', new URL('/auth/google/callback', request.url).toString());
  target.searchParams.set('response_type', 'code');
  // openid + profile only. No email is requested, so none is ever stored.
  target.searchParams.set('scope', 'openid profile');
  target.searchParams.set('state', state);

  return Response.redirect(target.toString(), 302);
}

// Same-origin means a plain redirect works: no popup, nothing for a popup
// blocker to stop, and no token in storage a script could reach.
function backToApp(request, message, cookie = null) {
  const target = new URL('/', request.url);
  if (message) target.searchParams.set('auth', message);

  const headers = { Location: target.toString() };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers });
}

// GET /auth/google/callback
async function authCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !(await verifyJwt(state, env.JWT_SECRET))) return backToApp(request, 'failed');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: new URL('/auth/google/callback', request.url).toString()
    })
  });
  const { access_token: accessToken } = await tokenResponse.json().catch(() => ({}));
  if (!accessToken) return backToApp(request, 'failed');

  const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
    .then((response) => response.json())
    .catch(() => ({}));
  if (!profile.sub) return backToApp(request, 'failed');

  const displayName = accountName(profile.given_name || profile.name) || 'Learner';
  const userId = `google:${profile.sub}`;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, provider, provider_id, display_name, created_at)
       VALUES (?, 'google', ?, ?, ?)
       ON CONFLICT (provider, provider_id) DO UPDATE SET display_name = excluded.display_name`
    ).bind(userId, profile.sub, displayName, Date.now()),
    env.DB.prepare('INSERT OR IGNORE INTO profiles (user_id) VALUES (?)').bind(userId)
  ]);

  const token = await signJwt({ sub: userId, name: displayName }, env.JWT_SECRET, COOKIE_TTL_SECONDS);
  return backToApp(request, 'ok', sessionCookie(token, COOKIE_TTL_SECONDS));
}

const signOut = () => json({ signedIn: false }, 200, { 'Set-Cookie': sessionCookie('', 0) });

/**
 * POST /account/delete — remove the account and everything attached to it.
 *
 * Every table is named explicitly rather than leaning on ON DELETE CASCADE.
 * The privacy policy promises this deletion, and a promise should not rest on
 * a database pragma being in the state you assume: if foreign keys were ever
 * not enforced, a cascade would silently leave the history behind while
 * reporting success.
 *
 * The session cookie is cleared in the same response, so the browser cannot be
 * left holding a token for a user that no longer exists.
 */
async function deleteAccount(request, env) {
  const user = await currentUser(request, env);
  if (!user) return fail('sign in first', 401);

  const wipe = (table) =>
    env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(user.sub);

  await env.DB.batch([
    wipe('reviews'),
    wipe('cards'),
    wipe('imports'),
    wipe('rounds'),
    wipe('profiles'),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.sub)
  ]);

  return json({ deleted: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === 'GET' && pathname === '/me') return whoAmI(request, env);
    if (method === 'GET' && pathname === '/auth/google/start') return authStart(request, env);
    if (method === 'GET' && pathname === '/auth/google/callback') return authCallback(request, env);
    if (method === 'POST' && pathname === '/auth/logout') return signOut();
    if (method === 'POST' && pathname === '/account/delete') return deleteAccount(request, env);

    if (method === 'POST' && pathname === '/sync') {
      const user = await currentUser(request, env);
      if (!user) return fail('sign in to sync progress', 401);
      const { status, data } = await sync(request, env, user);
      return json(data, status);
    }

    // Anything else is a static-asset request that matched no file.
    return fail('not found', 404);
  }
};
