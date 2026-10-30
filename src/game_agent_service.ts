import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { runAgentJob } from "./agent_failure_loop.js";
import { InfraiError } from "./infrai_client.js";
import { agentJobSchema, type AgentJob } from "./moderation_router.js";

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function gameAgent(job: AgentJob): Promise<string> {
  return `accepted:${job.kind}`;
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/agent/jobs") {
    send(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const job = agentJobSchema.parse(await readJson(request));
    const result = await runAgentJob(job, gameAgent);
    send(response, result.status === "completed" ? 200 : 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "agent_job_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Game agent service listening on http://localhost:${port}`));
}
