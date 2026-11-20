// Minimal GitHub GraphQL client built on Node's global fetch.
// Retries transient failures and rate limits; never logs tokens or payloads.

const ENDPOINT = 'https://api.github.com/graphql';
const USER_AGENT = 'profile-metrics (+https://github.com/htthinh1999/htthinh1999)';

export class GitHubAuthError extends Error {}

export class GitHubGraphQLError extends Error {
  constructor(errors) {
    const types = [...new Set(errors.map((e) => e.type || 'UNKNOWN'))].join(', ');
    super(`GitHub GraphQL returned ${errors.length} error(s): ${types}`);
    this.errors = errors;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient(
  token,
  { maxRetries = 4, timeoutMs = 45_000, log = () => {}, wait = sleep } = {},
) {
  if (!token) throw new GitHubAuthError('No GitHub token provided');

  async function request(query, variables) {
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (attempt >= maxRetries) throw error;
        await backoff(attempt, null, `network error (${error.name})`);
        continue;
      }

      if (response.status === 401) {
        throw new GitHubAuthError('GitHub rejected the token (401 Unauthorized)');
      }

      const retryable =
        response.status === 403 || response.status === 429 || response.status >= 500;
      if (retryable) {
        if (attempt >= maxRetries) {
          throw new Error(`GitHub API responded ${response.status} after ${attempt + 1} attempts`);
        }
        await backoff(attempt, response.headers, `HTTP ${response.status}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`GitHub API responded ${response.status}`);
      }

      return response.json();
    }
  }

  async function backoff(attempt, headers, reason) {
    const retryAfter = Number(headers?.get('retry-after'));
    const resetAt = Number(headers?.get('x-ratelimit-reset'));
    const remaining = headers?.get('x-ratelimit-remaining');
    let delay = Math.min(60_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
    if (Number.isFinite(retryAfter) && retryAfter > 0) delay = retryAfter * 1_000;
    else if (remaining === '0' && Number.isFinite(resetAt)) {
      delay = Math.max(delay, resetAt * 1_000 - Date.now() + 1_000);
    }
    delay = Math.min(delay, 5 * 60_000);
    log(`  ↻ ${reason}; retrying in ${Math.round(delay / 1000)}s`);
    await wait(delay);
  }

  return {
    /**
     * Runs a query. Partial results (data + errors) are tolerated when
     * `allowPartial` is set — e.g. an org repo hidden behind SAML SSO should
     * not sink the whole run. Error details are reduced to their `type` so
     * private repository names never reach public Actions logs.
     */
    async graphql(query, variables = {}, { allowPartial = false } = {}) {
      const body = await request(query, variables);
      if (body.errors?.length) {
        if (allowPartial && body.data) {
          const types = [...new Set(body.errors.map((e) => e.type || 'UNKNOWN'))].join(', ');
          log(`  ! skipped ${body.errors.length} inaccessible item(s): ${types}`);
          return body.data;
        }
        throw new GitHubGraphQLError(body.errors);
      }
      if (!body.data) throw new Error('GitHub GraphQL returned no data');
      return body.data;
    },
  };
}

/**
 * Picks the first token that authenticates. The personal token unlocks
 * private-repository aggregates; the workflow's GITHUB_TOKEN is a public-only
 * fallback so an expired PAT degrades the cards instead of breaking them.
 */
export async function resolveClient(candidates, { log = () => {}, ...clientOptions } = {}) {
  for (const { name, token } of candidates) {
    if (!token) continue;
    const client = createClient(token, { log, ...clientOptions });
    try {
      await client.graphql('query { rateLimit { remaining } }');
      log(`Using ${name} for GitHub API access`);
      return { client, tokenName: name };
    } catch (error) {
      if (error instanceof GitHubAuthError) {
        log(`! ${name} was rejected by GitHub; trying the next token`);
        continue;
      }
      throw error;
    }
  }
  throw new GitHubAuthError(
    'No usable GitHub token. Set METRICS_TOKEN (or GH_TOKEN) or run inside GitHub Actions.',
  );
}
