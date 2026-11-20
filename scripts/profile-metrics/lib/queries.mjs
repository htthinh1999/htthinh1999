// GraphQL documents. Every query here is validated against GitHub's published
// schema in test/queries.test.mjs, so a typo fails CI instead of the cron run.

export const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!) {
    user(login: $login) {
      id
      login
      name
      createdAt
      followers {
        totalCount
      }
      pullRequests {
        totalCount
      }
      issues {
        totalCount
      }
      publicRepos: repositories(ownerAffiliations: [OWNER], privacy: PUBLIC) {
        totalCount
      }
      privateRepos: repositories(ownerAffiliations: [OWNER], privacy: PRIVATE) {
        totalCount
      }
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

export const CONTRIBUTION_YEAR_QUERY = /* GraphQL */ `
  query ContributionYear($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

export const OWNED_REPOSITORIES_QUERY = /* GraphQL */ `
  query OwnedRepositories($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: [OWNER]
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          nameWithOwner
          isPrivate
          stargazerCount
          languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

// Lists every repository the user can push to and pulls the first page of
// their commits on the default branch in the same round trip.
export const COMMIT_REPOSITORIES_QUERY = /* GraphQL */ `
  query CommitRepositories($login: String!, $authorId: ID!, $cursor: String, $pageSize: Int!) {
    user(login: $login) {
      repositories(
        first: $pageSize
        after: $cursor
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          nameWithOwner
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100, author: { id: $authorId }) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    authoredDate
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const COMMIT_HISTORY_QUERY = /* GraphQL */ `
  query CommitHistory($owner: String!, $name: String!, $authorId: ID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $cursor, author: { id: $authorId }) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                authoredDate
              }
            }
          }
        }
      }
    }
  }
`;

export const ALL_QUERIES = {
  PROFILE_QUERY,
  CONTRIBUTION_YEAR_QUERY,
  OWNED_REPOSITORIES_QUERY,
  COMMIT_REPOSITORIES_QUERY,
  COMMIT_HISTORY_QUERY,
};
