import { runAggregation } from "./aggregator.js";

runAggregation()
  .then(({ jobsFetched }) => {
    console.log(`Done. ${jobsFetched} jobs fetched.`);
  })
  .catch((err) => {
    console.error("Aggregation failed:", err);
    process.exit(1);
  });
