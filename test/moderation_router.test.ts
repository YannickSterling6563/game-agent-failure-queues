import assert from "node:assert/strict";
import test from "node:test";
import { runAgentJob } from "../src/agent_failure_loop.js";

test("a failed high-risk player asset enters the asset safety queue", async () => {
  const captured: Record<string, unknown>[] = [];
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
    async (payload) => captured.push(payload),
  );

  assert.deepEqual(result, {
    status: "queued_for_review",
    job_id: "asset-1842",
    queue: "asset-safety",
  });
  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0]?.fingerprint, ["game-agent", "player_asset", "asset-safety"]);
  assert.equal(captured[0]?.idempotency_key, "agent-failure:player_asset:asset-1842");
});
