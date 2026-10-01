# 4. FIFO Queue-Based Digest Processing

Date: 2026-10-01

## Status
Accepted

## Context
Previously, `generateEmailDigests` filtered subscriptions by an artificial hour-gate (`sub.frequency === 'daily' && currentHour === 6`). This caused newsletters ingested throughout the day to stall until 13:00 UTC (13:00 Thai Time), defying the intention of regular 30-minute incremental processing.

## Decision
1. Remove the artificial `currentHour === 6` gating logic inside `generateEmailDigests`.
2. Treat all unsummarized records in `ingested_emails WHERE processed = 0` as a continuous FIFO queue.
3. Every 30 minutes during the Daytime Window (08:00 - 18:00 Asia/Bangkok time), dequeue exactly the oldest 1 unprocessed email (`LIMIT 1`) and invoke Workers AI to generate a detailed summary.

## Consequences
- Clean, predictable queue draining every 30 minutes without artificial roadblocks.
- Eliminates email backlog accumulation and ensures every active subscription newsletter is processed smoothly.
