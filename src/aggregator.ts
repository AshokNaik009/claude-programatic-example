import { fetchIssuesForRepo } from "./github.js";
import { loadRepos, saveJobs, groupJobsByDate } from "./storage.js";
import type { Job } from "./types.js";

export async function runAggregation(): Promise<{ jobsFetched: number }> {
  const repos = loadRepos();
  const allJobs: Job[] = [];

  console.log(`Fetching issues from ${repos.length} repos...`);

  for (const repo of repos) {
    console.log(`  ${repo.owner}/${repo.repo}...`);
    const jobs = await fetchIssuesForRepo(repo);
    console.log(`    -> ${jobs.length} issues`);
    allJobs.push(...jobs);
  }

  const grouped = groupJobsByDate(allJobs);
  saveJobs(grouped);

  console.log(`Total: ${allJobs.length} issues saved to data/jobs.json`);
  return { jobsFetched: allJobs.length };
}
