# Profile metrics

Self-hosted replacement for WakaTime / `waka-readme-stats` and hosted stats
services. Everything is generated from the GitHub GraphQL API by a small,
dependency-free Node.js script and served as static SVGs.

| Image | Source | Rebuilt |
| --- | --- | --- |
| `header-*.svg`, `stack-*.svg` | `config.json` → `npm run assets` | when you edit the config (committed to `main`) |
| `overview-*.svg`, `languages-*.svg`, `rhythm-*.svg` | GitHub API → `npm run metrics` | daily by [`profile-metrics.yml`](../../.github/workflows/profile-metrics.yml), published to the `metrics` branch |

Every image has a `-dark` and `-light` variant; the README picks one with
`<picture>` and `prefers-color-scheme`, so it follows the viewer's GitHub theme.

## How the workflow runs

1. Runs daily at 00:23 (Asia/Ho_Chi_Minh), on manual dispatch, and on pushes to
   `main` that touch this folder.
2. `npm test` — unit tests plus validation of every GraphQL query against
   GitHub's published schema. A failure stops the run before anything is published.
3. `npm run metrics` — fetches the data and renders the cards.
4. Force-pushes the output as a single commit to the `metrics` branch, so `main`
   never collects bot commits. If a run fails, the previous cards stay live.

## Token

| Secret | Effect |
| --- | --- |
| `METRICS_TOKEN` (or the existing `GH_TOKEN`) | Includes private repositories in the aggregates. Classic PAT with `repo` and `read:user`, or a fine-grained PAT with read-only *Contents* and *Metadata* on all repositories. |
| none / expired | Falls back to the workflow's `GITHUB_TOKEN` automatically — public data only. |

Private repositories only ever contribute to totals (counts, languages, commit
times). Repository names are never logged, rendered or published, because
Actions logs on a public repository are public.

## Local development

```bash
npm ci
npm test
npm run preview          # renders sample data into dist/ — no token needed
npm run assets           # re-renders header + tech stack into assets/
METRICS_TOKEN=… npm run metrics -- --out dist   # live data
```

## Customising

Edit [`config.json`](config.json):

- `header` — greeting, name, the roles the typewriter cycles through, location, website
- `stack` — tech-stack rows and chips (icons resolve by name in `lib/stack.mjs`)
- `timeZone` — IANA zone used for the commit rhythm and streaks
- `languages.exclude` / `limit` / `sizeWeight` / `countWeight` — language ranking
- `rhythm.excludeRepositories` — `owner/name` entries to leave out of the commit rhythm
