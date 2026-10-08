# Oaktree MCP Server (`oaktree-mcp`)

เอกสารแนะนำและคู่มือการเชื่อมต่อสำหรับ Client (เช่น Claude Desktop, Cursor, Gemini Spark, NotebookLM Bridge, หรือ Custom MCP Clients) เพื่อเรียกใช้งานเครื่องมือ (Tools) ต่างๆ บน **Oaktree MCP Server** ซึ่งรันอยู่บน Cloudflare Workers ด้วย Cloudflare Agents SDK และ `@modelcontextprotocol/sdk`

---

## 📌 สารบัญ (Table of Contents)

1. [ข้อมูลภาพรวมของเซิร์ฟเวอร์ (Server Overview)](#-ข้อมูลภาพรวมของเซิร์ฟเวอร์-server-overview)
2. [การยืนยันตัวตนและการเชื่อมต่อ (Authentication & Connection)](#-การยืนยันตัวตนและการเชื่อมต่อ-authentication--connection)
3. [ตัวอย่างการตั้งค่า Client (Client Setup Examples)](#-ตัวอย่างการตั้งค่า-client-client-setup-examples)
   - [Claude Desktop](#1-claude-desktop-claude_desktop_configjson)
   - [Cursor / Windsurf IDE](#2-cursor--windsurf-ide)
   - [Python MCP Client](#3-python-mcp-client)
   - [Node.js / TypeScript MCP Client](#4-nodejs--typescript-mcp-client)
   - [cURL / HTTP Test](#5-curl--http-test)
4. [รายการ Tools ทั้งหมด (MCP Tools Reference)](#-รายการ-tools-ทั้งหมด-mcp-tools-reference)
   - [`get_portfolio`](#1-get_portfolio)
   - [`get_portfolio_history`](#2-get_portfolio_history)
   - [`get_knowledge`](#3-get_knowledge)
   - [`search_knowledge`](#4-search_knowledge)
   - [`get_analysis_report`](#5-get_analysis_report)
   - [`get_watchlist`](#6-get_watchlist)
   - [`save_market_intelligence`](#7-save_market_intelligence)
   - [`create_facebook_post_draft`](#8-create_facebook_post_draft)
   - [`get_recent_intelligence`](#9-get_recent_intelligence)
   - [`save_dcf_scenarios`](#10-save_dcf_scenarios)
   - [`get_dcf_model`](#11-get_dcf_model)
   - [`list_dcf_symbols`](#12-list_dcf_symbols)
5. [Internal & Admin Endpoints เพิ่มเติม](#-internal--admin-endpoints-เพิ่มเติม)
6. [รหัสข้อผิดพลาด (Error Codes & Troubleshooting)](#-รหัสข้อผิดพลาด-error-codes--troubleshooting)

---

## 🌐 ข้อมูลภาพรวมของเซิร์ฟเวอร์ (Server Overview)

- **Server Name**: `oaktree-mcp`
- **Protocol**: Model Context Protocol (MCP) Version 1.0.0
- **Transport**: HTTP POST / Server-Sent Events (SSE) / Stream (`transport: "auto"`)
- **Default Endpoints**:
  - **Production**: `https://<YOUR_WORKER_DOMAIN>/mcp`
  - **Local Development**: `http://localhost:8788/mcp`
- **Durable Object Class**: `OaktreeMCP`

---

## 🔐 การยืนยันตัวตนและการเชื่อมต่อ (Authentication & Connection)

ระบบรองรับการยืนยันตัวตน 2 รูปแบบหลัก:

### 1. Static Secret / Bearer Token (แนะนำสำหรับ Agent/Client ทั่วไป)
เมื่อเซิร์ฟเวอร์ตั้งค่าตัวแปร `MCP_SECRET` ไว้ใน Worker:
- **HTTP Header** (แนะนำ):
  ```http
  Authorization: Bearer <YOUR_MCP_SECRET>
  ```
- **Query Parameter** (สำหรับ Client ที่ไม่สามารถใส่ Custom Header ใน SSE connection):
  ```
  https://<YOUR_WORKER_DOMAIN>/mcp?token=<YOUR_MCP_SECRET>
  ```
  หรือ
  ```
  https://<YOUR_WORKER_DOMAIN>/mcp?key=<YOUR_MCP_SECRET>
  ```

### 2. OAuth 2.0 PKCE Flow
Worker รองรับ RFC 8414 & RFC 9207 สำหรับ Client ที่ต้องการ OAuth Discovery:
- **Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource`
- **Authorization Server Metadata**: `GET /.well-known/oauth-authorization-server`
- **Authorize URL**: `GET /oauth/authorize`
- **Token URL**: `POST /oauth/token`

---

## ⚙️ ตัวอย่างการตั้งค่า Client (Client Setup Examples)

### 1. Claude Desktop (`claude_desktop_config.json`)

สำหรับ Claude Desktop สามารถเชื่อมต่อผ่าน `mcp-remote` bridge หรือ `mcp-proxy`:

```json
{
  "mcpServers": {
    "oaktree": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<YOUR_WORKER_DOMAIN>/mcp",
        "--header",
        "Authorization: Bearer <YOUR_MCP_SECRET>"
      ]
    }
  }
}
```

หรือกรณีทดสอบใน Local Development:
```json
{
  "mcpServers": {
    "oaktree-local": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:8788/mcp",
        "--header",
        "Authorization: Bearer <YOUR_MCP_SECRET>"
      ]
    }
  }
}
```

---

### 2. Cursor / Windsurf IDE

ในหน้าต่าง Settings ของ IDE ไปที่แท็บ **MCP Servers** -> **Add New Server**:
- **Type**: `command` (หรือ `sse` หากรองรับ Header)
- **Command**: `npx`
- **Args**: `["-y", "mcp-remote", "https://<YOUR_WORKER_DOMAIN>/mcp", "--header", "Authorization: Bearer <YOUR_MCP_SECRET>"]`

---

### 3. Python MCP Client

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

MCP_URL = "https://<YOUR_WORKER_DOMAIN>/mcp"
HEADERS = {"Authorization": "Bearer <YOUR_MCP_SECRET>"}

async def main():
    async with sse_client(MCP_URL, headers=HEADERS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # 1. แสดงรายการ Tools ทั้งหมด
            tools = await session.list_tools()
            print("Available Tools:", [t.name for t in tools.tools])
            
            # 2. ตัวอย่างการเรียกใช้ get_watchlist
            result = await session.call_tool("get_watchlist", arguments={"active_only": True})
            print("Watchlist Result:", result.content[0].text)

asyncio.run(main())
```

---

### 4. Node.js / TypeScript MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  const transport = new SSEClientTransport(
    new URL("https://<YOUR_WORKER_DOMAIN>/mcp"),
    {
      eventSourceInit: {
        headers: {
          Authorization: "Bearer <YOUR_MCP_SECRET>",
        },
      },
      requestInit: {
        headers: {
          Authorization: "Bearer <YOUR_MCP_SECRET>",
        },
      },
    }
  );

  const client = new Client({ name: "my-app", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  // เรียกใช้ Tool
  const portfolio = await client.callTool({
    name: "get_portfolio",
    arguments: {},
  });
  console.log(portfolio.content[0].text);
}

run();
```

---

### 5. cURL / HTTP Test

สามารถทดสอบเบื้องต้นผ่าน JSON-RPC 2.0:

```bash
curl -X POST "https://<YOUR_WORKER_DOMAIN>/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_MCP_SECRET>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_watchlist",
      "arguments": {
        "active_only": true
      }
    }
  }'
```

---

## 🛠️ รายการ Tools ทั้งหมด (MCP Tools Reference)

สรุปเครื่องมือทั้งหมด 9 รายการที่ลงทะเบียนไว้ใน `OaktreeMCP`:

| Tool Name | คำอธิบาย | พารามิเตอร์ |
| :--- | :--- | :--- |
| [`get_portfolio`](#1-get_portfolio) | ดึงข้อมูลหุ้นที่ถือครองในพอร์ตจริง (19 symbols) พร้อมต้นทุน, กำไรขาดทุน และ thesis | *ไม่มี* |
| [`get_portfolio_history`](#2-get_portfolio_history) | ดึงประวัติผลตอบแทนพอร์ตลงทุนย้อนหลังรายปี | *ไม่มี* |
| [`get_knowledge`](#3-get_knowledge) | ดึงหลักปรัชญาและกรอบการลงทุนตาม Category ที่ระบุ | `category` (string, required) |
| [`search_knowledge`](#4-search_knowledge) | ค้นหาบทความความรู้และรายการ Watchlist ด้วยคำค้นหา | `query` (string, required) |
| [`get_analysis_report`](#5-get_analysis_report) | ดึงรายงานวิเคราะห์เจาะลึกแบบ Value Investor ล่าสุดของหุ้น | `symbol` (string, required) |
| [`get_watchlist`](#6-get_watchlist) | ดึงรายการหุ้นใน Watchlist (24 symbols) พร้อมราคาเป้าหมายและราคาตลาด | `active_only` (boolean, optional) |
| [`save_market_intelligence`](#7-save_market_intelligence) | บันทึกข่าวสารและบทวิเคราะห์ตลาดลงฐานข้อมูล D1 และ R2 Knowledge Base | `title`, `summary`, `key_takeaways`, `symbol`, ฯลฯ |
| [`create_facebook_post_draft`](#8-create_facebook_post_draft) | สร้างร่างโพสต์ Facebook (Draft) เพื่อให้ผู้ใช้ตรวจสอบก่อนเผยแพร่ | `title`, `content` (strings, required) |
| [`get_recent_intelligence`](#9-get_recent_intelligence) | ดึงข่าวและบทวิเคราะห์ตลาดล่าสุดที่บันทึกไว้ในระบบ | `limit`, `source` (optional) |

---

### 1. `get_portfolio`
ดึงข้อมูลหุ้นทั้งหมดที่ผู้ใช้ถือครองอยู่จริงในพอร์ตฟอลิโอ (Current Holdings รวม 19 symbols) รวมถึงจำนวนหุ้น, ต้นทุนเฉลี่ย, มูลค่าตลาดปัจจุบัน, กำไรขาดทุน (Unrealized P&L ทั้งจำนวนเงินและเปอร์เซ็นต์), กำไรประจำวัน (Day gain), น้ำหนักเป้าหมาย (target weight) และ Investment Thesis

> **ข้อสังเกต**: Tool นี้สำหรับหุ้นที่ซื้อ/ถือครองจริงเท่านั้น หากต้องการดูหุ้นใน Watchlist ให้เรียก `get_watchlist`

#### Parameters
*ไม่มีพารามิเตอร์* `{}`

#### Response Example
```json
[
  {
    "symbol": "GOOGL",
    "shares": 100,
    "avg_cost": 140.50,
    "total_cost": 14050.00,
    "status": "Active",
    "current_price": 182.30,
    "previous_close": 180.10,
    "current_value": 18230.00,
    "unrealized_gain_loss": 4180.00,
    "unrealized_gain_loss_pct": 29.75,
    "day_gain_amt": 220.00,
    "day_gain_pct": 1.22,
    "target_weight": 0.15,
    "thesis": "High moat in search and digital advertising with strong AI monetization potential.",
    "category": "Mega-cap Tech"
  }
]
```

---

### 2. `get_portfolio_history`
ดึงประวัติผลตอบแทนและการเติบโตของพอร์ตลงทุนย้อนหลังรายปีจากตาราง `portfolio_history`

#### Parameters
*ไม่มีพารามิเตอร์* `{}`

#### Response Example
```json
[
  {
    "year": 2023,
    "starting_balance": 100000,
    "ending_balance": 128500,
    "return_pct": 28.5,
    "benchmark_return_pct": 24.2
  },
  {
    "year": 2024,
    "starting_balance": 128500,
    "ending_balance": 164000,
    "return_pct": 27.6,
    "benchmark_return_pct": 23.3
  }
]
```

---

### 3. `get_knowledge`
ดึงหลักปรัชญา กรอบการลงทุน (Frameworks) และคู่มือตาม Category จาก Knowledge Base

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `category` | `string` | **Yes** | หมวดหมู่ความรู้ เช่น `'intelligent_investor'`, `'buffett_principles'`, `'five_forces'`, `'margin_of_safety'` |

#### Example Call
```json
{
  "category": "buffett_principles"
}
```

#### Response Example
```json
[
  {
    "id": 4,
    "category": "buffett_principles",
    "title": "Circle of Competence",
    "content": "Know where the perimeter of your circle of competence lies and stay inside it.",
    "created_at": "2026-01-10 12:00:00"
  }
]
```

---

### 4. `search_knowledge`
ค้นหาข้อมูลใน Knowledge Base และ Watchlist ด้วยคำค้นหา (Full text search ในหัวข้อและเนื้อหา) 
*กรณีที่ค้นหาด้วยคำว่า "watchlist" จะผนวกสรุปรายการหุ้นทั้งหมดใน Watchlist กลับมาให้ด้วยโดยอัตโนมัติ*

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | `string` | **Yes** | คำค้นหา เช่น `'margin of safety'`, `'moat'`, `'watchlist'`, หรือชื่อแนวคิดการลงทุน |

#### Example Call
```json
{
  "query": "moat"
}
```

#### Response Example
```json
[
  {
    "id": 12,
    "category": "five_forces",
    "title": "Economic Moats & Competitive Advantage",
    "content": "A sustainable competitive advantage that allows a company to maintain superior profitability..."
  }
]
```

---

### 5. `get_analysis_report`
ดึงรายงานวิเคราะห์เจาะลึกฉบับล่าสุด (Value Investor Deep Analysis Report) ของหุ้นที่ระบุจากตาราง `analysis_results`

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `symbol` | `string` | **Yes** | สัญลักษณ์หุ้น (Ticker symbol) เช่น `AAPL`, `MSFT`, `NVDA` |

#### Example Call
```json
{
  "symbol": "AAPL"
}
```

#### Response Example
```json
{
  "id": 105,
  "symbol": "AAPL",
  "score": 85,
  "recommendation": "BUY",
  "dcf_fair_value": 245.0,
  "summary": "Apple retains unprecedented brand equity and ecosystem stickiness...",
  "created_at": "2026-10-01 10:30:00"
}
```

---

### 6. `get_watchlist`
ดึงรายชื่อหุ้นทั้งหมดใน Watchlist ของผู้ใช้ (ทั้งหมด 24 หุ้น) พร้อมชื่อบริษัท, อุตสาหกรรม (Sector), ราคาเป้าหมาย (Target Price), ราคาสดตลาด, P/E Ratio และสถานะ Active

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `active_only` | `boolean` | No | หากเป็น `true` จะดึงเฉพาะหุ้นที่มีสถานะ Active (21 หุ้น), หากละเว้นหรือเป็น `false` จะดึงทั้งหมด 24 หุ้น |

#### Example Call
```json
{
  "active_only": true
}
```

#### Response Example
```json
[
  {
    "symbol": "NVDA",
    "name": "NVIDIA Corporation",
    "sector": "Semiconductors",
    "target_price": 110.0,
    "thesis": "Dominant GPU supplier for accelerated AI compute workloads.",
    "is_active": 1,
    "current_price": 125.40,
    "pe_ratio": 48.2,
    "fifty_two_week_high": 140.76,
    "fifty_two_week_low": 45.12
  }
]
```

---

### 7. `save_market_intelligence`
บันทึกสรุปข่าวสารตลาดและบทวิเคราะห์การลงทุน (เช่น จาก Gemini Spark หรือ External Agent) ลงสู่:
1. ฐานข้อมูล D1 ตาราง `notebook_articles`
2. Cloudflare R2 Knowledge Bucket ในรูปแบบ OKF Markdown (`articles/<slug>.md`)
3. (ตัวเลือก) จัดคิวลง `facebook_posts` หากตั้งค่า `auto_publish_facebook: true`

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | หัวข้อข่าวหรือบทวิเคราะห์ |
| `summary` | `string` | **Yes** | เนื้อหาสรุปกระชับ 1-3 ย่อหน้า |
| `key_takeaways` | `string[]` หรือ `string` | No | ประเด็นสำคัญ / ข้อคิดหลัก (Array ของ string หรือข้อความ bullet) |
| `symbol` | `string` | No | สัญลักษณ์หุ้นที่เกี่ยวข้อง (เช่น `NVDA`, `TSM`) หรือ null สำหรับภาพรวม Macro |
| `category` | `string` | No | หมวดหมู่ เช่น `'Macro'`, `'Earnings'`, `'Semiconductors'`, `'Valuation'` |
| `source` | `string` | No | แหล่งที่มา (Default: `'gemini_spark'`) |
| `url` | `string` | No | ลิงก์อ้างอิงต้นทางของข่าว |
| `auto_publish_facebook` | `boolean` | No | หากเป็น `true` จะจัดคิวส่งโพสต์ไปยัง Facebook Page อัตโนมัติ |

#### Example Call
```json
{
  "title": "Fed Rate Decision and Semiconductor Capex Outlook",
  "summary": "Federal Reserve indicates gradual rate adjustments as hyperscalers increase datacenter capex spending.",
  "key_takeaways": [
    "Hyperscaler capex projected to increase 18% YoY",
    "Supply chain constraints easing for advanced packaging",
    "Valuation multiples remain within historical 5-year averages"
  ],
  "symbol": "NVDA",
  "category": "Semiconductors",
  "source": "gemini_spark",
  "url": "https://example.com/news/123",
  "auto_publish_facebook": false
}
```

#### Response Example
```json
{
  "success": true,
  "id": 42,
  "title": "Fed Rate Decision and Semiconductor Capex Outlook",
  "symbol": "NVDA",
  "source": "gemini_spark",
  "auto_publish": false,
  "r2_key": "articles/fed_rate_decision_and_semiconductor_capex_outlook.md"
}
```

---

### 8. `create_facebook_post_draft`
บันทึกฉบับร่างโพสต์ Facebook (Custom Draft) ลงในระบบ Oaktree เพื่อให้ผู้ใช้สามารถตรวจสอบ แก้ไข หรือกดเผยแพร่ได้ผ่านหน้าแดชบอร์ด

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | หัวข้อเรื่อง หรือประเด็นของโพสต์ |
| `content` | `string` | **Yes** | ข้อความเนื้อหาภาษาไทยสำหรับโพสต์ลง Facebook |

#### Example Call
```json
{
  "title": "ข้อคิดเรื่อง Circle of Competence จาก Howard Marks",
  "content": "ในการลงทุน การรู้ว่าเราไม่รู้อะไรสำคัญกว่าการพยายามรู้ทุกเรื่อง... #ValueInvesting #Oaktree"
}
```

#### Response Example
```json
{
  "success": true,
  "message": "Facebook post draft created successfully",
  "title": "ข้อคิดเรื่อง Circle of Competence จาก Howard Marks"
}
```

---

### 9. `get_recent_intelligence`
ดึงรายการข่าวและบทวิเคราะห์ตลาดล่าสุดที่เคยถูกบันทึกไว้ในฐานข้อมูล (`notebook_articles`)

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `limit` | `number` | No | จำนวนบทความที่ต้องการดึง (Default: 10, สูงสุด 50) |
| `source` | `string` | No | กรองตามแหล่งที่มา เช่น `'gemini_spark'` หรือ `'notebooklm'` |

#### Example Call
```json
{
  "limit": 5,
  "source": "gemini_spark"
}
```

#### Response Example
```json
[
  {
    "id": 42,
    "title": "Fed Rate Decision and Semiconductor Capex Outlook",
    "symbol": "NVDA",
    "summary": "Federal Reserve indicates gradual rate adjustments...",
    "key_takeaways": "[\"Hyperscaler capex projected to increase 18% YoY\"]",
    "source": "gemini_spark",
    "category": "Semiconductors",
    "created_at": "2026-10-07 10:41:00"
  }
]
```

---

### 10. `save_dcf_scenarios`
บันทึกผลลัพธ์ DCF Model ทั้ง 3 Scenarios (`Base Case`, `Bull Case`, `Bear Case`) ของหุ้นตัวใดตัวหนึ่งกลับเข้าสู่ฐานข้อมูล D1 (`dcf_calculations`) ในคราวเดียวแบบ Atomic Batch

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `symbol` | `string` | **Yes** | รหัสย่อหุ้น (เช่น `NVDA`, `AAPL`) |
| `sync_target_price` | `boolean` | No | หากเป็น `true` จะนำ `implied_share_price` ของ `Base Case` ไปอัปเดตเป็น `target_price` ใน Watchlist ให้อัตโนมัติ (Default: `false`) |
| `scenarios` | `array` | **Yes** | รายการ Scenarios (1 ถึง 3 รายการ: Base Case, Bull Case, Bear Case) |

**โครงสร้างภายในแต่ละ Scenario:**
- `scenario_name` (*Required*): `'Base Case'` \| `'Bull Case'` \| `'Bear Case'`
- `mode` (*Optional*): `'detailed'` (Default) หรือ `'uniform'`
- `base_revenue` (*Required*): รายได้ตั้งต้น ($B)
- `shares_outstanding` (*Required*): จำนวนหุ้นทั้งหมดในหน่วย **ล้านหุ้น ($M$)** (ห้ามใส่หน่วยพันล้าน เช่น หุ้น 15B ให้ใส่ 15000)
- `net_cash` (*Optional*): เงินสดสุทธิ ($B) (Total Cash - Total Debt) (Default: `0`)
- `wacc` (*Required*): อัตราคิดลด / WACC (%)
- `terminal_growth` (*Required*): Perpetual growth rate (%) ต้องน้อยกว่า WACC
- `tax_rate` (*Optional*): อัตราภาษีนิติบุคคล (%) (Default: `21`)
- `exit_multiple` (*Optional*): 5-Year terminal exit multiple (Default: `20.0`)
- `target_shares` (*Optional*): จำนวนหุ้นคาดการณ์ปีที่ 5 ($M)
- `implied_share_price` (*Required*): มูลค่าหุ้นที่แท้จริงจากการคำนวณ ($)
- `yearly_growth` (*Optional*): อัตราเติบโตของรายได้ 5 ปี `[yr1, yr2, yr3, yr4, yr5]` (%)
- `yearly_op_margin` (*Optional*): อัตรากำไรจากการดำเนินงาน 5 ปี `[yr1, yr2, yr3, yr4, yr5]` (%)
- `yearly_fcf_conv` (*Optional*): อัตราการแปลง FCF 5 ปี `[yr1, yr2, yr3, yr4, yr5]` (%)
- `rationale` (*Optional*): คำอธิบายสมมติฐานและเหตุผลเบื้องหลังของ Scenario นี้
- `source` (*Optional*): แหล่งที่มา (Default: `'gemini_spark'`)

---

### 11. `get_dcf_model`
ดึงข้อมูลและสมมติฐาน DCF Model ทั้งหมดของหุ้นที่ระบุ พร้อมเปรียบเทียบกับราคาตลาดปัจจุบัน (`market_stats`) และคำนวณ Upside/Downside และ Margin of Safety ให้อัตโนมัติ

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `symbol` | `string` | **Yes** | รหัสย่อหุ้น เช่น `NVDA` |

#### Response Example
```json
{
  "symbol": "NVDA",
  "current_price": 125.40,
  "scenarios": [
    {
      "scenario_name": "Base Case",
      "implied_share_price": 142.50,
      "upside_downside_pct": 13.64,
      "margin_of_safety_pct": 12.00,
      "mode": "detailed",
      "wacc": 10.5,
      "terminal_growth": 3.0,
      "exit_multiple": 25.0,
      "yearly_growth": [35, 25, 20, 15, 12],
      "rationale": "Base case assumes sustained data center capex...",
      "source": "gemini_spark",
      "created_at": "2026-10-08 23:30:00"
    }
  ]
}
```

---

### 12. `list_dcf_symbols`
ดึงรายชื่อหุ้นทั้งหมดที่มีการประเมินและบันทึกโมเดล DCF ไว้ในระบบ พร้อมสรุปราคาประเมิน Base Case และวันที่ประเมินล่าสุด

#### Parameters
*ไม่มีพารามิเตอร์*

---

## 🔒 Internal & Admin Endpoints เพิ่มเติม

นอกเหนือจาก MCP Tools หลักแล้ว Worker นี้ยังมีฟังก์ชันการทำงานส่วนขยายดังนี้:

### 1. Database Agent Tools (`/database-chat`)
เมื่อเปิดใช้งาน `ENABLE_DATABASE_AGENT = "true"` ในตัวแปรสภาพแวดล้อม:
- Endpoint: `POST /database-chat` (ต้องมี JWT Authentication)
- เครื่องมือที่มี:
  - `list_d1_tables`: แสดงรายชื่อตารางทั้งหมดใน D1
  - `get_d1_table_schema`: ดูนิยามคอลัมน์ของตาราง
  - `execute_d1_sql`: รันคำสั่ง SQL โดยตรง (SELECT สูงสุด 100 แถว, INSERT, UPDATE, DDL)
  - `list_r2_objects`: แสดงไฟล์ใน Bucket `oaktree-assets`
  - `get_r2_object`: อ่านไฟล์ข้อความหรือ JSON จาก R2
  - `put_r2_object`: อัปโหลดหรือเขียนทับไฟล์ใน R2
  - `delete_r2_object`: ลบไฟล์ใน R2

### 2. Oaktree Chat Agent (`/agents/oaktree-chat/:sessionId`)
- สตรีมข้อความตอบโต้กับ AI Assistant ที่ถูก Inject บริบทของ Portfolio และ Watchlist แบบเรียลไทม์
- ตรวจสอบสิทธิ์ผ่าน JWT และแยกประวัติการสนทนาตามผู้ใช้

---

## 🚨 รหัสข้อผิดพลาด (Error Codes & Troubleshooting)

| Code | HTTP Status | ความหมาย | แนวทางแก้ไข |
| :--- | :--- | :--- | :--- |
| `-32000` | `401 Unauthorized` | ขาด Token หรือ Token ไม่ถูกต้อง | ตรวจสอบว่าได้แนบ Header `Authorization: Bearer <MCP_SECRET>` หรือ parameter `?token=<SECRET>` ถูกต้องหรือไม่ |
| `-32603` | `500 Internal Error` | เกิดข้อผิดพลาดภายใน Worker | ตรวจสอบ Cloudflare Worker Logs (`npx wrangler tail`) หรือตรวจสอบการเชื่อมต่อฐานข้อมูล D1 |
| `-32601` | `400 Method not found` | ไม่พบชื่อ Tool ที่เรียก | ตรวจสอบว่าสะกดชื่อ Tool ถูกต้องตามรายการทั้ง 9 ตัวข้างต้น |
| `-32602` | `400 Invalid params` | พารามิเตอร์ไม่ตรงตาม Zod Schema | ตรวจสอบชนิดข้อมูล (Types) และฟิลด์ที่ Required ให้ครบถ้วน |

---

## 🧪 การทดสอบระบบ (Running Tests)

รันชุดการทดสอบ Unit Test ภายใน `mcp-worker`:
```bash
npm test
```
ครอบคลุมการตรวจสอบความถูกต้องของการลงทะเบียน Tools ทั้ง 9 รายการ, Input Validation, Authentication, และการสื่อสารผ่าน MCP Transport

