import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { GitHubAuthError, GitHubGraphQLError, createClient, resolveClient } from '../lib/github.mjs';

const realFetch = globalThis.fetch;
let responses;
let requests;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers });

beforeEach(() => {
  responses = [];
  requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (!next) throw new Error('no more mocked responses');
    return typeof next === 'function' ? next(init) : next;
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const noWait = { wait: async () => {} };

test('sends the query with a bearer token and returns data', async () => {
  responses.push(json(200, { data: { ok: true } }));
  const client = createClient('t0ken', noWait);
  assert.deepEqual(await client.graphql('query { ok }', { a: 1 }), { ok: true });
  assert.equal(requests[0].url, 'https://api.github.com/graphql');
  assert.equal(requests[0].auth, 'bearer t0ken');
  assert.deepEqual(requests[0].body, { query: 'query { ok }', variables: { a: 1 } });
});

test('retries rate limits and server errors, honouring retry-after', async () => {
  const waits = [];
  responses.push(json(502, {}), json(403, {}, { 'retry-after': '7' }), json(200, { data: { ok: 1 } }));
  const client = createClient('t', { wait: async (ms) => waits.push(ms) });
  assert.deepEqual(await client.graphql('query { ok }'), { ok: 1 });
  assert.equal(waits.length, 2);
  assert.equal(waits[1], 7_000);
});

test('gives up after maxRetries', async () => {
  responses.push(json(500, {}), json(500, {}), json(500, {}));
  const client = createClient('t', { ...noWait, maxRetries: 2 });
  await assert.rejects(client.graphql('query { ok }'), /500 after 3 attempts/);
});

test('raises GraphQL errors by type only, unless partial data is allowed', async () => {
  const body = { data: { user: { a: 1 } }, errors: [{ type: 'FORBIDDEN', message: 'org/secret-repo is SAML protected' }] };
  responses.push(json(200, body), json(200, body));
  const logs = [];
  const client = createClient('t', { ...noWait, log: (m) => logs.push(m) });

  const error = await client.graphql('query { user }').catch((e) => e);
  assert.ok(error instanceof GitHubGraphQLError);
  assert.doesNotMatch(error.message, /secret-repo/);

  assert.deepEqual(await client.graphql('query { user }', {}, { allowPartial: true }), { user: { a: 1 } });
  assert.doesNotMatch(logs.join('\n'), /secret-repo/);
});

test('resolveClient falls back to the next token when one is rejected', async () => {
  responses.push(json(401, { message: 'Bad credentials' }), json(200, { data: { rateLimit: { remaining: 1 } } }));
  const logs = [];
  const { tokenName } = await resolveClient(
    [
      { name: 'MISSING', token: undefined },
      { name: 'EXPIRED', token: 'old' },
      { name: 'FALLBACK', token: 'new' },
    ],
    { ...noWait, log: (m) => logs.push(m) },
  );
  assert.equal(tokenName, 'FALLBACK');
  assert.deepEqual(requests.map((r) => r.auth), ['bearer old', 'bearer new']);
  assert.doesNotMatch(logs.join('\n'), /old|new/);
});

test('resolveClient fails when no token works', async () => {
  responses.push(json(401, {}));
  await assert.rejects(resolveClient([{ name: 'A', token: 'x' }], noWait), GitHubAuthError);
});
