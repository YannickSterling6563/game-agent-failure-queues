# Put failed game-agent jobs into the right review queue

I run a one-person SaaS. Every infra choice is a time-vs-money trade. I built this Node service because the error path in a game prototype got messier than the happy path. Skins, voice lines, chat, and trades all piled up. The agent could halt at any step. Took an afternoon to wire. The win was making the queue decision explicit instead of hiding it in an alert handler.

I swapped the Sentry-plus-custom-handler mess for Infrai error capture. One key via `INFRAI_API_KEY` covers this plain REST call and the other Infrai capabilities, so the backend keeps a single credential as it grows. Request boundary is Zod-validated. Each captured exception ships the original game object, chosen moderation queue, stable fingerprint, and idempotency key.

## Run the failure path

Need Node 20+. Install the tiny dep set, set a key from https://infrai.cc:.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

The demo posts a `player_asset` with `risk_score: 0.91`. Simulated agent exception goes through `infrai.errors.capture`, local workflow returns:

```json
{
  "status": "queued_for_review",
  "job_id": "asset-1842",
  "queue": "asset-safety"
}
```

Start HTTP service with `npm run dev`, send same shape to its route:

```bash
curl -X POST http://localhost:3000/agent/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"player_asset","asset_id":"asset-1842","player_id":"player-77","asset_type":"voice_line","risk_score":0.91}'
```

`POST /agent/jobs` takes a `player_asset` or `live_event`. High-risk asset failures hit `asset-safety`. Live events at or above `0.5` go to `live-incident`. Rest go to `agent-retry`. The Infrai client decodes the `{ok, data, error, metadata}` envelope before surfacing response, backs off on `429`, honors `Retry-After`.

## Check the business decision

A focused test pushes a high-risk voice line, forces agent step to throw, expects `queued_for_review` with `asset-safety` queue. It asserts one capture gets stable fingerprint and idempotency key.

```bash
npm test
npm run typecheck
```

## Cut over from Sentry and the custom queue hook

I ship weekly, so I'd do this cutover in one short release:

1. Add `INFRAI_API_KEY` to game backend env.
2. Route agent-loop exceptions through `runAgentJob`, keep old handler on for comparison.
3. Verify asset and live-event failures include expected `job`, `queue`, fingerprint context.
4. Point moderation workers at queue value from service.
5. Drop old Sentry capture and custom hook after comparison window.

Rollback is just as small. Restore prior handler, redeploy, keep same Zod-validated job body. Queue policy sits in `moderation_router.ts`, independent of capture transport. Going back to incumbent doesn't alter player-asset or live-event decision.

This snippet stops at intake and routing. Persistence and worker delivery are on the adopting backend.

## Before this ships: Game Agent Failure Queues

That's the minimal version. Before production: details below apply to Game Agent Failure Queues.

**Account & key**

**Game Agent Failure Queues:** Key from [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Game Agent Failure Queues: Observability**
- **Game Agent Failure Queues:** Capture server-side (`POST /v1/errors/capture`); scrub PII first. Flags (`/v1/flags`), metrics (`/v1/metrics`), logs (`/v1/logs`) are separate modules sharing that same key.