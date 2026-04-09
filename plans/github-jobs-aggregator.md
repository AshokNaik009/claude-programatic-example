# Plan: GitHub Remote Jobs Aggregator

> Source PRD: `templates/PRD-github-jobs-aggregator.md`

## Architectural Decisions

Durable decisions that apply across all phases:

- **Routes**: `GET /jobs`, `GET /jobs/:date`, `POST /jobs/trigger`, `GET /repos`, `POST /repos/discover`
- **Storage**: Local JSON files only — `data/jobs.json` (gitignored), `data/repos.json`
- **Job schema**: `{ title, repo, url, labels, postedAt }` grouped under `"YYYY-MM-DD"` date keys
- **Repo schema**: `[{ owner, repo }]` flat array
- **Config**: All tunables (`KEYWORDS`, `DAYS_BACK`, `GITHUB_TOKEN`) live in `.env`
- **Stack**: TypeScript + Express + Node.js — no database, no ORM
- **Keyword matching**: Case-insensitive match against issue title + body
- **Lookback window**: 14 days (configurable via `DAYS_BACK`)
- **Cron schedule**: Daily at 8am local time
- **Repo discovery**: Claude Code CLI (`claude -p --allowedTools WebSearch --bare`) — output parsed as JSON

---

## Phase 1: Fetch & Persist

**User stories**: 1, 4, 5, 7, 14

### What to build

Scaffold the full project structure and implement the end-to-end path from GitHub API to local JSON file. Starting from the hardcoded starter repos list, fetch all open issues created in the last 14 days from each repo and write the raw normalized results to `data/jobs.json`. No filtering yet — just prove the pipeline works.

Starter repos to seed in `data/repos.json`:
- `backend-br/vagas`
- `frontendbr/vagas`
- `CollabCodeTech/vagas`
- `remoteintech/remote-jobs`
- `jessicard/remote-jobs`
- `vuejs-br/vagas`
- `golang-cafe/jobs`

### Acceptance criteria

- [ ] Project runs with `npm run dev` without errors
- [ ] `.env.example` documents all required variables (`GITHUB_TOKEN`, `KEYWORDS`, `DAYS_BACK`)
- [ ] Running the fetch script writes valid JSON to `data/jobs.json`
- [ ] Each job entry contains: `title`, `repo`, `url`, `labels`, `postedAt`
- [ ] Only open issues are included
- [ ] Issues older than 14 days are excluded
- [ ] `data/jobs.json` is gitignored

---

## Phase 2: Filter & Group by Date

**User stories**: 2, 3, 6, 10, 11, 15, 16

### What to build

Transform the raw fetched issues into the final shape. Apply keyword filtering against issue title and body using the `KEYWORDS` env var. Detect and include the "remote" label. Group the filtered results by `YYYY-MM-DD` date keys, sorted newest-first. The output replaces `data/jobs.json` with the final structured format.

### Acceptance criteria

- [ ] `data/jobs.json` is keyed by `YYYY-MM-DD` with newest date first
- [ ] Only issues whose title or body contains at least one configured keyword are included
- [ ] Each job entry includes a `labels` array reflecting all GitHub labels on the issue
- [ ] Issues older than `DAYS_BACK` days are not present
- [ ] Changing `KEYWORDS` in `.env` and re-running changes which jobs appear
- [ ] A job with the "remote" label is present in results when it matches a keyword

---

## Phase 3: REST API

**User stories**: 1, 8, 10, 12

### What to build

Wire up the Express server with four endpoints that read from the local JSON files. No fetching happens at request time — endpoints are purely reads from `data/jobs.json` and `data/repos.json`, except `POST /jobs/trigger` which runs a full aggregation synchronously and returns a summary.

### Acceptance criteria

- [ ] `GET /jobs` returns the full date-grouped jobs object
- [ ] `GET /jobs/2026-04-07` returns only the array for that date (404 if date not found)
- [ ] `POST /jobs/trigger` runs aggregation, updates `data/jobs.json`, returns `{ status, jobsFetched, ranAt }`
- [ ] `GET /repos` returns the array of tracked repos from `data/repos.json`
- [ ] All endpoints return `Content-Type: application/json`
- [ ] Server starts cleanly with `npm run dev`

---

## Phase 4: Scheduling + Automation

**User stories**: 8, 13

### What to build

Add a cron job that fires the same aggregation logic as `POST /jobs/trigger` automatically at 8am daily when the server is running. No new API surface — this phase is purely about wiring the scheduler to the existing aggregation flow.

### Acceptance criteria

- [ ] Server boots and logs confirmation that the daily job is scheduled
- [ ] Aggregation runs automatically at 8am without any manual intervention
- [ ] Manual trigger via `POST /jobs/trigger` still works independently of the cron schedule
- [ ] Cron schedule is logged with timestamp when it fires

---

## Phase 5: Repo Discovery via Claude Code

**User stories**: 9

### What to build

Add a `POST /repos/discover` endpoint that programmatically invokes `claude -p` with `--allowedTools WebSearch` to search for new GitHub Issues-based job board repos. Parse Claude's JSON output, filter out repos already in `data/repos.json`, and append newly discovered ones. Return a summary of what was added.

Claude invocation:
```
claude -p "Search GitHub for repositories where companies post job openings as GitHub Issues, similar to backend-br/vagas. Return only a JSON array of owner/repo strings." --allowedTools WebSearch --bare --output-format json
```

### Acceptance criteria

- [ ] `POST /repos/discover` triggers Claude CLI and returns within reasonable time
- [ ] New repos found by Claude are appended to `data/repos.json`
- [ ] Repos already in `data/repos.json` are not duplicated
- [ ] Response includes `{ added: [...], total: N }`
- [ ] If Claude CLI is not installed or fails, endpoint returns a clear error message
- [ ] Newly discovered repos are immediately available via `GET /repos`
