---
name: oaktree-backend
description: Backend guidelines for Cloudflare Workers, D1 database batching/formatting, Workers AI model specifications, and ad-blocker resilient API naming. Load when working on backend Workers, API routes, or database operations.
---

# Oaktree Backend Guidelines

Guidelines and standards for backend development on Cloudflare Workers, Hono, Workers AI, and D1 Database.

---

## ⚡ Database Date/Time Formatting Guidelines

For any newly created tables, standardize datetime fields to use ISO-8601 string format (`DATETIME DEFAULT CURRENT_TIMESTAMP` or `TEXT`) instead of Unix Epoch integers to maintain query consistency across new database architectures.

---

## 🚫 Ad-Blocker Resilient API Naming Guidelines

When designing and naming backend API paths, avoid naming routes using common ad-blocker keywords such as `notification`, `notifications`, `alert`, `alerts`, `track`, `tracking`, or `analytics` (e.g. `/api/notifications` or `/api/in-app-notifications`). 
- **Reasoning**: Popular ad-blockers (e.g., uBlock Origin) and privacy filters routinely intercept and block these network requests in production environments (causing errors like `net::ERR_CONNECTION_CLOSED`).
- **Solution**: Use alternative, less common terms for paths, such as `/api/triggered-alerts` or general transaction/resource names.

---

## ⚡ Cloudflare D1 Database Batching & Query Guidelines

To prevent latency bottlenecks when writing database operations:
- **No Database Queries in Loops**: Avoid executing inline queries (`await env.DB.prepare(...).first()`, `.run()`, etc.) inside loops.
- **Pre-fetching SELECT queries**: If you need to check if records exist for multiple items, pre-fetch the list of existing records before entering the loop (e.g., matching on date or IDs) and use an in-memory `Set` or `Map` for checking.
- **Batching Writes/Updates**: For multiple database inserts/updates, accumulate `D1PreparedStatement` instances in an array (e.g., `batchStatements: any[]`) and execute them in a single batch transaction using `await env.DB.batch(batchStatements)` after the loop completes.

---

## 🤖 Cloudflare Workers AI Model Specifications

This workspace uses a multi-tier AI model architecture configured in `wrangler.toml` under `[vars]`:

### 1. `default_ai_model` (`@cf/google/gemma-4-26b-a4b-it`)
- **Category**: Primary Heavy Reasoning & Analysis Model (26B MoE / 4B active).
- **Target Use Cases**:
  - Multi-step investment analysis engine (`backend/src/analysisEngine.ts`) executing 6 frameworks (Peter Lynch, Hamilton Helmer 7 Powers, Buffett, Munger, Howard Marks, Joel Greenblatt).
  - Newsletter digest generation and categorization (`backend/src/emailSummarizer.ts`).
- **Input/Output Constraints**:
  - Enforce `response_format: { type: 'json_object' }`.
  - Escaped quotes: Require prompts to instruct the LLM not to use unescaped double quotes inside JSON string values.

### 2. `facebook_summarize_model` (`@cf/meta/llama-3.2-3b-instruct`)
- **Category**: Fast & Lightweight Social Media Stylist & Daily News Summarizer (3B parameters).
- **Target Use Cases**:
  - Stock daily news summarization (`backend/src/summarizer.ts`).
  - Generating short 2-3 sentence "Oaktree Memo" commentaries for Facebook Page posts (`backend/src/facebook.ts`).
  - Re-formatting custom user drafts into engaging Facebook posts with emojis, clear spacing, and hashtags (`backend/src/facebook.ts`).
- **Input/Output Constraints**: Plain text / formatted social media copy (no raw JSON requirement).

### 💡 Developer Rules for AI Models:
- **No Hardcoded Model Strings**: Always reference models via `env.default_ai_model` or `env.facebook_summarize_model` instead of hardcoding model string literals in TypeScript files.
- **Model Upgrades**: When changing models in `wrangler.toml`, verify that the model string matches valid Workers AI model identifiers (e.g. `@cf/google/...`, `@cf/meta/...`).
