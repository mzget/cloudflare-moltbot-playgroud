# ADR-0001: Bull vs. Bear Dialectical Debate Engine Architecture

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** User & Antigravity Agent
- **Informed by:** TauricResearch/TradingAgents Architecture, Oaktree Agent Multi-Agent Roadmap

---

## Context and Problem Statement
การวิเคราะห์หุ้นใน Oaktree Agent เดิมใช้กรอบความคิดของ 6 ปรมาจารย์ Value Investor (Peter Lynch, Hamilton Helmer, Warren Buffett, Charlie Munger, Howard Marks, Joel Greenblatt) ซึ่งให้การประเมินเชิงมูลค่าที่ลึกซึ้ง แต่มีข้อจำกัดด้าน **Confirmation Bias** เมื่อการวิเคราะห์ขาดมุมมองฝ่ายตรงข้าม (Adversarial view) ที่จงใจค้นหาจุดเสี่ยงและมุมมองที่เป็นปรปักษ์ 

เราต้องการเพิ่มระบบ **Bull vs. Bear Dialectical Debate Engine** (Phase 1) เพื่อสร้างข้อถกเถียงสองขั้วและสกัดจุดวัดใจสำคัญ (Key Tensions) ให้กับนักลงทุน

---

## Decision Drivers
1. **Adversarial Rigor:** ต้องมี Agent 2 ตัวที่มีผลประโยชน์และมุมมองขัดแย้งกันอย่างสิ้นเชิง
2. **Execution Latency & Timeout Safety:** รันบน Cloudflare Worker Edge runtime ซึ่งต้องไม่เกินข้อจำกัดเวลา Timeout
3. **Data Completeness:** ผสานทั้งข้อมูลเชิงปริมาณ (งบการเงิน) และข้อมูลเชิงคุณภาพ (ข่าวสารและบทวิเคราะห์ใน D1)
4. **Cohesive User Experience:** ต้องสอดคล้องกับหน้าจอ Stock Analysis เดิมโดยไม่ทำให้สับสน

---

## Considered Options

### Turn Structure
- **Option 1: Single-pass Parallel Prompting:** Bull และ Bear วิเคราะห์พร้อมกัน แล้ว Arbiter สรุป (ไม่มีรอบ Rebuttal)
- **Option 2: TauricResearch/TradingAgents Dialectical Protocol (Chosen):** 
  - Round 1: Opening Thesis (Bull vs Bear คู่ขนาน)
  - Round 2: Cross-Examination Rebuttal (Bull โต้ Bear, Bear โต้ Bull คู่ขนาน)
  - Round 3: Dialectical Arbiter Synthesis
- **Option 3: Unstructured Multi-turn Chat Loop:** ผลัดกันคุย 3-5 รอบแบบ Chatbot อิสระ

### Integration Surface
- **Option A: Integrated in `POST /api/analysis/run` & Report Tab (Chosen):** รันพร้อมกับ Deep Value Analysis เดิม และแสดงเป็นการ์ด Glassmorphism สองขั้วเหนือรายงานเดิม
- **Option B: Standalone Tab & Endpoint Only:** แยกแท็บและปุ่มกดต่างหาก

---

## Decision Outcome
**เลือก Option 2 (TradingAgents Dialectical Protocol) + Option A (Integrated Flow)**

### Rationale:
1. การใช้ **Structured Dialectical Protocol** มี 2 รอบการโต้แย้ง (Opening + Rebuttal) ทำให้การถกเถียงมีมิติสมจริงตามแบบฉบับของ TradingAgents โดยไม่ปล่อยให้ Prompt ยาวหลุดขอบเขต
2. การรันแบบ **Parallelized Round (`Promise.all`)** ใน Round 1 และ Round 2 ทำให้ใช้เวลาเพียง ~10-14 วินาที ปลอดภัยต่อ Cloudflare Worker execution limits
3. การฝังผลลัพธ์ในแท็บ `Report` ทำให้นักลงทุนสามารถดูทั้งข้อถกเถียง Bull/Bear และผลวิเคราะห์กูรู 6 ท่านได้ครบในหน้าเดียว
4. การดึงข้อมูลจาก `market_events` และ `notebook_articles` ใน D1 มาเสริม `market_stats` ช่วยให้เหตุผลโต้แย้งมีบริบทของเหตุการณ์ปัจจุบัน ไม่ใช่แค่ตัวเลขย้อนหลัง

---

## Consequences

### Positive:
- กำจัด Confirmation Bias ด้วยมุมมองสองขั้วที่ชัดเจน
- ชี้เป้า Key Tensions (จุดตัดสินใจชี้ขาด) ที่นักลงทุนต้องติดตาม
- วางรากฐานและเตรียมพารามิเตอร์สำหรับ Phase 2 (AI-Assisted DCF Scenarios: Bull/Base/Bear) ได้อย่างเป็นธรรมชาติ

### Negative / Trade-offs:
- เพิ่มจำนวนการเรียก LLM จาก 7 ครั้งเป็น 12 ครั้งใน Full Analysis Pipeline
- ต้องจัดการ Error fallback อย่างรัดกุมหากรอบ Rebuttal หรือ Arbiter มีปัญหาเรื่อง Token limit หรือ Parse error
