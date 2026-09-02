// Talking to the Worker that serves this page. Every call is same-origin, so
// there is no CORS — and no token here for a script, or an XSS, to steal. The
// session lives in an HttpOnly cookie the page cannot read.
//
// The same files are also served from GitHub Pages and from the single-file
// build, and neither of those has an API behind it. So every call resolves to
// "there is no API here" rather than throwing, and the caller hides the
// account UI instead of showing something that cannot work.

export const SIGN_IN_PATH = '/auth/google/start';

/** JSON body, or null for any response that is not our API answering. */
async function readJson(response) {
  const type = response.headers.get('Content-Type') || '';
  if (!response.ok || !type.includes('application/json')) return null;
  return response.json().catch(() => null);
}

/**
 * `{ signedIn, name }` when an API is there, or `null` when there is not.
 * A 404 page from a static host is a perfectly ordinary answer here, not an
 * error — it just means this copy of the app has no accounts.
 */
export async function fetchMe() {
  let data;
  try {
    data = await readJson(await fetch('/me', { credentials: 'same-origin' }));
  } catch {
    return null; // offline, or a host that refuses the request outright
  }
  return typeof data?.signedIn === 'boolean' ? data : null;
}

/**
 * Push what this device has done and pull what every other device has, in one
 * request — the order matters. Because the push is folded before the pull
 * reads, the cards coming back already include the answers just sent, so the
 * response can never be a step behind what it was given.
 *
 * Returns null when there is no API, or the request failed. The caller keeps
 * the outbox in that case and tries again later.
 */
export async function sync(payload) {
  let data;
  try {
    data = await readJson(
      await fetch('/sync', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    );
  } catch {
    return null;
  }
  return data && typeof data.serverTime === 'number' ? data : null;
}

/**
 * Delete the account and everything attached to it. Returns true only when the
 * server confirms — the caller wipes local progress on the strength of that, so
 * guessing would leave someone thinking their data is gone when it is not.
 */
export async function deleteAccount() {
  try {
    const data = await readJson(
      await fetch('/account/delete', { method: 'POST', credentials: 'same-origin' })
    );
    return data?.deleted === true;
  } catch {
    return false;
  }
}

export async function signOut() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Nothing useful to do. The reload the caller does next will show the
    // real state either way.
  }
}
