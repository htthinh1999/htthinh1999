import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collect } from '../lib/collect.mjs';
import {
  COMMIT_HISTORY_QUERY,
  COMMIT_REPOSITORIES_QUERY,
  CONTRIBUTION_YEAR_QUERY,
  OWNED_REPOSITORIES_QUERY,
  PROFILE_QUERY,
} from '../lib/queries.mjs';

const page = (nodes, endCursor = null) => ({
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
  nodes,
});
const history = (stamps, endCursor = null) => ({
  defaultBranchRef: { target: { history: page(stamps.map((authoredDate) => ({ authoredDate })), endCursor) } },
});

/** In-memory stand-in for the GitHub client, keyed by query document. */
function fakeClient() {
  const calls = [];
  const client = {
    calls,
    async graphql(query, variables) {
      calls.push({ query, variables });
      switch (query) {
        case PROFILE_QUERY:
          return {
            user: {
              id: 'U_1',
              login: 'octo',
              contributionsCollection: { contributionYears: [2026, 2025] },
            },
          };
        case CONTRIBUTION_YEAR_QUERY:
          return { user: { contributionsCollection: { year: 'from-api', from: variables.from } } };
        case OWNED_REPOSITORIES_QUERY:
          return variables.cursor
            ? { user: { repositories: page([{ nameWithOwner: 'octo/private-b' }]) } }
            : { user: { repositories: page([{ nameWithOwner: 'octo/private-a' }, null], 'c1') } };
        case COMMIT_REPOSITORIES_QUERY:
          return variables.cursor
            ? {
                user: {
                  repositories: page([
                    { nameWithOwner: 'octo/excluded', ...history(['2026-01-04T00:00:00Z']) },
                    { nameWithOwner: 'org/over-the-cap', ...history(['2026-01-05T00:00:00Z']) },
                  ]),
                },
              }
            : {
                user: {
                  repositories: page(
                    [
                      { nameWithOwner: 'octo/secret-app', ...history(['2026-01-01T00:00:00Z'], 'h1') },
                      { nameWithOwner: 'octo/empty', defaultBranchRef: null },
                      null, // e.g. hidden behind SAML SSO (partial response)
                    ],
                    'r1',
                  ),
                },
              };
        case COMMIT_HISTORY_QUERY:
          assert.equal(variables.owner, 'octo');
          assert.equal(variables.name, 'secret-app');
          return variables.cursor === 'h1'
            ? { repository: history(['2026-01-02T00:00:00Z'], 'h2') }
            : { repository: history(['2026-01-03T00:00:00Z']) };
        default:
          throw new Error('unexpected query');
      }
    },
  };
  return client;
}

test('collects contributions, repositories and paginated commit history', async () => {
  const client = fakeClient();
  const logs = [];
  const raw = await collect(
    client,
    { login: 'octo', rhythm: { excludeRepositories: ['OCTO/Excluded'], maxRepositories: 3 } },
    { log: (m) => logs.push(m), now: new Date('2026-06-01T00:00:00Z') },
  );

  assert.deepEqual(raw.contributionYears.map((y) => y.year), [2025, 2026]); // oldest first
  const yearCalls = client.calls.filter((c) => c.query === CONTRIBUTION_YEAR_QUERY);
  assert.equal(yearCalls[1].variables.to, '2026-06-01T00:00:00.000Z'); // current year ends now

  assert.deepEqual(raw.repositories.map((r) => r.nameWithOwner), ['octo/private-a', 'octo/private-b']);

  // secret-app: 3 pages; empty repo skipped; excluded repo skipped; 4th repo over the cap.
  assert.deepEqual(raw.commitTimestamps.sort(), [
    '2026-01-01T00:00:00Z',
    '2026-01-02T00:00:00Z',
    '2026-01-03T00:00:00Z',
  ]);
  assert.equal(
    client.calls.filter((c) => c.query === COMMIT_REPOSITORIES_QUERY).at(0).variables.authorId,
    'U_1',
  );

  // Actions logs are public: they must never mention repository names.
  const allLogs = logs.join('\n');
  for (const name of ['private-a', 'private-b', 'secret-app', 'empty', 'excluded', 'over-the-cap']) {
    assert.ok(!allLogs.includes(name), `log leaked "${name}"`);
  }
});

test('fails clearly when the user does not exist', async () => {
  const client = { graphql: async () => ({ user: null }) };
  await assert.rejects(collect(client, { login: 'ghost' }), /not found/);
});
