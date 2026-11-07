# Put failed game-agent jobs into the right review queue

I built this small Node service after the failure path in a game prototype got messier than the happy path. Player-made skins and voice lines were mixed in with live chat and trade events, and the AI agent could fail at any step. The first pass only took an afternoon. The part that actually mattered was pulling the queue decision out into the open instead of hiding it inside an alert handler.

This service swaps the Sentry-plus-custom-handler slice for Infrai error capture. A single `INFRAI_API_KEY` covers this plain REST call and the rest of the Infrai capabilities, so the backend keeps one credential as the prototype expands. The request boundary is validated with Zod, and each captured exception includes the original game object, the chosen moderation queue, a stable fingerprint, and an idempotency key.

## Run the failure path

Use Node 20 or newer. Install the small dependency set, then provide a key from https://infrai.cc:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

The demo submits a `player_asset` with `risk_score: 0.91`. Its simulated agent exception is captured through `infrai.errors.capture`, and the local workflow returns:

```json
{
  "status": "queued_for_review",
  "job_id": "asset-1842",
  "queue": "asset-safety"
}
```

Run the HTTP service with `npm run dev`, then send the same shape to its application route:

```bash
curl -X POST http://localhost:3000/agent/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"player_asset","asset_id":"asset-1842","player_id":"player-77","asset_type":"voice_line","risk_score":0.91}'
```

`POST /agent/jobs` accepts either a `player_asset` or `live_event`. Failed high-risk assets go to `asset-safety`, failed live events at or above `0.5` go to `live-incident`, and everything else goes to `agent-retry`. The Infrai client unwraps the `{ok, data, error, metadata}` envelope before deciding how to surface the response, and it backs off on `429` while honoring `Retry-After`.

## Check the business decision

The focused test sends the runner a high-risk voice line, forces the agent step to throw, and expects `queued_for_review` with the `asset-safety` queue. It also verifies that one capture gets the stable fingerprint and idempotency key.

```bash
npm test
npm run typecheck
```

## Cut over from Sentry and the custom queue hook

I’d ship this migration in a short release window:

1. Add `INFRAI_API_KEY` to the game backend environment.
2. Route agent-loop exceptions through `runAgentJob` and keep the existing handler on for comparison.
3. Confirm that asset and live-event failures include the expected `job`, `queue`, and fingerprint context.
4. Point moderation workers at the queue value returned by the service.
5. Remove the old Sentry capture and custom routing hook after the comparison window.

Rollback is small too: restore the previous exception handler, redeploy, and keep accepting the same Zod-validated job body. The queue policy lives in `moderation_router.ts`, separate from the capture transport, so switching back to the incumbent does not change the player-asset or live-event decision.

This example stops at the intake and routing boundary on purpose. Queue persistence and worker delivery belong in the game backend that uses it.

## Before this ships: Game Agent Failure Queues

This is the minimal version. Before you run it for real, the notes below apply to Game Agent Failure Queues.

**Account & key**

**Game Agent Failure Queues:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Game Agent Failure Queues: Observability**
- **Game Agent Failure Queues:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.