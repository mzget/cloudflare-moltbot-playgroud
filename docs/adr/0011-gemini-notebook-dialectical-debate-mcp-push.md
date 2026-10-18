# 11. Refactor Bull vs. Bear Feature to Gemini-Driven MCP Push Architecture

Date: 2026-10-18

## Status
Accepted

## Context
ฟีเจอร์ **Bull vs. Bear Dialectical Debate** พัฒนาขึ้นตามแนวคิด TradingAgents / TauricResearch เพื่อลด Confirmation Bias โดยสร้างการประลองมุมมอง Bull (กระทิง), Bear (หมี) และให้ Arbiter สังเคราะห์บทสรุปพร้อมคะแนน Conviction Score (-10 ถึง +10)

เดิมทีระบบใช้โมเดล Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it`) ทำงาน 3 รอบ (Opening $\rightarrow$ Rebuttal $\rightarrow$ Synthesis) บน Edge Worker โดยมีข้อจำกัดสำคัญ:
1. Workers AI ไม่สามารถเข้าถึงเอกสารปฐมภูมิฉบับเต็ม (10-K, 10-Q, Earnings Call Transcripts ละเอียดยิบ, Presentation Slides) ได้อย่างครบถ้วน ทำให้เนื้อหา debate ขาดตัวเลข KPIs, Margins, และหลักฐานเชิงลึก
2. ในขณะเดียวกัน ระบบ Oaktree ได้พัฒนาช่องทาง Ingestion ผ่าน **Google Gemini Notebook & Gemini App** ที่มีคลังเอกสารและงานวิจัยสมบูรณ์ 100% อยู่แล้ว พร้อม MCP tools (`save_fundamental_brief`)
3. ในการทดสอบพบว่า Gemini App มักจะหยุดทำงานกลางคันหากผู้ใช้สั่งให้เรียก MCP Tool สองตัวแยกกัน (`save_fundamental_brief` แล้วตามด้วย `save_bull_bear_debate`)

## Decision
1. **Gemini-Driven Dialectical Debate**:
   - ย้ายหน้าที่การประมวลผล Debate ทั้ง 3 รอบไปยัง **Google Gemini App** โดยตรง เพื่อให้ Gemini สกัดข้อมูลจากเอกสารปฐมภูมิใน Notebook ทั้งหมด
   - กำหนดให้ผลลัพธ์เป็น **ภาษาไทยระดับนักวิเคราะห์สถาบัน (Institutional Thai)** พร้อมระบุตัวเลขจริง, อัตรากำไร, การเติบโต หรือ KPIs จากเอกสารกำกับทุกข้อโต้แย้ง

2. **Single Atomic Tool Call (`save_fundamental_brief` with embedded `debate`)**:
   - ขยาย Zod Schema ของ MCP Tool `save_fundamental_brief` ให้รองรับฟิลด์ `debate` (`round1`, `round2_rebuttal`, `synthesis`) ไปในคราวเดียวกัน (1-call atomic push)
   - มี MCP tools สำรอง `save_bull_bear_debate` และ `get_bull_bear_debate` สำหรับการเรียกอัปเดตเฉพาะ Debate โดยตรง

3. **Debate Preservation (`COALESCE` Guardrail)**:
   - เพิ่มคอลัมน์ `debate_json TEXT` ในตาราง `stock_fundamentals` (Migration `0042_add_debate_to_stock_fundamentals.sql`)
   - ในคำสั่ง SQLite Upsert ของ `save_fundamental_brief` ใช้ `debate_json = COALESCE(excluded.debate_json, stock_fundamentals.debate_json)` ป้องกันไม่ให้การบันทึก Brief ทั่วไปไปลบข้อมูล Debate เดิม
   - เมื่อมีการบันทึก Debate จาก Gemini ให้ซิงค์ต่อไปยัง `analysis_results.framework_results.debate` ของการวิเคราะห์ล่าสุดเพื่อความ Backward Compatible
   - ในไฟล์ R2 Markdown (`fundamentals/{symbol}.md`) ให้เพิ่มส่วน `## Bull vs. Bear Dialectical Debate` ต่อท้าย

4. **Zero-Overwrite & 6-Guru Context Enrichment**:
   - ถอดการเรียก `runDialecticalDebate` (Workers AI) ออกจาก Pipeline ของ `runFullAnalysis` (`backend/src/analysisEngine.ts`) เพื่อไม่ให้รันซ้ำซ้อนหรือทับผลลัพธ์จาก Gemini
   - นำข้อมูล Fundamental Brief, Theme Context และ Debate จาก Gemini มาแนบเป็น Context เสริมให้กับ 6 ปรมาจารย์ (Lynch, Helmer, Buffett, Munger, Marks, Greenblatt) และ Synthesis เสมอ

5. **Clean UI & Workflow**:
   - หน้าจอจัดวางและซิงค์ Debate อยู่บน `DebateCard.tsx` (ในหน้า Analysis Report)
   - เพิ่มปุ่ม **Copy Gemini Prompt** (เปิด `CopyPromptModal`) และปุ่ม **ซิงค์ข้อมูลล่าสุด (Refresh)** โดยเรียก `GET /api/analysis/debate?symbol=...`

## Consequences
- **Positive**:
  - ผลลัพธ์ Bull vs. Bear Debate มีคุณภาพสูงขึ้น อ้างอิงตัวเลขและข้อมูลจริงจากเอกสารใน Notebook ได้ 100%
  - ลดภาระการประมวลผลและลดเวลาในการรัน Deep Value Analysis บน Cloudflare Workers AI
  - การ Ingestion ทำได้สำเร็จง่ายและราบรื่นผ่าน Gemini App ใน 1 MCP Tool Call
- **Tradeoffs**:
  - การอัปเดต Debate ต้องอาศัยผู้ใช้ก๊อปปี้ Unified Prompt ไปสั่งงานใน Google Gemini App (แทนที่จะกดปุ่มรันแบบ On-demand จากตัวแอปอย่างเดียว)
