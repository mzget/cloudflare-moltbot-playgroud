# Oaktree Domain Context & Glossary

## Email Processing Subsystem

### Terms & Concepts

- **Email Ingestion (Sync)**: 
  The lightweight background operation that queries the Gmail API for subscribed newsletters and stores raw, sanitized email records into the `ingested_emails` database table. Runs continuously around the clock.

- **Email Digest (Summarization)**:
  The compute-intensive AI background operation that invokes Cloudflare Workers AI to analyze unprocessed ingested emails (`processed = 0`) and create Thai language structured summaries and Howard Marks-style takeaways in `email_digests`.

- **Daytime Window**:
  The defined operational window between 08:00 and 18:00 Asia/Bangkok time (01:00 - 11:00 UTC) reserved for running resource-heavy tasks like Email Digest, intentionally decoupled from nighttime US market trading hours.

- **Nighttime Window (US Market Hours)**:
  The window between 20:30/21:30 and 03:30/04:30 Asia/Bangkok time when the US stock market is open, reserved primarily for high-frequency stock price tracking and breakout alerting.

## Market Intelligence & External AI Agents Subsystem

### Terms & Concepts

- **Market Intelligence Articles (`notebook_articles`)**:
  Long-form research and market analysis records generated either through NotebookLM or external agentic AI platforms (e.g., Gemini Spark). Stored with categorization, source tags, and optional source URLs.

- **Knowledge Vault (`KNOWLEDGE_BUCKET`)**:
  A Cloudflare R2 bucket (`oaktree-knowledge`) storing persistent raw Markdown files and documents for long-term intelligence retrieval.

- **Gemini Spark Ingestion**:
  Direct MCP-driven submission of deep-dive research articles by Google Gemini Spark Custom Apps via the `saveMarketArticle` tool call.

- **Auto-Publish vs. Draft Mode**:
  - `auto_publish = 1`: The article is eligible for automatic queueing and posting to the Facebook Page during scheduled Facebook background processing.
  - `auto_publish = 0` (Default / Draft): The article is saved in draft mode, awaiting manual review and explicit posting by an operator.

- **Immediate Article Publishing (`publishArticleNow`)**:
  An on-demand operation triggered from the frontend ("Publish Now") that immediately formats an article into a Howard Marks-style memo using Cloudflare Workers AI and posts it to the Facebook Page via the Graph API.

- **Pause Articles & Analyses (`pause_notebook_facebook`)**:
  A system-level kill switch in the Command Center (Facebook Page tab) that temporarily halts automated discovery and publishing of `notebook_articles` without interrupting general market news or custom post drafting.

## DCF Valuation Subsystem (MCP Integration)

### Terms & Concepts

- **3 Preset Scenarios**:
  The canonical three valuation scenarios managed per stock symbol: `Base Case` (primary baseline), `Bull Case` (optimistic forecast), and `Bear Case` (conservative downside margin). Each stock maintains at most 1 saved record per scenario name in `dcf_calculations`.

- **Batch Scenario Ingestion (`save_dcf_scenarios`)**:
  Atomic submission of 1 to 3 DCF preset scenarios from external agents (such as Google Gemini Spark) via Model Context Protocol. Replaces existing records using an atomic batch `DELETE` and `INSERT` protocol in Cloudflare D1.

- **Detailed Forecast Mode**:
  Granular year-by-year 5-year forecast arrays: `yearly_growth`, `yearly_op_margin`, and `yearly_fcf_conv` (representing FY+1 through FY+5), mapped to the Gordon Growth intrinsic valuation model.

- **Scenario Rationale (`rationale`)**:
  Qualitative thesis and narrative justifications explaining the strategic assumptions behind the growth projections, margins, and terminal exit multiples.

- **Share Count Unit Standard**:
  Strict requirement where `shares_outstanding` and `target_shares` must always be stated in **Millions ($M$)** (e.g., 15,000 for 15 Billion shares). Input values $< 50$ trigger automated validation rejection to eliminate 1,000x calculation errors.

- **Valuation Inspection (`get_dcf_model` & `list_dcf_symbols`)**:
  MCP query tools allowing AI agents to read back stored valuation metrics, compare intrinsic share prices against real-time market prices, and compute margin of safety metrics.

## Fundamental Intelligence Subsystem (Gemini Notebook → Debate Context)

### Terms & Concepts

- **Gemini Notebook**:
  The user's research notebooks (formerly NotebookLM; `notebooklm.google.com` now redirects to `notebook.google.com`, and `gemini.google.com/notebook/<id>` uses the same UUID). Sources are typically quarterly earnings `report` / `slide` / `transcript` PDFs plus one user-authored thesis document.

- **Single-Stock Notebook** (`kind = 'single'`):
  A notebook dedicated to exactly one ticker (e.g. `ARM`). Source of that symbol's **Fundamental Brief**.

- **Theme Notebook** (`kind = 'theme'`):
  A notebook covering an industry or theme spanning many tickers (e.g. `SemiAnalysis`, `AI Datacenter`, `GRID`, `Cybersecure`). Mapped to multiple symbols and used to supply **Sector Context** — industry dynamics and competitor positioning.

- **Fundamental Brief (`stock_fundamentals`)**:
  Structured, slow-changing (quarterly) qualitative profile of one symbol extracted from its Single-Stock Notebook: `business_model`, `moat`, `competitors`, `guidance`, `key_risks`, `thesis_kpis`. Complements the fast-changing numbers in `market_stats`.

- **Sector Context (`theme_sector_contexts`)**:
  Qualitative industry, macro, and competitor synthesis extracted from a Theme Notebook and attached to every symbol mapped to that theme via `theme_symbol_mappings`.

- **Source As-Of Date**:
  The freshness date of a brief, derived by the system from the newest source's date (e.g. `..._2026-07-29_report.pdf`), never from the LLM's self-reported date (observed to be wrong).

- **Freshness Threshold (Stale Alert)**:
  A 90-day (1 calendar quarter) aging rule. Stocks whose `as_of_date` or `updated_at` exceeds 90 days are flagged with a warning badge in the Fundamental Intelligence Dashboard.

- **MCP Ingestion Protocol (`save_fundamental_brief` & `save_theme_sector_context`)**:
  High-reliability push tools in `mcp-worker` that ingest structured profiles directly from Gemini into Cloudflare D1 and persist OKF Markdown copies into Cloudflare R2 (`KNOWLEDGE_BUCKET`).

- **Grounding Context Fusion**:
  The assembly step in `debateEngine.ts` (`formatDebateContext`) that unifies:
  1. Real-time Market Stats & Ratios (`market_stats`)
  2. Company Fundamental Brief (`stock_fundamentals`)
  3. Industry & Competitor Dynamics (`theme_sector_contexts`)
  4. Recent Significant Events (`market_events`)

- **Gemini-Driven Dialectical Debate**:
  การโต้วาที 3 รอบ (Bull, Bear, Arbiter) ที่ประมวลผลโดยตรงบน Google Gemini App โดยอ้างอิงเอกสารเต็มใน Gemini Notebook แล้วส่งผลลัพธ์เข้า Oaktree ผ่าน MCP

- **Unified Brief & Debate Ingestion**:
  โปรโตคอลการส่งทั้ง Fundamental Brief และ Bull vs. Bear Debate ในการเรียก `save_fundamental_brief` เพียงครั้งเดียวแบบ Single Atomic Tool Call

- **Debate Preservation (`COALESCE` Guardrail)**:
  กลไกป้องกันไม่ให้การรัน Deep Value Analysis (6 ปรมาจารย์) หรือการอัปเดตเฉพาะส่วนไปเขียนทับข้อมูล Debate ที่มาจาก Gemini โดยใช้ `COALESCE(excluded.debate_json, stock_fundamentals.debate_json)`





## Stock Financial Overview Subsystem

### Terms & Concepts

- **Company Statistics Matrix**:
  ตารางข้อมูลสถิติและอัตราส่วนทางการเงินเชิงลึก 3 คอลัมน์ (Profile & Margins, Valuation & Financial Health, Growth & Dividends) ที่คัดเลือกเฉพาะตัวชี้วัดที่มีข้อมูลจริงจาก Finnhub Financial Metrics, Yahoo Finance และ Oaktree D1 โดยตัด consensus projections ที่ไม่มีข้อมูลออกเพื่อป้องกันเครื่องหมายขีด `—` ว่างเปล่า

- **5-Metric Financial Performance Chart**:
  กราฟแท่งเปรียบเทียบผลการดำเนินงาน 5 ตัวชี้วัดสำคัญของบริษัท ได้แก่ Total Revenues, Gross Profit, Operating Profit, Cash from Operations, และ Free Cash Flow พร้อมตัวเลขกำกับบน/ใต้แท่งกราฟ และเส้นแสดงจุดตัดแกนศูนย์สำหรับค่าติดลบ

- **Time-Series Period Accumulation (`mergeFinancialPeriods`)**:
  กระบวนการสะสมและรวมข้อมูลอนุกรมเวลารายไตรมาส (Quarterly) และรายปี (Annual) บันทึกลงคอลัมน์ `overview_json` ในตาราง `market_stats` เพื่อแก้ข้อจำกัดของ API ภายนอกที่คืนข้อมูลเพียง 4-5 คาบเวลาล่าสุด และเป็น Fallback ในกรณีที่ API ภายนอกขัดข้อง

- **Millions USD Unit Normalization**:
  มาตรฐานการแปลงหน่วยข้อมูลตัวเลขทางการเงินให้อยู่ในหน่วยล้านดอลลาร์สหรัฐ ($M) ในฝั่ง Backend ก่อนส่งให้ Frontend และก่อนบันทึกลง D1 เพื่อกำจัดข้อผิดพลาดความไม่สอดคล้องของสเกลตัวเลข (1,000x / 1,000,000x) ระหว่าง Yahoo Finance (Raw USD) และ Finnhub (Millions USD)

## Risk Manager & Position Sizing Subsystem

### Terms & Concepts

- **Stocks Only (USD) Fixed Denominator (`totalStockPortfolioUsd`)**:
  ฐานคำนวณสัดส่วนความเสี่ยงและขนาดการซื้อเพิ่มทั้งหมดในระบบ Risk Manager จะยึดจากมูลค่ารวมของพอร์ตหุ้นรายตัวที่เปิดสถานะอยู่ (`Open` holdings) ในสกุลเงิน USD คงที่ ณ ปัจจุบัน โดยไม่นำกองทุนรวมหรือเงินสดสกุลบาทมาปน

- **Governance Caps (8% / 15% / 30% Rule)**:
  เกณฑ์ควบคุมความเสี่ยงมาตรฐานตามหลัก Howard Marks:
  - **Target Weight (`8.0%`)**: สัดส่วนเป้าหมายมาตรฐานของหุ้น 1 ตัวในพอร์ต
  - **Max Single-Stock Cap (`15.0%`)**: เพดานสูงสุดของหุ้นรายตัว (แจ้งเตือน `Warning` ที่ `10.0%` และ `Breach` เมื่อเกิน `15.0%`)
  - **Max Strictest Theme Cap (`30.0%`)**: เพดานสูงสุดของกลุ่ม Theme จาก `theme_symbol_mappings` (แจ้งเตือน `Warning` ที่ `25.0%` และ `Breach` เมื่อเกิน `30.0%`)

- **Strictest Theme Binding Constraint**:
  กรณีหุ้น 1 ตัวถูกผูกไว้กับหลาย Theme ใน `theme_symbol_mappings` ระบบจะนับน้ำหนักของหุ้นตัวนั้นเข้าทุก Theme ที่สังกัด และเมื่อคำนวณวงเงินซื้อเพิ่มสูงสุด (`maxAllowedBuyUsd`) จะใช้ Theme ที่มีสัดส่วนปัจจุบันสูงที่สุด (ใกล้เต็มเพดาน 30% ที่สุด) เป็นตัวล็อกเพดาน ส่วนหุ้นที่ยังไม่มี Theme (`Unassigned`) จะไม่ถูกจำกัดด้วยเพดาน Theme Cap

- **Analysis Coverage Navigation Link**:
  ชื่อหุ้น (`symbol`) ในตาราง `Holdings Risk Concentration & Sizing Capacity` แสดงเป็นลิงก์กดไปยังหน้า `/analysis?symbol=XYZ&tab=report` พร้อมป้าย `AnalysisCoverage` แสดงจำนวนบทวิเคราะห์ที่มีอยู่ (Report, DCF, Thesis) เหมือนกับตารางในแท็บ Holdings และ Fundamentals ทุกประการ

