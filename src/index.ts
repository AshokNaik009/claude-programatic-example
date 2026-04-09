import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { loadJobs, loadRepos } from "./storage.js";
import { runAggregation } from "./aggregator.js";
import { startScheduler } from "./scheduler.js";
import { discoverRepos } from "./discovery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

app.get("/jobs", (_req, res) => {
  res.json(loadJobs());
});

app.get("/jobs/:date", (req, res) => {
  const jobs = loadJobs();
  const dateJobs = jobs[req.params.date];
  if (!dateJobs) {
    res.status(404).json({ error: `No jobs found for date: ${req.params.date}` });
    return;
  }
  res.json(dateJobs);
});

app.post("/jobs/trigger", async (_req, res) => {
  try {
    const { jobsFetched } = await runAggregation();
    res.json({ status: "ok", jobsFetched, ranAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Aggregation failed:", message);
    res.status(500).json({ status: "error", error: message });
  }
});

app.get("/repos", (_req, res) => {
  res.json(loadRepos());
});

app.post("/repos/discover", async (req, res) => {
  req.setTimeout(300_000); // 5 min — Claude CLI + web search can be slow
  try {
    const result = await discoverRepos();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Repo discovery failed:", message);
    res.status(500).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`GitHub Jobs Aggregator running on http://localhost:${config.port}`);
  startScheduler();
});
