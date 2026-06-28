---
type: index
title: "Stock Articles"
description: "บทความและ stock analysis notes ที่ sync มาจาก NotebookLM อัตโนมัติ"
tags: [article, stock-analysis, notebook-sync]
timestamp: "2026-06-28"
---

# Stock Articles

บทความใน category นี้ถูก sync อัตโนมัติจาก NotebookLM ผ่าน cron job (`notebookSync.ts`) ทุก 1 ชั่วโมง

## Sync Pipeline

```
NotebookLM Notebook
       │ (headless browser bridge)
       ▼
notebookSync.ts (cron: hourly)
       │ parse articles → OKF Markdown
       ▼
Cloudflare R2: oaktree-knowledge/articles/*.md
       │ env.KNOWLEDGE_BUCKET
       ▼
Agent reads via okf.ts
```

## Articles
<!-- Articles will be listed here as they are synced from NotebookLM -->
<!-- Each article is stored as articles/{slug}.md with OKF frontmatter -->
