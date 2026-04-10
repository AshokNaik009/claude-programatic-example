# PRD: Job Application Feature

## Problem Statement

Users can browse aggregated job postings from GitHub Issues but have no way to apply through the app. They must manually visit each issue, figure out contact details, write an application message, and manage their own CV — all outside the tool. This friction reduces the value of the aggregator and makes it a read-only dashboard rather than an actionable job-hunting tool.

## Solution

Add an integrated apply flow to the GitHub Jobs Aggregator. Users set up a minimal profile once (name, email, CV upload as PDF), then click "Apply" on any job card. The app fetches the full job description from the GitHub API, feeds it along with the user's CV to Claude to generate a personalized cover letter, and presents it for review. If a contact email is found in the job posting, a pre-filled mailto link is provided. Otherwise, the user can copy the generated message to clipboard for manual use.

**Note:** This feature requires a Claude subscription or local Claude model setup, as cover letter generation invokes the Claude CLI.

## User Stories

1. As a job seeker, I want to create a profile with my name and email, so that applications include my contact info
2. As a job seeker, I want to upload my CV as a PDF, so that Claude can use it to generate personalized messages
3. As a job seeker, I want to view my saved profile, so that I can verify my details are correct
4. As a job seeker, I want to update my profile and re-upload my CV, so that I can keep my details current
5. As a job seeker, I want to delete my profile and CV, so that I can remove my personal data
6. As a job seeker, I want to see an "Apply" button on each job card, so that I can initiate an application directly
7. As a job seeker, I want the app to prompt me to create a profile if I click Apply without one, so that I don't get stuck
8. As a job seeker, I want the app to fetch the full job description when I click Apply, so that Claude has full context
9. As a job seeker, I want Claude to generate a personalized cover letter using the job description and my CV, so that each application is tailored
10. As a job seeker, I want to review and edit the generated cover letter before sending, so that I can make adjustments
11. As a job seeker, I want the app to extract contact emails from the job posting automatically, so that I know where to send my application
12. As a job seeker, I want a mailto link with pre-filled subject and body when an email is found, so that applying is one click
13. As a job seeker, I want a copy-to-clipboard button when no email is found, so that I can paste my application into a GitHub comment or other channel
14. As a job seeker, I want to see a loading state while Claude generates my cover letter, so that I know the app is working
15. As a job seeker, I want clear error messages if Claude CLI is unavailable or fails, so that I understand what went wrong
16. As a job seeker, I want the README to mention that a Claude subscription or local model setup is required, so that I know the prerequisites

## Implementation Decisions

### Modules

**Profile Module**
- New API endpoints: `GET /profile`, `POST /profile`, `DELETE /profile`
- Profile data stored in `data/profile.json` with schema: `{ name: string, email: string }`
- CV file stored as `data/cv.pdf`
- CV upload via `POST /profile` as multipart form data
- Use `multer` or similar middleware for file upload handling
- Profile and CV are single-user (one profile per instance)

**Apply Module**
- New API endpoint: `POST /apply`
- Accepts a job URL (GitHub issue URL) in the request body
- Fetches the full issue body on-demand from the GitHub API using the existing `GITHUB_TOKEN`
- Extracts contact emails from the issue body using regex pattern matching
- Invokes Claude CLI with the job description text + CV PDF to generate a personalized cover letter
- Claude CLI invocation: `claude -p "<prompt>" --allowedTools Read --output-format json` passing the CV path for Claude to read
- Returns: `{ coverLetter: string, email: string | null, subject: string }`
- The subject line is auto-generated as "Application: <job title>"

**UI Changes**
- New "Profile" tab in the tab bar alongside Jobs and Repos
- Profile tab contains a form: name, email, CV file input, save button
- Shows current profile state if one exists, with update/delete options
- "Apply" button added to each job card
- Clicking Apply opens an inline apply panel below the job card
- Apply panel shows: loading spinner → generated cover letter (editable textarea) → action buttons
- If email found: "Open Email" button (mailto link) + "Copy" button
- If no email: "Copy to Clipboard" button + "Open Issue" link to the GitHub issue
- Profile setup prompt if user clicks Apply without a profile

### API Contracts

```
GET  /profile          → { name, email, hasCV: boolean } | 404
POST /profile          → multipart { name, email, cv? (file) } → { name, email, hasCV }
DELETE /profile        → { status: "ok" }

POST /apply            → { jobUrl: string } → { coverLetter, email: string | null, subject }
```

### Email Extraction

- Simple regex scan: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`
- Returns the first match found in the issue body
- No Claude involvement in email extraction (keeps it fast)

### Cover Letter Generation

- Claude CLI is invoked server-side via `execFile` (same pattern as repo discovery)
- The prompt includes: the full issue body text, instruction to read the CV at the given path, and instruction to write a concise personalized cover letter
- Uses absolute path to Claude binary (same as discovery module)
- `NODE_OPTIONS` cleared to avoid debugger inheritance from tsx
- Timeout: 120 seconds

### Data Storage

- `data/profile.json` — user profile (name, email), gitignored via `data/`
- `data/cv.pdf` — uploaded CV file, gitignored via `data/`
- No new database or storage mechanism required

## Testing Decisions

Tests should verify external behavior through the module interfaces, not implementation details.

**Profile Module Tests**
- Creating a profile stores correct data and returns expected shape
- Updating a profile overwrites previous data
- Deleting a profile removes data and CV file
- GET returns 404 when no profile exists
- CV upload stores a file at the expected path
- Profile without CV upload works (hasCV: false)
- Invalid requests (missing name/email) are rejected

**Apply Module Tests**
- Email regex correctly extracts emails from various issue body formats
- Email regex returns null when no email is present in the body
- Email regex handles edge cases (multiple emails returns first, emails in URLs, etc.)
- Apply endpoint returns 400 when no profile exists
- Apply endpoint returns expected shape with coverLetter, email, and subject
- Subject line is correctly derived from job title
- GitHub API fetch failure returns appropriate error
- Claude CLI failure returns appropriate error

## Out of Scope

- Multi-user support / authentication — this is a single-user local tool
- Application tracking / history — no record of past applications
- Server-side email sending (SMTP/SendGrid) — mailto only
- Auto-applying to multiple jobs in bulk
- GitHub OAuth for commenting on issues directly
- CV parsing / structured data extraction from PDF
- Cover letter templates or style customization

## Further Notes

- **Claude dependency:** The cover letter generation requires a working Claude CLI installation with an active subscription or local model. This must be documented in the README.
- **Privacy:** All user data (profile, CV) stays local in the `data/` directory which is gitignored. No data is sent to external services except the Claude CLI (which processes locally) and the GitHub API (for fetching issue bodies, using the existing token).
- **Existing patterns:** The apply module follows the same Claude CLI invocation pattern established in `src/discovery.ts` — execFile with absolute path, NODE_OPTIONS cleared, output parsing with fallbacks.
