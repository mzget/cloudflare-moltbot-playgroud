# ADR-0012: Stock Financial Overview Tab Architecture

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** User & Antigravity Agent
- **Informed by:** Oaktree Valuation Guidelines, Finnhub & Yahoo Finance Timeseries Specs

---

## Context and Problem Statement
หน้า `/analysis` เดิมมี 3 แท็บ ได้แก่ `Report` (Deep Value Analysis 6 ปรมาจารย์ + Dialectical Debate), `DCF Model` (3 Preset Scenarios), และ `Stock Thesis` เมื่อผู้ใช้งานคลิกชื่อหุ้นจาก Watchlist หรือ Portfolio ผู้ใช้งานต้องการเห็นภาพรวมทางการเงินเชิงลึก (Financial Overview) ทันทีก่อนที่จะเริ่มรันการวิเคราะห์หรือประเมินมูลค่า

ระบบต้องการแท็บ **`Overview`** เป็นแท็บแรกและเป็นค่าเริ่มต้น (Default Tab) ของหน้า `/analysis` เพื่อแสดงข้อมูลสำคัญ 2 ส่วนหลักในรูปแบบ Responsive Split Panel:
1. **Left Panel — Curated Company Statistics:** ตารางสถิติบริษัทแบบ 3 คอลัมน์ (Profile, Margins & Returns, Valuation & Health, Growth & Dividends) ที่คัดเลือกเฉพาะตัวชี้วัดที่มีข้อมูลจริงจาก Finnhub, Yahoo Finance, และ Oaktree D1 (ตัด Consensus ล่วงหน้า 2-10 ปีที่ API ฟรีไม่มีข้อมูลออก)
2. **Right Panel — Financial Performance Grouped Bar Chart:** กราฟแท่งเปรียบเทียบ 5 ตัวชี้วัดสำคัญ (Total Revenues, Gross Profit, Operating Profit, Cash from Operations, Free Cash Flow) ทั้งแบบ Quarterly และ Annual พร้อม Interactive Legend คำนวณ Total Change (%) และ CAGR (%)

---

## Decision Drivers
1. **High Information Density & Authentic Data:** แสดงข้อมูลสถิติที่ครอบคลุมและมีตัวเลขจริง ไม่แสดงช่องว่างหรือเครื่องหมายขีด `—` มากเกินไป โดยทดแทนด้วยตัวชี้วัดจริงของ Oaktree เช่น `R&D/Rev`, `CapEx/OCF`, `DCF Fair Value`, `52W High/Low`, `ATH/ATL`
2. **Monetary Unit Consistency (Millions USD Standard):** ป้องกันข้อผิดพลาดด้านหน่วยเงิน (1,000x หรือ 1,000,000x) ระหว่าง Finnhub (คืนค่าเป็น Millions USD) และ Yahoo Finance (คืนค่าเป็น Raw USD) โดยกำหนดให้ฝั่ง Backend ปรับหน่วยตัวเลขทางการเงินทั้งหมดให้อยู่ในมาตรฐาน **Millions USD ($M)** ก่อนส่งให้ Frontend
3. **Time-Series Period Accumulation (`mergeFinancialPeriods`):** เนื่องจาก Yahoo Finance API คืนข้อมูลจำกัดเพียง 5 ไตรมาสล่าสุดและ 4 ปีล่าสุดต่อครั้ง ระบบจะสะสมและบันทึกชุดข้อมูลลง D1 `market_stats.overview_json` โดย Merge ตาม `asOfDate` ทำให้เก็บประวัติไตรมาสเก่าย้อนหลังได้ถาวร และทำหน้าที่เป็น Fallback หากบริการภายนอกเกิด Rate Limit
4. **Context-Aware Navigation Split:** แยก Intent การนำทางของผู้ใช้อย่างชัดเจน:
   - คลิกที่ชื่อหุ้น (Ticker Link) → นำไปยังแท็บ `Overview` (`tab: 'overview'`)
   - คลิกที่ปุ่ม Badge บทวิเคราะห์ (`<FileBarChart />`) → นำไปยังแท็บ `Report` (`tab: 'report'`)

---

## Considered Options

### Data Persistence & Fallback
- **Option A: Pure Cloudflare Cache API (No D1 Migration):** แคชผลลัพธ์ที่ Edge ชั่วคราว 1-6 ชั่วโมง
  - *ข้อเสีย:* ไตรมาสเก่าไม่ถูกสะสมถาวร และแคชจะหายไปตามรอบ TTL หรือ Edge eviction
- **Option B: Hybrid D1 Column (`overview_json` in `market_stats`) + Period Accumulation (Chosen):**
  - เพิ่มคอลัมน์ `overview_json` และ `overview_updated_at` ในตาราง `market_stats`
  - ทำการผสานข้อมูล (`mergeFinancialPeriods`) ระหว่างข้อมูลที่มีอยู่เดิมใน D1 กับข้อมูลใหม่ที่ดึงมา
  - สะสมได้สูงสุด 8 ไตรมาสล่าสุด และ 6 ปีล่าสุด พร้อมใช้งานเป็น Fallback ได้ทันที

### Monetary Unit Representation
- **Option A: Frontend Normalization:** ส่งค่าดิบให้ UI แล้วให้ React แปลงตามแหล่งที่มา
  - *ข้อเสีย:* เสี่ยงต่อความไม่สอดคล้องและการคำนวณ Margin/CAGR ใน Backend ที่อาจผิดพลาด
- **Option B: Strict Backend Normalization to Millions USD (Chosen):**
  - Normalizer ใน `stockOverview.ts` แปลง Yahoo Finance raw USD หาร $10^6$ ให้เป็น Millions USD
  - ข้อมูลใน `overview_json` และ API response มีหน่วยเป็น Millions USD เสมอ

---

## Decision Outcome
เลือก **Option B (Hybrid D1 Persistence)** และ **Option B (Strict Backend Normalization to Millions USD)**

### Data Structure & Integration
1. **Endpoint:** `GET /api/analysis/overview?symbol=XYZ&refresh=false`
2. **Data Sources Specification:**
   - **Yahoo Finance Timeseries API (`query1.finance.yahoo.com`):**
     - Quarterly Timeseries (`quarterlyTotalRevenue`, `quarterlyGrossProfit`, `quarterlyOperatingIncome`, `quarterlyOperatingCashFlow`, `quarterlyFreeCashFlow`) สะสมได้สูงสุด 8 ไตรมาส
     - Annual Timeseries (`annualTotalRevenue`, `annualGrossProfit`, `annualOperatingIncome`, `annualOperatingCashFlow`, `annualFreeCashFlow`) สะสมได้สูงสุด 6 ปี
     - Backend Normalization แปลงค่า raw USD เป็น Millions USD ($M)
   - **Finnhub REST API (`finnhub.io`):**
     - `/stock/metric?metric=all`: Margins (Gross/EBITDA/Op/Pre-tax/Net), Returns (ROA/ROE/ROI 5Y), Multiples (P/E, P/B, P/S, EV/EBITDA, Forward P/E, PEG), Financial Health (Debt/Equity, Current Ratio, Interest Coverage), Growth & Dividends (CAGR 3Y/5Y, Dividend Yield, Payout Ratio)
     - `/stock/profile2`: Company profile (Name, Logo, Industry, Exchange, IPO Date)
     - `/quote`: ราคาหุ้นปัจจุบัน (`c`)
   - **Internal D1 Database:**
     - `market_stats`: สถิติราคาและขนาดบริษัท (Market Cap, EV, Shares Out, 52W High/Low, ATH/ATL, FCF Margin, Total Cash/Debt, R&D/Rev, CapEx/OCF)
     - `dcf_calculations`: ค่า `implied_share_price` จาก Base Case ล่าสุด คำนวณเป็น DCF Base Value และ Margin of Safety (%)
3. **Cache Rule:** แคชใน D1 นาน 6 ชั่วโมง หากเรียกซ้ำภายใน 6 ชั่วโมง (และไม่ได้ระบุ `refresh=true`) จะส่งข้อมูลจาก D1 ทันที
4. **Database Migration:** `0044_add_overview_cache_to_market_stats.sql` เพิ่มคอลัมน์ `overview_json TEXT` และ `overview_updated_at TEXT` ใน `market_stats`
5. **UI Styling:** ใช้ MUI Joy UI components ร่วมกับ `glassStyle` ตาม Oaktree Frontend Guidelines (ไม่มีการใช้ Tailwind CSS)
