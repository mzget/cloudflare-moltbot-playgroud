# FEATURE SPEC: Stock Thesis and Journal log

> **Author**: Antigravity AI
> **Status**: Active
> **Database**: Cloudflare D1 (SQLite)
> **Backend**: Hono (Worker API)
> **Frontend**: React (MUI Joy UI) + TanStack Router

---

## 1. Goal
ให้นักลงทุนสามารถบันทึกและจัดการ **Stock Thesis** (สมมติฐานการลงทุน, จุดซื้อ/จุดขาย, Catalysts, Risks และบันทึกรายละเอียดเชิงลึกในรูปแบบ Markdown) ของแต่ละหุ้นใน Watchlist และมีบันทึกความคืบหน้า (Journal entries) เพื่อให้เข้ามาอ่านทบทวนได้ตลอดเวลา

---

## 2. Database Schema (Cloudflare D1)

ฟีเจอร์นี้ใช้ตารางใหม่ 2 ตารางที่เชื่อมต่อกันแบบ Cascading delete:

### A. ตาราง `stock_theses`
เก็บข้อมูลหลักของ Thesis:
```sql
CREATE TABLE IF NOT EXISTS stock_theses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  buy_price REAL,
  sell_price REAL,
  conviction TEXT NOT NULL DEFAULT 'Medium',  -- 'High' | 'Medium' | 'Low'
  status TEXT NOT NULL DEFAULT 'Active',       -- 'Active' | 'Closed' | 'Invalidated'
  catalysts TEXT,        -- ปัจจัยเร่ง/บวก
  risks TEXT,            -- ความเสี่ยง
  note TEXT,             -- รายละเอียดลึก (Markdown)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_theses_symbol ON stock_theses (symbol);
```

### B. ตาราง `thesis_journal_entries`
เก็บบันทึกประวัติ Journal หรือ update log สำหรับแต่ละ Thesis:
```sql
CREATE TABLE IF NOT EXISTS thesis_journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thesis_id INTEGER NOT NULL REFERENCES stock_theses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,     -- เนื้อหาอัปเดต
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_thesis_journal_thesis_id ON thesis_journal_entries (thesis_id);
```

---

## 3. Backend API Endpoints (Hono Router)

ติดตั้งอยู่ใน `backend/src/index.ts` ถัดจาก DCF endpoint:

| Method | Path | Request Body | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/analysis/theses?symbol=X` | - | ดึงข้อมูล theses ทั้งหมดสำหรับ symbol ที่ระบุ เรียงตามวันที่ล่าสุด |
| **`POST`** | `/api/analysis/theses` | `{ symbol, title, conviction, status }` | สร้าง thesis เริ่มต้นอันใหม่ |
| **`PUT`** | `/api/analysis/theses/:id` | `{ title, buy_price, sell_price, conviction, status, catalysts, risks, note }` | บันทึกรายละเอียดการแก้ไขลงฐานข้อมูล |
| **`DELETE`**| `/api/analysis/theses/:id` | - | ลบ thesis (D1 จะลบ Journal ที่ผูกอยู่ด้วยแบบ Cascade อัตโนมัติ) |
| **`GET`** | `/api/analysis/theses/:id/journal` | - | ดึงข้อมูล journal log ทั้งหมดของ thesis นั้น |
| **`POST`** | `/api/analysis/theses/:id/journal` | `{ content }` | เพิ่ม journal log อัปเดตใหม่ |

---

## 4. Frontend Component Structure

### A. หน้าหลัก `AnalysisReport.tsx`
- เพิ่มแท็บใหม่ชื่อ **"Stock Thesis"** ถัดจากแท็บ DCF Model
- เชื่อมต่อการสลับ Tab ผ่าน TanStack Router ด้วย parameter `tab: 'stock-thesis'`

### B. หน้าย่อย `StockThesis.tsx`
ประกอบด้วย UI 2 ส่วนแบ่งตาม Grid layout:
1. **Sidebar Panel (ซ้าย/บน)**: แสดงรายชื่อ Thesis ทั้งหมดของหุ้น พร้อมแสดง Badge บอกสถานะ (Active, Closed, Invalidated) และระดับความเชื่อมั่น (High, Medium, Low)
2. **Detail/Editor Form (ขวา/ล่าง)**:
   - ส่วนแก้ไขหัวข้อ, สถานะ, ความเชื่อมั่น และตัวเลขจุดซื้อ/ขาย (Buy / Sell Price)
   - ฟิลด์ Catalysts และ Risks แบบ Textarea อิสระ
   - ฟิลด์ Detailed notes รองรับการเขียนในรูปแบบ **Markdown** พร้อมปุ่ม Toggle Preview
   - ฟิลด์ Timeline Journal log สำหรับจดบันทึกการอัปเดตตลอดการถือครอง
```