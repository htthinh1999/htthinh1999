import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validate } from '@octokit/graphql-schema';

import { ALL_QUERIES } from '../lib/queries.mjs';

for (const [name, query] of Object.entries(ALL_QUERIES)) {
  test(`${name} is valid against GitHub's GraphQL schema`, () => {
    const errors = validate(query).map((error) => error.message);
    assert.deepEqual(errors, []);
  });
}

test('the token probe query is valid', () => {
  assert.deepEqual(validate('query { rateLimit { remaining } }'), []);
});
