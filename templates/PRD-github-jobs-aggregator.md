# PRD: GitHub Remote Jobs Aggregator

## Problem Statement

As a developer actively looking for remote work, I have to manually browse dozens of GitHub repositories (like `backend-br/vagas`, `frontendbr/vagas`, etc.) where companies post job openings as GitHub Issues. This is time-consuming, scattered, and easy to miss new postings. There is no single place that aggregates these postings, filters them by my skill set, and organizes them chronologically so I can see what's new each day.

## Solution

Build a standalone GitHub Remote Jobs Aggregator service that:
- Periodically fetches job postings (GitHub Issues) from a curated list of job board repos
- Filters postings by a configured set of keywords/technologies
- Organizes results day-by-day in a local JSON file
- Exposes a REST API to serve the aggregated jobs to a UI
- Uses Claude Code programmatically (`claude -p`) with WebSearch to discover new job repos over time
- Supports both scheduled (daily cron at 8am) and manual trigger runs

## User Stories

1. As a job seeker, I want to see all remote jobs posted today across multiple GitHub repos, so that I can quickly review new opportunities without visiting each repo manually.
2. As a job seeker, I want jobs filtered by my tech stack (Node.js, Go, PostgreSQL, React, Next.js, Angular), so that I only see relevant postings.
3. As a job seeker, I want jobs organized by date (newest first), so that I can track what's new each day.
4. As a job seeker, I want each job listing to include a direct apply link, so that I can apply with one click.
5. As a job seeker, I want to see the source repo for each job, so that I can understand the community/market the job comes from.
6. As a job seeker, I want jobs from the last 14 days to be retained, so that I don't miss postings from earlier in the week.
7. As a job seeker, I want only open issues to be shown, so that already-filled positions are automatically excluded.
8. As a job seeker, I want to manually trigger a job fetch at any time via an API call, so that I can get fresh results outside the scheduled run.
9. As a job seeker, I want the system to automatically discover new GitHub job board repos over time, so that coverage improves without manual maintenance.
10. As a job seeker, I want to query jobs for a specific date via the API, so that I can look back at postings from a particular day.
11. As a job seeker, I want jobs labeled "remote" to be prioritized or filterable, so that I'm not shown on-site-only roles.
12. As a job seeker, I want the list of tracked repos to be viewable via an API endpoint, so that I know which communities are being monitored.
13. As a job seeker, I want the system to run automatically every morning at 8am, so that fresh jobs are ready when I start my day.
14. As a job seeker, I want the job data persisted locally in JSON, so that I can access it even without re-fetching.
15. As a job seeker, I want each job to show its labels (e.g., remote, senior, contract), so that I can quickly assess fit.
16. As a job seeker, I want to configure my skill keywords via environment variables, so that filtering is consistent across runs without code changes.

## Implementation Decisions

### Modules

**1. GitHubService**
- Fetches issues from a given `owner/repo` via the GitHub REST API
- Accepts filters: state=open, created_after (14 days back), labels
- Returns normalized issue objects: title, url, labels, created_at, repo

**2. JobAggregatorService**
- Iterates over all tracked repos from `repos.json`
- Calls GitHubService for each repo
- Filters issues by keyword match (title + body against env keywords)
- Groups results by date (YYYY-MM-DD)
- Writes grouped output to `data/jobs.json`

**3. RepoDiscoveryService**
- Invokes `claude -p` programmatically with `--allowedTools WebSearch`
- Searches for GitHub Issues-based job board repos
- Parses Claude's output to extract new `owner/repo` entries
- Appends newly discovered repos to `repos.json` (deduped)
- Runs independently (e.g., weekly or on-demand)

**4. DailyFetcherJob**
- Uses `node-cron` to schedule JobAggregatorService at 8am daily
- Starts automatically when the server boots

**5. JobsController**
- `GET /jobs` — returns full `data/jobs.json`
- `GET /jobs/:date` — returns jobs for a specific date (format: YYYY-MM-DD)
- `POST /jobs/trigger` — manually triggers a full aggregation run

**6. ReposController**
- `GET /repos` — returns the current list of tracked repos from `repos.json`

### Architecture Decisions

- **Stack:** TypeScript + Express + Node.js
- **Storage:** Local JSON files (`data/jobs.json`, `data/repos.json`) — no database
- **Keywords:** Stored in `.env` as `KEYWORDS=NODEJS,GOLANG,POSTGRES,REACTJS,NEXTJS,ANGULAR`
- **Lookback window:** 14 days, configurable via `DAYS_BACK=14` in `.env`
- **GitHub auth:** `GITHUB_TOKEN` in `.env` to avoid rate limiting
- **Repo discovery:** Claude Code CLI (`claude -p`) used only for repo discovery, not issue fetching
- **JSON structure:** Jobs grouped by date key

### API Contracts

`GET /jobs` response:
```json
{
  "2026-04-07": [
    {
      "title": "Senior Node.js Developer - Remote",
      "repo": "backend-br/vagas",
      "url": "https://github.com/backend-br/vagas/issues/1234",
      "labels": ["remote", "senior"],
      "postedAt": "2026-04-07T09:00:00Z"
    }
  ]
}
```

`GET /repos` response:
```json
[
  { "owner": "backend-br", "repo": "vagas" },
  { "owner": "frontendbr", "repo": "vagas" }
]
```

`POST /jobs/trigger` response:
```json
{ "status": "ok", "jobsFetched": 42, "ranAt": "2026-04-07T08:00:00Z" }
```

### Folder Structure

```
github-jobs-aggregator/
├── src/
│   ├── controllers/
│   │   ├── JobsController.ts
│   │   └── ReposController.ts
│   ├── services/
│   │   ├── GitHubService.ts
│   │   ├── JobAggregatorService.ts
│   │   └── RepoDiscoveryService.ts
│   ├── jobs/
│   │   └── DailyFetcherJob.ts
│   ├── config/
│   │   └── env.ts
│   ├── app.ts
│   └── server.ts
├── data/
│   ├── jobs.json          ← gitignored
│   └── repos.json
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Testing Decisions

### What makes a good test
- Tests verify observable behavior (API response shape, JSON output) not internal implementation details
- GitHub API calls are mocked to avoid rate limits and flakiness in CI
- Integration tests use fixture JSON files rather than live API calls

### Modules to test
- **GitHubService** — unit: mock GitHub API, verify normalization and date filtering logic
- **JobAggregatorService** — unit: mock GitHubService, verify keyword filtering and date grouping
- **JobsController** — integration: seed a `jobs.json` fixture, verify API response shape and date-slice endpoint

### Modules tested manually
- **RepoDiscoveryService** — depends on Claude CLI and live web search
- **DailyFetcherJob** — cron scheduling verified via `POST /jobs/trigger`

## Out of Scope

- User authentication or multi-user support
- Database storage (intentionally JSON-only)
- Email/notification delivery of daily digest
- AI-powered job relevance scoring or ranking
- Frontend UI (API-only; UI is a future phase)
- Support for non-GitHub job sources (LinkedIn, Indeed, etc.)

## Further Notes

### Starter repos to seed in `repos.json`
| Repo | Focus |
|---|---|
| `backend-br/vagas` | Backend (Brazil/global) |
| `frontendbr/vagas` | Frontend (Brazil/global) |
| `CollabCodeTech/vagas` | Full-stack |
| `remoteintech/remote-jobs` | Remote-only companies |
| `jessicard/remote-jobs` | Remote-only companies |
| `vuejs-br/vagas` | Vue.js |
| `golang-cafe/jobs` | Go lang |

### Claude Code repo discovery command
```bash
claude -p "Search GitHub for repositories where companies post job openings as GitHub Issues, similar to backend-br/vagas. Return a JSON array of owner/repo strings." \
  --allowedTools WebSearch \
  --bare \
  --output-format json
```

### Day 1–4 Build Plan
| Day | Goal |
|---|---|
| Day 1 | Project scaffold + GitHubService + fetch from starter repos |
| Day 2 | JobAggregatorService (filter + group) + RepoDiscoveryService |
| Day 3 | Cron job + REST API (JobsController + ReposController) |
| Day 4 | Simple UI — day-wise accordion with apply links |
