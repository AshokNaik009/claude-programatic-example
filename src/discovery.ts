import { exec } from "node:child_process";
import { loadRepos, saveRepos } from "./storage.js";
import type { Repo } from "./types.js";

const CLAUDE_PROMPT =
  'Search GitHub for repositories where companies post job openings as GitHub Issues, similar to backend-br/vagas. Return only a JSON array of owner/repo strings.';

function extractArray(parsed: any): string[] {
  // Direct array
  if (Array.isArray(parsed)) return parsed;

  // --output-format json wraps in { result: "..." }
  // The result field is markdown text containing a ```json code block
  if (typeof parsed === "object" && typeof parsed.result === "string") {
    const text = parsed.result;

    // Try parsing result directly as JSON
    try {
      const direct = JSON.parse(text);
      if (Array.isArray(direct)) return direct;
    } catch {}

    // Extract JSON array from markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const inner = JSON.parse(codeBlockMatch[1]);
      if (Array.isArray(inner)) return inner;
    }

    // Try finding a raw JSON array in the text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const inner = JSON.parse(arrayMatch[0]);
      if (Array.isArray(inner)) return inner;
    }
  }

  throw new Error("Could not extract repo array from Claude output");
}

export function discoverRepos(): Promise<{ added: string[]; total: number }> {
  return new Promise((resolve, reject) => {
    const cmd = `claude --allowedTools WebSearch --output-format json -p ${JSON.stringify(CLAUDE_PROMPT)}`;
    exec(
      cmd,
      { timeout: 180_000, env: { ...process.env, NODE_OPTIONS: "" } },
      (error, stdout, stderr) => {
        // Claude CLI may exit non-zero but still produce valid output
        if (error && !stdout.trim()) {
          reject(
            new Error(
              `Claude CLI failed: ${error.message}${stderr ? ` — ${stderr}` : ""}`
            )
          );
          return;
        }

        let discovered: string[];
        try {
          const parsed = JSON.parse(stdout);
          discovered = extractArray(parsed);
        } catch (parseErr: any) {
          reject(
            new Error(
              `Failed to parse Claude output: ${parseErr.message}\nRaw output: ${stdout.slice(0, 500)}`
            )
          );
          return;
        }

        // Validate and normalise to owner/repo strings
        const valid = discovered.filter(
          (s) => typeof s === "string" && /^[^/]+\/[^/]+$/.test(s.trim())
        );

        const existing = loadRepos();
        const existingSet = new Set(
          existing.map((r) => `${r.owner}/${r.repo}`)
        );

        const added: string[] = [];
        for (const entry of valid) {
          const trimmed = entry.trim();
          if (existingSet.has(trimmed)) continue;
          existingSet.add(trimmed);
          const [owner, repo] = trimmed.split("/");
          existing.push({ owner, repo });
          added.push(trimmed);
        }

        if (added.length > 0) {
          saveRepos(existing);
        }

        resolve({ added, total: existing.length });
      }
    );
  });
}
