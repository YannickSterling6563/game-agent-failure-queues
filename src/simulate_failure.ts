import { runAgentJob } from "./agent_failure_loop.js";

const result = await runAgentJob(
  {
    kind: "player_asset",
    asset_id: "asset-1842",
    player_id: "player-77",
    asset_type: "voice_line",
    risk_score: 0.91,
  },
  async () => {
    throw new Error("moderation model produced no decision");
  },
);

console.log(JSON.stringify(result, null, 2));
