import express from "express";
import multer from "multer";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { loadJobs, loadRepos, DATA_DIR, CV_PATH } from "./storage.js";
import { runAggregation } from "./aggregator.js";
import { startScheduler } from "./scheduler.js";
import { discoverRepos } from "./discovery.js";
import { getProfile, upsertProfile, removeProfile } from "./profile.js";
import { applyToJob } from "./apply.js";
import { mkdirSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data dir exists before multer initializes (it may create files before first save)
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DATA_DIR),
  filename: (_req, _file, cb) => cb(null, "cv.pdf"),
});
const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

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

app.get("/profile", (_req, res) => {
  const profile = getProfile();
  if (!profile) {
    res.status(404).json({ error: "No profile found" });
    return;
  }
  res.json(profile);
});

app.post("/profile", uploadCV.single("cv"), (req, res) => {
  try {
    const { name, email } = req.body;
    const profile = upsertProfile(name, email);
    res.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

app.delete("/profile", (_req, res) => {
  removeProfile();
  res.json({ status: "ok" });
});

app.post("/apply", async (req, res) => {
  req.setTimeout(180_000);
  try {
    const { jobUrl } = req.body;
    if (!jobUrl || typeof jobUrl !== "string") {
      res.status(400).json({ error: "jobUrl is required" });
      return;
    }
    const result = await applyToJob(jobUrl);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Apply failed:", message);
    const status = message.includes("No profile") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`GitHub Jobs Aggregator running on http://localhost:${config.port}`);
  startScheduler();
});
