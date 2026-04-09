import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Repo, Job, JobsByDate } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const JOBS_PATH = join(DATA_DIR, "jobs.json");
const REPOS_PATH = join(DATA_DIR, "repos.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadRepos(): Repo[] {
  return JSON.parse(readFileSync(REPOS_PATH, "utf-8"));
}

export function saveRepos(repos: Repo[]): void {
  ensureDataDir();
  writeFileSync(REPOS_PATH, JSON.stringify(repos, null, 2) + "\n");
}

export function saveJobs(jobs: JobsByDate): void {
  ensureDataDir();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
}

export function loadJobs(): JobsByDate {
  if (!existsSync(JOBS_PATH)) return {};
  return JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
}

export function groupJobsByDate(jobs: Job[]): JobsByDate {
  const grouped: JobsByDate = {};

  for (const job of jobs) {
    const date = job.postedAt.split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(job);
  }

  // Sort by date descending
  const sorted: JobsByDate = {};
  for (const date of Object.keys(grouped).sort((a, b) => b.localeCompare(a))) {
    sorted[date] = grouped[date];
  }

  return sorted;
}
