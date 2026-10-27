# 18. Gemini-Driven Value Investing Report (`save_value_investing_report`) and Portable Brainstormer Skill

Date: 2026-10-27

## Status

Accepted (Extends ADR-0011 & ADR-0017)

## Context

In the `/analysis?symbol=...&tab=report` view, the Oaktree platform previously executed its 6-Guru Deep Value Analysis (Peter Lynch, Hamilton Helmer 7 Powers, Warren Buffett, Charlie Munger, Howard Marks, Joel Greenblatt) using Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it`) across 8 sequential LLM steps (`POST /api/analysis/run` in `backend/src/analysisEngine.ts`).

While functional, this edge-bound pipeline faced three structural limitations:
1. **Context Window & Source Depth**: Workers AI only had access to summarized ratios in `market_stats` and compressed brief snippets, rather than the full 10-K/10-Q filings, earnings call transcripts, and presentation slides stored in the user's Google Gemini Notebooks.
2. **Latency & Token Overhead**: Executing 8 sequential JSON + Markdown LLM prompts on Edge Workers took 30–45 seconds per run and occasionally suffered from JSON truncation or model fallback degrades.
3. **Lack of Portability**: The 6-Guru analytical framework was locked inside TypeScript prompt functions (`backend/src/analysisPrompts.ts`), preventing the user from reusing or customizing the mental models in external AI agents (Google Gemini App, Gemini Spark, Claude, Cursor).

Following ADR-0011 (which migrated the Bull vs. Bear Dialectical Debate to Gemini MCP Push) and ADR-0017 (Single Source of Truth architecture), the Deep Value Analysis report should follow the exact same high-fidelity, zero-maintenance ingestion pattern.

## Decision

### 1. Portable Dual-Mode Skill (`value-investing-brainstormer`)
We unify the user's `value-investing-brainstormer` framework (Hamilton Helmer's 7 Powers Statics & Dynamics, Howard Marks' Second-Level Thinking & Cycles, Charlie Munger's Inversion & Latticework of Mental Models, Warren Buffett's Owner Mentality) with Peter Lynch's 6 Categories/PEG and Joel Greenblatt's Magic Formula (ROC & Earnings Yield) into a standalone, portable skill at `.agents/skills/value-investing-brainstormer/SKILL.md`.

The skill supports two operational modes:
- **Mode 1 (Interactive Brainstorming & Stress-Testing)**: A 5-step analytical workflow usable in any AI agent conversation to deconstruct unit economics, audit 7 Powers (Benefit + Barrier), run Munger pre-mortems, and check market cycles.
- **Mode 2 (Oaktree Deep Value Report & MCP Persistence)**: Instructs the agent to compile an 8-section Institutional-Grade Thai Markdown report (including the 6-Guru 1–10 scorecard table) and persist it via the `save_value_investing_report` MCP tool.

### 2. Lightweight MCP Tool (`save_value_investing_report`)
We register a new tool `save_value_investing_report` in `mcp-worker`:
- **Parameters**:
  - `symbol` (*string*): Stock ticker symbol in uppercase (e.g. `RMBS`).
  - `summary` (*string*): Complete Markdown report in Thai.
  - `conviction_level` (*enum*: `'High' | 'Medium' | 'Low'`).
  - `source` (*string*, optional): Defaults to `'gemini_app'`.
- **Payload Simplicity**: By requiring only `symbol`, `summary`, and `conviction_level` (omitting verbose intermediate step JSON objects), tool invocation from Gemini App and Gemini Spark remains fast, reliable, and free from token-limit tool call failures.

### 3. Single Source of Truth (SSOT) Overwrite & Debate Preservation
- **Atomic D1 Overwrite**: When `save_value_investing_report` is invoked for a symbol, it preserves any existing `debate` object from `analysis_results.framework_results` (or `stock_fundamentals.debate_json`) and executes an atomic batch `DELETE FROM analysis_results WHERE symbol = ?` followed by `INSERT INTO analysis_results ...` so each symbol maintains a single authoritative report record in D1.
- **R2 OKF Persistence**: Simultaneously writes an Open Knowledge Format (OKF) Markdown document with YAML frontmatter (`type: value_investing_report`) to Cloudflare R2 at `reports/{symbol}.md`.

### 4. Clean Frontend UI & Non-Destructive Backend Retention
- In `AnalysisReport.tsx`, the Workers AI execution button (`เริ่มการวิเคราะห์เชิงลึก` / `รันวิเคราะห์ใหม่`) is replaced with:
  1. **`Skill & Gemini Prompt`** button opening `ValueInvestingSkillModal.tsx` (allowing 1-click download of `SKILL.md` or copying the tailored Gemini prompt/skill).
  2. **`ซิงค์ข้อมูลล่าสุด`** button fetching the latest report from `GET /api/analysis/results?symbol=...`.
- Legacy backend endpoints (`POST /api/analysis/run` and `analysisEngine.ts`) are retained intact for backward compatibility.

## Consequences

- **Positive**:
  - Deep Value Analysis reports are grounded in 100% of primary documents inside Gemini Notebooks.
  - Users can download `SKILL.md` directly from the Oaktree UI and use it across any AI agent ecosystem.
  - Zero duplicate row bloat in `analysis_results` while preserving dialectical debate data.
- **Tradeoffs**:
  - Generating or updating a report requires triggering the prompt/skill in Gemini App or an MCP-connected agent rather than clicking a single Workers AI button.
