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

export async function signOut() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Nothing useful to do. The reload the caller does next will show the
    // real state either way.
  }
}
