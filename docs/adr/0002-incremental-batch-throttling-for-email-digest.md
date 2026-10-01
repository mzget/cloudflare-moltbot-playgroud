# 2. Incremental 30-Minute Throttling for Email Digest

Date: 2026-10-01

## Status
Accepted

## Context
When emails accumulate, running unconstrained multi-email batch summarization risks token exhaustion, context dilution, superficial summaries, or timing out Cloudflare Workflow steps. The primary objective is comprehensive, high-quality analysis rather than high-throughput batching.

## Decision
1. Schedule Email Digest to run every 30 minutes (:00 and :30) exclusively within the Daytime Window (08:00 - 18:00 Asia/Bangkok time).
2. Throttle each run to **exactly 1 email per cycle** (`ORDER BY received_at ASC LIMIT 1`).
3. Prioritize summary comprehensiveness and depth over throughput: dedicating the full execution budget and AI context to a single newsletter prevents token starvation, brief superficial summaries, or truncation.
4. Leftover unprocessed emails naturally queue up for subsequent 30-minute cycles.

## Consequences
- Guarantees maximum depth and quality for each newsletter summary without rushing or degrading content.
- Completely eliminates step timeout risks and API rate limit issues.
- With 20 cycles available per day (08:00 - 18:00), comfortably processes up to 20 detailed newsletters daily.

