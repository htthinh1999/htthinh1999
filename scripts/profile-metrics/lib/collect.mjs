// Fetches the raw data the cards are built from. Only aggregates leave this
// module's callers: repository names are used for pagination and exclusion,
// never logged or written to disk (Actions logs on a public repo are public).

import {
  COMMIT_HISTORY_QUERY,
  COMMIT_REPOSITORIES_QUERY,
  CONTRIBUTION_YEAR_QUERY,
  OWNED_REPOSITORIES_QUERY,
  PROFILE_QUERY,
} from './queries.mjs';

const REPO_PAGE_SIZE = 20; // repositories per page when also pulling commit history
const HISTORY_CONCURRENCY = 4;

export async function collect(client, config, { log = () => {}, now = new Date() } = {}) {
  const { login } = config;

  log('Fetching profile…');
  const { user } = await client.graphql(PROFILE_QUERY, { login });
  if (!user) throw new Error(`GitHub user "${login}" was not found`);

  const years = [...user.contributionsCollection.contributionYears].sort((a, b) => a - b);
  log(`Fetching contributions for ${years.length} year(s)…`);
  const contributionYears = [];
  for (const year of years) {
    const from = `${year}-01-01T00:00:00Z`;
    const to =
      year === now.getUTCFullYear() ? now.toISOString() : `${year}-12-31T23:59:59Z`;
    const data = await client.graphql(CONTRIBUTION_YEAR_QUERY, { login, from, to });
    contributionYears.push({ ...data.user.contributionsCollection, year });
  }

  log('Fetching owned repositories…');
  const repositories = await paginate(async (cursor) => {
    const data = await client.graphql(OWNED_REPOSITORIES_QUERY, { login, cursor });
    return data.user.repositories;
  });
  log(`  ${repositories.length} non-fork repositories`);

  log('Fetching commit timestamps…');
  const commitTimestamps = await collectCommitTimestamps(client, config, user.id, log);
  log(`  ${commitTimestamps.length} commits analysed`);

  return { user, contributionYears, repositories, commitTimestamps };
}

async function collectCommitTimestamps(client, config, authorId, log) {
  const { login } = config;
  const exclude = new Set((config.rhythm?.excludeRepositories ?? []).map((r) => r.toLowerCase()));
  const maxRepositories = config.rhythm?.maxRepositories ?? 400;

  const timestamps = [];
  const followUps = [];
  let cursor = null;
  let scanned = 0;

  do {
    const data = await client.graphql(
      COMMIT_REPOSITORIES_QUERY,
      { login, authorId, cursor, pageSize: REPO_PAGE_SIZE },
      { allowPartial: true },
    );
    const page = data.user.repositories;
    for (const repo of page.nodes) {
      if (!repo || scanned >= maxRepositories) continue;
      scanned += 1;
      if (exclude.has(repo.nameWithOwner.toLowerCase())) continue;
      const history = repo.defaultBranchRef?.target?.history;
      if (!history) continue; // empty repository or non-commit target
      for (const node of history.nodes) timestamps.push(node.authoredDate);
      if (history.pageInfo.hasNextPage) {
        followUps.push({ nameWithOwner: repo.nameWithOwner, cursor: history.pageInfo.endCursor });
      }
    }
    cursor = page.pageInfo.hasNextPage && scanned < maxRepositories ? page.pageInfo.endCursor : null;
  } while (cursor);

  log(`  ${scanned} repositories scanned, ${followUps.length} need more history pages`);

  await mapWithConcurrency(followUps, HISTORY_CONCURRENCY, async ({ nameWithOwner, cursor: start }) => {
    const [owner, name] = nameWithOwner.split('/');
    let after = start;
    while (after) {
      const data = await client.graphql(
        COMMIT_HISTORY_QUERY,
        { owner, name, authorId, cursor: after },
        { allowPartial: true },
      );
      const history = data.repository?.defaultBranchRef?.target?.history;
      if (!history) break;
      for (const node of history.nodes) timestamps.push(node.authoredDate);
      after = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null;
    }
  });

  return timestamps;
}

async function paginate(fetchPage) {
  const items = [];
  let cursor = null;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.nodes.filter(Boolean));
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

async function mapWithConcurrency(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}
