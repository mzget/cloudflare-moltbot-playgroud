# 📋 Oaktree Multi-Agent Feature Roadmap & TODO List
*(Inspired by TauricResearch/TradingAgents Architecture)*

เอกสารบันทึกแผนงานและ TODO List สำหรับการนำแนวคิด Multi-Agent Architecture (Specialized Analysts, Bull vs. Bear Debate, Risk Management, และ Explainable Decision Trace) มาปรับใช้เพื่อยกระดับ Oaktree Agent

---

## 🎯 ภาพรวมสถาปัตยกรรมเป้าหมาย (Target Architecture)

```mermaid
flowchart TD
    MarketData["Market & News Data (FMP / Crawler / Facebook)"] --> AnalystSwarm

    subgraph AnalystSwarm["1. Specialized Analyst Swarm"]
        FA["Fundamental Analyst\n(งบการเงิน, Cash Flow, D1 Data)"]
        SA["Sentiment Analyst\n(Social, News, Articles)"]
        TA["Technical / Market Analyst\n(Price Action, Momentum, Volume)"]
    end

    AnalystSwarm --> DebateEngine

    subgraph DebateEngine["2. Bull vs. Bear Debate Engine"]
        Bull["Bull Researcher\n(Growth Thesis & Upside)"]
        Bear["Bear Researcher\n(Risk Thesis & Downside)"]
        Bull <-->|"Dialectical Debate\n(Argue & Counter-argue)"| Bear
    end

    DebateEngine --> Synthesis["3. Synthesis & DCF Parameter Extractor"]
    
    subgraph DecisionRisk["4. Risk Management & Portfolio Check"]
        Synthesis --> RiskManager["Risk Manager Agent\n(Concentration, Volatility, Sizing)"]
        Portfolio["User Portfolio DB"] --> RiskManager
    end

    RiskManager --> FinalOutput["5. Final Output & Explainable UI"]
```

---

## 📝 TODO List ตามลำดับ Phase

### 🚀 Phase 1: Quick Wins — Bull vs. Bear Analysis & Summary (Completed ✅)
> **เป้าหมาย:** เพิ่มมิติการวิเคราะห์หุ้นแบบ 2 ขั้วตรงข้าม (Adversarial View) ในหน้า Stock Analysis ทันที เพื่อลด Confirmation Bias

- [x] **Backend: Prompts & Engine (`backend/src/analysisPrompts.ts`, `backend/src/analysisEngine.ts`)**
  - [x] ออกแบบ Prompt แยก 2 บทบาท: `BULL_THESIS_PROMPT` (Upside catalysts, moat, growth) และ `BEAR_THESIS_PROMPT` (Risks, accounting red flags, valuation stretch)
  - [x] ทำฟังก์ชันรันการวิเคราะห์คู่ขนาน (Parallel LLM generation via Workers AI / Gemini)
  - [x] สร้าง Output schema รองรับ `{ bullPoints: string[], bearPoints: string[], keyDebateSummary: string }`
- [x] **API Endpoint (`backend/src/routes/`)**
  - [x] เพิ่ม Endpoint `POST /api/stocks/:symbol/debate-summary` หรือรวมเข้ากับ Endpoint วิเคราะห์หุ้นเดิม
- [x] **Frontend UI (`frontend/src/`)**
  - [x] ออกแบบการ์ดแสดงผลคู่ขนานแบบ Side-by-Side (MUI Joy UI `Grid` หรือ `Card`)
  - [x] ฝั่งซ้าย: สีเขียว/Neutral (Bull Case Catalysts)
  - [x] ฝั่งขวา: สีแดง/Warning (Bear Case Risks)
  - [x] สรุป Key Tension / จุดชี้ขาดสำคัญของหุ้นตัวนั้น

---

### 🧮 Phase 2: AI-Assisted DCF Valuation Scenarios (In Progress 🔄)
> **เป้าหมาย:** เชื่อมโยงผลวิเคราะห์ Multi-Agent เข้ากับโมเดล DCF ที่มีอยู่เดิมใน Oaktree เพื่อตั้งค่า Base, Bear, Bull Case อัตโนมัติ

- [x] **DCF Parameter Recommendation Agent (via Gemini App & MCP)**
  - [x] ให้ Agent วิเคราะห์ Historical Financials + ผล Bull/Bear เพื่อประเมินช่วงตัวเลขสมมติฐาน:
    - Revenue Growth Rate (Yr 1-5)
    - Operating Margin
    - WACC / Discount Rate
    - Terminal Growth Rate
  - [x] แมปผลลัพธ์เป็น 3 Presets: `Bull Case`, `Base Case`, `Bear Case`
- [ ] **Integration กับ DCF Engine (`backend/src/dcfAnalysis.ts`, `frontend/src/components/DCF/`)**
  - [x] ใช้ Gemini app วิเคราะห์ Bull/Bear/Base scenarios และใช้ `mcp-worker` บันทึกพารามิเตอร์ DCF ลง D1
  - [ ] เพิ่มขั้นตอนการประเมิน Margin of Safety Workflow: เปรียบเทียบ Intrinsic Value (จากแต่ละ scenario) กับ Market Price, แสดง % Safety และสรุป Recommendation

---

### 👥 Phase 3: Specialized Analyst Swarm (Workers AI / Agents SDK)
> **เป้าหมาย:** แยกย่อยการวิเคราะห์เป็น Agent เฉพาะทางเพื่อเพิ่มความลึกและแม่นยำของข้อมูล

- [ ] **Fundamental Analyst Agent**
  - [ ] เจาะลึกงบดุล, กระแสเงินสดอิสระ (FCF), หนี้สิน, และแนวโน้มความสามารถในการทำกำไร (ROIC/ROE)
- [ ] **Sentiment & News Analyst Agent**
  - [ ] เชื่อมต่อข้อมูลจาก Crawler ข่าว, Facebook posts, และ Articles ในระบบ
  - [ ] ให้คะแนน Market Sentiment Score (-10 ถึง +10) พร้อมประเด็นร้อน
- [ ] **Technical & Momentum Analyst Agent**
  - [ ] คำนวณระดับราคาแนวรับ-แนวต้าน, Moving Averages, RSI/MACD divergence
- [ ] **Orchestration Layer**
  - [ ] พัฒนา Workflow / Pipeline รวบรวมรายงานจากทุก Analyst ก่อนส่งต่อเข้า Debate Engine

---

### 🛡️ Phase 4: Risk Officer & Portfolio Health Advisory (Completed ✅)
> **เป้าหมาย:** ระบบตรวจสอบความเสี่ยงพอร์ตและให้คำแนะนำในการจัดขนาดสถานะการลงทุน (Position Sizing)

- [x] **Portfolio Risk Audit Engine (`packages/shared/src/portfolioRisk.ts`, `backend/src/portfolioRisk.ts`)**
  - [x] ตรวจจับ Concentration Risk (8% Target Weight, 15% Single-Stock Cap, 30% Strictest Theme Cap, HHI & Effective Positions)
  - [x] ตรวจจับ Correlation Risk & Market Sensitivity (252-day Pearson correlation pairs `r >= 0.70` และ Portfolio Beta vs `^GSPC`)
  - [x] คำนวณ Portfolio Health Score (0-100) พร้อมรายละเอียดการหักคะแนนตามระดับความเสี่ยง
- [x] **Risk Advisor Component & MCP Integration (`frontend/src/components/features/portfolio/RiskSizingTab.tsx`, `ThemeDonutChart.tsx`, `mcp-worker/src/riskTools.ts`)**
  - [x] แสดงแดชบอร์ด KPI, ตาราง Concentration & Sizing Capacity, และ Interactive Theme Donut Chart (120 FPS micro-interactions)
  - [x] Position Sizing & Pre-Trade Simulator คำนวณ Room to Target (8%), Stock Cap (15%), Strictest Theme Cap (30%) และจำลองผลกระทบก่อนเทรด
  - [x] ระบบ AI Risk Officer Advisory (Howard Marks Framework) รองรับทั้ง Cloudflare Workers AI และ Gemini App ผ่าน MCP (`get_portfolio_risk_audit`, `calculate_position_size`, `save_risk_advisory`)
  - [-] ~~Conviction & MoS-Weighted Dynamic Sizing~~ *(Skipped — ใช้ Fixed Governance Caps 8% / 15% / 30% เป็นเกณฑ์มาตรฐาน และให้ผู้ลงทุนพิจารณา Conviction แบบ Manual ด้วยตัวเอง)*

---

### 📜 Phase 5: Decision Trace & Auditability UI
> **เป้าหมาย:** ทำให้นักลงทุนสามารถตรวจสอบตรรกะและที่มาของการตัดสินใจของ AI ได้อย่างโปร่งใส

- [ ] **Timeline / Reasoning Flow UI (`frontend/src/`)**
  - [ ] สร้าง Accordion หรือ Timeline Component แสดงลำดับการประมวลผล:
    1. *Data Gathered* (งบการเงิน + ข่าวที่ใช้อ้างอิง)
    2. *Analyst Insights* (สรุปจากแต่ละ Agent)
    3. *Debate Transcript* (การโต้แย้งระหว่าง Bull vs Bear)
    4. *Final Thesis & Risk Officer Note*
  - [ ] เพิ่ม Toggle ให้ผู้ใช้เลือกระหว่าง "Executive Summary" (แบบสั้น) กับ "Deep Dive Reasoning" (แบบละเอียด)

---

## 📌 Technical Considerations & Stack Compatibility

1. **Serverless & Edge Limitations (Cloudflare Workers):**
   - การรัน Multi-turn debate ยาวๆ อาจติด Time limit ของ Edge Worker ปกติ
   - *แนวทางแก้ไข:* ใช้ **Cloudflare Workflows** หรือ **Agents SDK** ในการจัดการ Background asynchronous execution และบันทึก State ลง D1 Database
2. **Token Economy & Latency:**
   - ใช้โมเดลขนาดเล็ก (เช่น Workers AI / Gemini Flash) สำหรับขั้นตอนรวบรวมข้อมูลและ Debate เบื้องต้น
   - ใช้โมเดลใหญ่ขึ้นเฉพาะขั้นตอน Final Synthesis
3. **UI Standard (Oaktree Front-end):**
   - ใช้ MUI Joy UI + `sx` props ตามข้อกำหนดอย่างเคร่งครัด
   - นำ Glassmorphism & Card patterns ที่มีอยู่มาจัดวาง Layout สำหรับ Debate และ Decision Trace
