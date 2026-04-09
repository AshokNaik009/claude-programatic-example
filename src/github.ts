import { config } from "./config.js";
import type { Repo, Job } from "./types.js";

interface GitHubIssue {
  title: string;
  body: string | null;
  html_url: string;
  labels: Array<{ name: string }>;
  created_at: string;
  pull_request?: unknown;
}

function matchesKeywords(issue: GitHubIssue, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  return keywords.some((kw) => text.includes(kw));
}

export async function fetchIssuesForRepo(repo: Repo): Promise<Job[]> {
  const since = new Date();
  since.setDate(since.getDate() - config.daysBack);

  const jobs: Job[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues?state=open&since=${since.toISOString()}&per_page=100&page=${page}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-jobs-aggregator",
    };
    if (config.githubToken) {
      headers.Authorization = `Bearer ${config.githubToken}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(`Failed to fetch ${repo.owner}/${repo.repo} (page ${page}): ${res.status} ${res.statusText}`);
      break;
    }

    const issues: GitHubIssue[] = await res.json();

    if (issues.length === 0) break;

    for (const issue of issues) {
      // Skip pull requests (GitHub API returns PRs as issues)
      if (issue.pull_request) continue;

      const createdAt = new Date(issue.created_at);
      if (createdAt < since) continue;

      // Keyword filtering
      if (!matchesKeywords(issue, config.keywords)) continue;

      jobs.push({
        title: issue.title,
        repo: `${repo.owner}/${repo.repo}`,
        url: issue.html_url,
        labels: issue.labels.map((l) => l.name),
        postedAt: issue.created_at,
      });
    }

    // If we got fewer than 100 results, we've reached the last page
    if (issues.length < 100) break;
    page++;
  }

  return jobs;
}
