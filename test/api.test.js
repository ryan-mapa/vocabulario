import { describe, it, expect, afterEach } from 'vitest';
import { fetchMe, signOut } from '../source/api.js';

/** A stand-in Response — the module only reads ok, headers and json(). */
function respond({ ok = true, type = 'application/json', body = {} } = {}) {
  return {
    ok,
    headers: { get: (name) => (name === 'Content-Type' ? type : null) },
    json: async () => {
      if (typeof body === 'string') throw new SyntaxError('not JSON');
      return body;
    }
  };
}

const serve = (response) => {
  globalThis.fetch = async () => response;
};

afterEach(() => {
  delete globalThis.fetch;
});

describe('fetchMe', () => {
  it('reports a signed-in session', async () => {
    serve(respond({ body: { signedIn: true, name: 'Ryan' } }));
    expect(await fetchMe()).toEqual({ signedIn: true, name: 'Ryan' });
  });

  it('reports a signed-out one', async () => {
    serve(respond({ body: { signedIn: false } }));
    expect(await fetchMe()).toEqual({ signedIn: false });
  });

  // The three below are all the same situation: this copy of the app is served
  // from somewhere with no API behind it. None of them is an error, and the
  // caller has to be able to tell them apart from "signed out".
  it('returns null for a static host answering 404 with an HTML page', async () => {
    serve(respond({ ok: false, type: 'text/html', body: {} }));
    expect(await fetchMe()).toBeNull();
  });

  it('returns null for a host that answers 200 with something that is not ours', async () => {
    serve(respond({ type: 'text/html', body: {} }));
    expect(await fetchMe()).toBeNull();
  });

  it('returns null when the request cannot be made at all', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await fetchMe()).toBeNull();
  });

  it('returns null for JSON that is not a session answer', async () => {
    serve(respond({ body: { hello: 'world' } }));
    expect(await fetchMe()).toBeNull();
  });

  it('returns null for a body that claims JSON but is not', async () => {
    serve(respond({ body: 'not json at all' }));
    expect(await fetchMe()).toBeNull();
  });
});

describe('signOut', () => {
  it('posts to the logout route', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push([url, options.method]);
      return respond({ body: { signedIn: false } });
    };
    await signOut();
    expect(calls).toEqual([['/auth/logout', 'POST']]);
  });

  it('never throws, so the caller can always carry on and reload', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(signOut()).resolves.toBeUndefined();
  });
});
