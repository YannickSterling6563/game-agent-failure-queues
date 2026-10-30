import { z } from "zod";

const assetSchema = z.object({
  kind: z.literal("player_asset"),
  asset_id: z.string().min(1),
  player_id: z.string().min(1),
  asset_type: z.enum(["skin", "map", "voice_line"]),
  risk_score: z.number().min(0).max(1),
});

const liveEventSchema = z.object({
  kind: z.literal("live_event"),
  event_id: z.string().min(1),
  player_id: z.string().min(1),
  event_type: z.enum(["chat", "trade", "match_report"]),
  risk_score: z.number().min(0).max(1),
});

export const agentJobSchema = z.discriminatedUnion("kind", [assetSchema, liveEventSchema]);
export type AgentJob = z.infer<typeof agentJobSchema>;

export type ModerationQueue = "asset-safety" | "live-incident" | "agent-retry";

export function chooseModerationQueue(job: AgentJob): ModerationQueue {
  if (job.kind === "player_asset" && job.risk_score >= 0.7) return "asset-safety";
  if (job.kind === "live_event" && job.risk_score >= 0.5) return "live-incident";
  return "agent-retry";
}

export function jobId(job: AgentJob): string {
  return job.kind === "player_asset" ? job.asset_id : job.event_id;
}
