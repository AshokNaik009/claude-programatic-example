import cron from "node-cron";
import { runAggregation } from "./aggregator.js";

export function startScheduler(): void {
  // Schedule aggregation at 8:00 AM daily
  cron.schedule("0 8 * * *", async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Cron fired: starting daily aggregation...`);
    try {
      const { jobsFetched } = await runAggregation();
      console.log(`[${new Date().toISOString()}] Daily aggregation complete: ${jobsFetched} jobs fetched.`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Daily aggregation failed:`, err);
    }
  });

  console.log("Daily aggregation scheduled for 8:00 AM.");
}
