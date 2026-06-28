---
type: index
title: "Oaktree Agent Knowledge Bundle"
description: "Knowledge base สำหรับ AI Agent ที่วิเคราะห์การลงทุนด้วยภูมิปัญญาของ Value Investors ระดับปรมาจารย์"
version: "2026.1"
timestamp: "2026-06-28"
---

# Oaktree Agent Knowledge Bundle

คลังความรู้นี้ใช้มาตรฐาน [Google OKF (Open Knowledge Format)](https://github.com/GoogleCloudPlatform/knowledge-catalog) จัดเก็บเป็น Markdown + YAML Frontmatter bundle บน Cloudflare R2

## Categories

### 📚 [Investor Frameworks](frameworks/index.md)
กรอบความคิดและปรัชญาการลงทุนจาก Value Investors ระดับโลก — ใช้เป็น system prompt ใน analysis engine

- [Howard Marks — Second-Level Thinking & Risk](frameworks/howard_marks.md) `type: investment_framework`
- [Hamilton Helmer — 7 Powers](frameworks/hamilton_helmer.md) `type: investment_framework`
- [Warren Buffett — Moat & Margin of Safety](frameworks/warren_buffett.md) `type: investment_framework`
- [Charlie Munger — Mental Models & Inversion](frameworks/charlie_munger.md) `type: investment_framework`
- [Peter Lynch — 6 Stock Categories & PEG](frameworks/peter_lynch.md) `type: investment_framework`
- [Joel Greenblatt — Magic Formula](frameworks/joel_greenblatt.md) `type: investment_framework`

### 📰 [Articles](articles/index.md)
บทความและ stock analysis notes ที่ sync มาจาก NotebookLM อัตโนมัติผ่าน cron job

## Reserved Files
- `index.md` — Bundle navigation (ไฟล์นี้)
- `log.md` — Change history ของ bundle
