import "dotenv/config";

export const config = {
  githubToken: process.env.GITHUB_TOKEN || "",
  keywords: (process.env.KEYWORDS || "remote,developer,engineer").split(",").map((k) => k.trim().toLowerCase()),
  daysBack: parseInt(process.env.DAYS_BACK || "14", 10),
  port: parseInt(process.env.PORT || "3000", 10),
};
