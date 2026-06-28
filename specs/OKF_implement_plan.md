นี่คือ **Blueprint Plan** ที่สรุปโครงสร้าง สถาปัตยกรรม และขั้นตอนทั้งหมดที่คุณสามารถคัดลอกไปสั่งให้ Coding Agent (เช่น Claude Engineer, Roo Code หรือสั่งใน Cursor) เพื่อให้ระเบิดโค้ดและตั้งค่าระบบทั้งหมดให้คุณได้ทันทีครับ

---

# AI Agent Knowledge Base Plan (Cloudflare Worker + Google OKF Stack)

## 📌 Project Overview

ระบบ AI Agent ตัวนี้จะทำงานอยู่บน Cloudflare Workers โดยจะค้นหาและดึงความรู้ (Knowledge Base) จาก **Cloudflare R2** ซึ่งไฟล์ความรู้ทั้งหมดจะถูกจัดเก็บตามมาตรฐาน **Google OKF (Open Knowledge Format)** ในรูปแบบไฟล์ Markdown พร้อม YAML Frontmatter เพื่อประสิทธิภาพในการจัดกลุ่มและประหยัดการใช้ Context Window ของ LLM

---

## 📂 System Architecture & Folder Structure

```text
├── okf-knowledge-bundle/           # โฟลเดอร์เก็บคลังความรู้ (อัปโหลดขึ้น R2)
│   ├── assets/                     # เก็บไฟล์รูปภาพ/สื่อประกอบ
│   │   └── system_flow.png
│   ├── company_policy.md           # ตัวอย่างไฟล์ OKF 1
│   └── api_docs.md                 # ตัวอย่างไฟล์ OKF 2
│
└── cloudflare-agent-worker/        # โฟลเดอร์ระบบ Worker (โค้ดสำหรับส่งให้ Agent เขียน)
    ├── wrangler.toml               # ไฟล์ตั้งค่า Cloudflare Configuration
    ├── package.json                # ตัวจัดการ Dependencies (ต้องใช้ js-yaml)
    └── src/
        └── index.js                # โค้ดหลักของ AI Agent (Routing & LLM Prompting)

```

---

## ⚙️ Execution Plan for Coding Agent

ให้ Coding Agent ดำเนินการตาม 3 ขั้นตอนนี้:

### Step 1: Create OKF Sample Files

สร้างไฟล์ตัวอย่างตามมาตรฐาน Google OKF โดยโครงสร้างจะต้องมี YAML Frontmatter อยู่ด้านบนสุดเสมอ

* **`company_policy.md`**
```markdown
---
type: policy
title: "วันหยุดและการลาพักร้อน"
version: "2026.1"
tags: [hr, holiday]
---
# นโยบายการลาพักร้อน
- พนักงานประจำมีสิทธิ์ลาพักร้อนได้ 12 วันต่อปี
- ต้องแจ้งล่วงหน้าอย่างน้อย 3 วันผ่านระบบ HR

```


* **`api_docs.md`**
```markdown
---
type: technical_docs
title: "วิธีการต่อ API สั่งซื้อสินค้า"
tags: [developer, api, order]
---
# การใช้งาน Order API
Endpoint: `POST /v1/orders`
Payload: `{ "product_id": "123", "quantity": 1 }`

```



### Step 2: Configure `wrangler.toml`

ตั้งค่าโปรเจกต์ Cloudflare Worker ให้เชื่อมต่อกับ R2 Bucket และโมเดลโมดูล AI:

```toml
name = "okf-ai-agent"
main = "src/index.js"
compatibility_date = "2026-06-28"

[[r2_buckets]]
binding = "KNOWLEDGE_BUCKET"
bucket_name = "my-agent-knowledge"

[ai]
binding = "AI"

```

### Step 3: Implement Agent Core Logic (`src/index.js`)

เขียนโค้ดเพื่อควบคุมการทำงานของ Agent โดยมี Logic สำคัญดังนี้:

1. **รับคีย์เวิร์ดคำถาม** จากผู้ใช้งานผ่าน Request
2. **ดึง Metadata** โดยเข้าถึงคลังข้อมูลบน `KNOWLEDGE_BUCKET` ผ่านคำสั่ง `env.KNOWLEDGE_BUCKET.list()` และดึงข้อมูลขึ้นมาอ่านเฉพาะไฟล์ที่เกี่ยวข้อง
3. **ทำความเข้าใจเนื้อหา (Parse OKF)** แยกส่วน YAML Frontmatter ออกจากเนื้อหาหลัก
4. **สร้าง Context และส่งต่อให้ LLM** ป้อนเนื้อหาเข้าสู่ระบบร่วมกับข้อความ System Prompt ไปยังโมเดล `@cf/meta/llama-3-8b-instruct` บนระบบ Workers AI แล้วส่งคำตอบปลายทางกลับหาผู้ใช้

---

## 🛠️ Instructions for Coding Agent (Prompt ตัวอย่างสำหรับใช้สั่งงาน)

> "จงสร้างโปรเจกต์ Cloudflare Worker ตามแผนงานด้านบน โดยใช้ `js-yaml` ในการแกะ YAML Frontmatter ของเอกสาร OKF ที่ดึงมาจาก Cloudflare R2 เขียนฟังก์ชันเพื่อสแกนและจับคู่คำถามของผู้ใช้กับ Tag หรือเนื้อหาในโฟลเดอร์ OKF ให้แม่นยำ จากนั้นนำเนื้อหาไปสรุปผลด้วยโมเดล Llama 3 บนระบบ Cloudflare Workers AI"