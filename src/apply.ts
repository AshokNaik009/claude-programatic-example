import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { CV_PATH, loadProfile } from "./storage.js";

const CLAUDE_BIN = "/Users/ashoknaik/.nvm/versions/node/v22.1.0/bin/claude";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Emails commonly appearing in GitHub issue bodies that aren't contact emails
const EXCLUDED_EMAIL_DOMAINS = ["noreply.github.com", "users.noreply.github.com"];

export interface ApplyResult {
  coverLetter: string;
  email: string | null;
  subject: string;
}

interface ParsedIssueUrl {
  owner: string;
  repo: string;
  issueNumber: string;
}

function parseIssueUrl(url: string): ParsedIssueUrl {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) throw new Error(`Not a valid GitHub issue URL: ${url}`);
  return { owner: match[1], repo: match[2], issueNumber: match[3] };
}

export function extractEmail(text: string): string | null {
  if (!text) return null;
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return null;

  // Skip URLs and excluded domains
  for (const candidate of matches) {
    const lowered = candidate.toLowerCase();
    if (EXCLUDED_EMAIL_DOMAINS.some((d) => lowered.endsWith(d))) continue;
    return candidate;
  }
  return null;
}

interface GitHubIssueResponse {
  title: string;
  body: string | null;
}

export async function fetchIssue(url: string): Promise<GitHubIssueResponse> {
  const { owner, repo, issueNumber } = parseIssueUrl(url);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-jobs-aggregator",
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch issue: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return { title: data.title, body: data.body };
}

function buildClaudePrompt(jobBody: string, jobTitle: string): string {
  return `You are helping me write a job application cover letter.

Job title: ${jobTitle}

Job description:
${jobBody}

Please read my CV at ${CV_PATH} and write a concise, personalized cover letter (3-4 short paragraphs) for this job. Match relevant skills and experience from my CV to the job requirements. Output only the cover letter text — no preamble, no markdown headings, no sign-off placeholders.`;
}

function extractCoverLetter(stdout: string): string {
  const parsed = JSON.parse(stdout);
  if (typeof parsed.result === "string") {
    // Strip any markdown code blocks if Claude wrapped the output
    const stripped = parsed.result.replace(/^```(?:markdown|text)?\s*\n?/, "").replace(/```\s*$/, "");
    return stripped.trim();
  }
  throw new Error("Unexpected Claude output shape");
}

export function generateCoverLetter(jobBody: string, jobTitle: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!existsSync(CV_PATH)) {
      reject(new Error("CV not uploaded. Please upload a CV in your profile."));
      return;
    }

    const prompt = buildClaudePrompt(jobBody, jobTitle);
    const args = [
      "--allowedTools", "Read",
      "--output-format", "json",
      "-p", prompt,
    ];

    execFile(
      CLAUDE_BIN,
      args,
      { timeout: 120_000, env: { ...process.env, NODE_OPTIONS: "" }, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !stdout.trim()) {
          reject(new Error(`Claude CLI failed: ${error.message}${stderr ? ` — ${stderr}` : ""}`));
          return;
        }
        try {
          resolve(extractCoverLetter(stdout));
        } catch (err: any) {
          reject(new Error(`Failed to parse Claude output: ${err.message}`));
        }
      }
    );
  });
}

export async function applyToJob(jobUrl: string): Promise<ApplyResult> {
  const profile = loadProfile();
  if (!profile) {
    throw new Error("No profile found. Please create a profile first.");
  }

  const issue = await fetchIssue(jobUrl);
  const body = issue.body || "";
  const email = extractEmail(body);
  const coverLetter = await generateCoverLetter(body, issue.title);
  const subject = `Application: ${issue.title}`;

  return { coverLetter, email, subject };
}
