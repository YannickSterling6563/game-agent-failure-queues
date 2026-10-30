import { infrai } from "./infrai_client.js";
import { chooseModerationQueue, jobId, type AgentJob } from "./moderation_router.js";

export type AgentResult =
  | { status: "completed"; job_id: string; output: string }
  | { status: "queued_for_review"; job_id: string; queue: ReturnType<typeof chooseModerationQueue> };

type Capture = (payload: Record<string, unknown>) => Promise<unknown>;

const captureWithInfrai: Capture = (payload) => infrai.errors.capture(payload);

export async function runAgentJob(
  job: AgentJob,
  execute: (job: AgentJob) => Promise<string>,
  capture: Capture = captureWithInfrai,
): Promise<AgentResult> {
  const id = jobId(job);
  try {
    return { status: "completed", job_id: id, output: await execute(job) };
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const queue = chooseModerationQueue(job);

    await capture({
      title: `Game agent failed while processing ${job.kind}`,
      message: error.message,
      exception: {
        type: error.name,
        message: error.message,
        stack: error.stack,
      },
      level: "error",
      fingerprint: ["game-agent", job.kind, queue],
      context: { job, queue },
      service: "game-backend-agent",
      idempotency_key: `agent-failure:${job.kind}:${id}`,
    });

    return { status: "queued_for_review", job_id: id, queue };
  }
}
