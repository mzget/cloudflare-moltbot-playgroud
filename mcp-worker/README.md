# Oaktree MCP Server (`oaktree-mcp`)

เอกสารแนะนำและคู่มือการเชื่อมต่อสำหรับ Client (เช่น Google Gemini Custom Apps / Spark, Antigravity, Claude Desktop, Cursor, Windsurf หรือ Custom MCP Clients) เพื่อเรียกใช้งานเครื่องมือ (Tools) ทั้ง 20 รายการบน **Oaktree MCP Server** ซึ่งรันอยู่บน Cloudflare Workers ด้วย Cloudflare Agents SDK และ `@modelcontextprotocol/sdk`

---

## 📌 สารบัญ (Table of Contents)

1. [ข้อมูลภาพรวมของเซิร์ฟเวอร์ (Server Overview)](#-ข้อมูลภาพรวมของเซิร์ฟเวอร์-server-overview)
2. [การยืนยันตัวตนและการเชื่อมต่อ (Authentication & Connection)](#-การยืนยันตัวตนและการเชื่อมต่อ-authentication--connection)
3. [ตัวอย่างการตั้งค่า Client (Client Setup Examples)](#-ตัวอย่างการตั้งค่า-client-client-setup-examples)
   - [Google Gemini (Custom Apps / Spark) & Antigravity](#1-google-gemini-custom-apps--spark--antigravity-mcp_configjson)
   - [Claude Desktop](#2-claude-desktop-claude_desktop_configjson)
   - [Cursor / Windsurf IDE](#3-cursor--windsurf-ide)
   - [Python MCP Client](#4-python-mcp-client)
   - [Node.js / TypeScript MCP Client](#5-nodejs--typescript-mcp-client)
   - [cURL / HTTP Test](#6-curl--http-test)
4. [รายการ Tools ทั้งหมด 20 รายการ (MCP Tools Reference)](#-รายการ-tools-ทั้งหมด-20-รายการ-mcp-tools-reference)
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
   - [`save_fundamental_brief` & `get_fundamental_brief`](#13-save_fundamental_brief--get_fundamental_brief)
   - [`save_bull_bear_debate` & `get_bull_bear_debate`](#14-save_bull_bear_debate--get_bull_bear_debate)
   - [`save_theme_sector_context`](#15-save_theme_sector_context)
   - [`get_portfolio_risk_audit`, `calculate_position_size` & `save_risk_advisory`](#16-get_portfolio_risk_audit-calculate_position_size--save_risk_advisory)
5. [Internal & Admin Endpoints เพิ่มเติม](#-internal--admin-endpoints-เพิ่มเติม)
6. [รหัสข้อผิดพลาด (Error Codes & Troubleshooting)](#-รหัสข้อผิดพลาด-error-codes--troubleshooting)

---

## 🌐 ข้อมูลภาพรวมของเซิร์ฟเวอร์ (Server Overview)

| รายการ | ค่า (Value) | หมายเหตุ |
| :--- | :--- | :--- |
| **Server Name** | `oaktree-mcp` | Cloudflare Worker + Durable Object (`OaktreeMCP`) |
| **Protocol** | Model Context Protocol (MCP) 1.0.0 | JSON-RPC 2.0 |
| **Transport** | Streamable HTTP (POST) / SSE (GET) | `transport: "auto"` |
| **Production Endpoint** | `https://oaktree-mcp.nattapon-r.workers.dev/mcp` | URL หลักสำหรับ Production |
| **Local Dev Endpoint** | `http://localhost:8788/mcp` | รันผ่าน `npm run dev --workspace=oaktree-mcp` |
| **MCP Secret (`MCP_SECRET`)** | ดูค่าได้ที่ไฟล์ [`.dev.vars`](./.dev.vars) | รูปแบบ `ot_mcp_<32-char-hex>` |
| **OAuth 2.0 Client ID** | `oaktree-gemini` | สำหรับ Client ที่ใช้ OAuth 2.0 PKCE Flow |
| **OAuth 2.0 Client Secret** | ใช้ค่าเดียวกับ `MCP_SECRET` | หรือกำหนดแยกผ่าน `OAUTH_CLIENT_SECRET` |

---

## 🔐 การยืนยันตัวตนและการเชื่อมต่อ (Authentication & Connection)

ระบบรองรับการยืนยันตัวตน 2 รูปแบบหลัก:

### 1. Static Secret / Bearer Token (แนะนำสำหรับ Agent/Client ทั่วไป)
เมื่อเซิร์ฟเวอร์ตั้งค่าตัวแปร `MCP_SECRET` ไว้ใน Worker:
- **HTTP Header** (แนะนำ):
  ```http
  Authorization: Bearer <YOUR_MCP_SECRET>
  ```
- **Query Parameter** (สำหรับ Client ที่รับเฉพาะ URL เดียว เช่น Google Gemini Custom Apps / Spark):
  ```text
  https://oaktree-mcp.nattapon-r.workers.dev/mcp?token=<YOUR_MCP_SECRET>
  ```
  หรือ
  ```text
  https://oaktree-mcp.nattapon-r.workers.dev/mcp?key=<YOUR_MCP_SECRET>
  ```

### 2. OAuth 2.0 PKCE Flow
Worker รองรับ RFC 8414 & RFC 9207 สำหรับ Client ที่ต้องการ OAuth Discovery:
- **Client ID**: `oaktree-gemini`
- **Client Secret**: `<YOUR_MCP_SECRET>`
- **Protected Resource Metadata**: `GET https://oaktree-mcp.nattapon-r.workers.dev/.well-known/oauth-protected-resource`
- **Authorization Server Metadata**: `GET https://oaktree-mcp.nattapon-r.workers.dev/.well-known/oauth-authorization-server`
- **Authorize URL**: `GET https://oaktree-mcp.nattapon-r.workers.dev/oauth/authorize`
- **Token URL**: `POST https://oaktree-mcp.nattapon-r.workers.dev/oauth/token`

---

## ⚙️ ตัวอย่างการตั้งค่า Client (Client Setup Examples)

### 1. Google Gemini (Custom Apps / Spark) & Antigravity (`mcp_config.json`)

#### สำหรับ Google Gemini (Custom Apps / Spark)
1. เข้าเว็บ [gemini.google.com](https://gemini.google.com) -> **Settings & help** -> **Connected Apps** -> **Add a custom app**
2. วาง URL ด้านล่าง (แทนที่ `<YOUR_MCP_SECRET>` ด้วยค่าจากไฟล์ [`.dev.vars`](./.dev.vars)):
   ```text
   https://oaktree-mcp.nattapon-r.workers.dev/mcp?token=<YOUR_MCP_SECRET>
   ```
3. สำหรับคำสั่ง System Instructions ของ Custom Gem สามารถคัดลอกจาก [`.agents/skills/oaktree-gemini-copilot/SKILL.md`](../.agents/skills/oaktree-gemini-copilot/SKILL.md)

#### สำหรับ Antigravity (`~/.gemini/config/mcp_config.json`)
เพิ่มบล็อก `"oaktree-mcp"` ลงในไฟล์ `C:\Users\<USER>\.gemini\config\mcp_config.json`:

```json
{
  "mcpServers": {
    "oaktree-mcp": {
      "serverUrl": "https://oaktree-mcp.nattapon-r.workers.dev/mcp?token=<YOUR_MCP_SECRET>"
    }
  }
}
```

---

### 2. Claude Desktop (`claude_desktop_config.json`)

สำหรับ Claude Desktop สามารถเชื่อมต่อผ่าน `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "oaktree-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://oaktree-mcp.nattapon-r.workers.dev/mcp",
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

### 3. Cursor / Windsurf IDE

ในหน้าต่าง Settings ของ IDE ไปที่แท็บ **MCP Servers** -> **Add New Server**:
- **Name**: `oaktree-mcp`
- **Type**: `command` (หรือ `sse` หากรองรับ Header)
- **Command**: `npx`
- **Args**: `["-y", "mcp-remote", "https://oaktree-mcp.nattapon-r.workers.dev/mcp", "--header", "Authorization: Bearer <YOUR_MCP_SECRET>"]`

---

### 4. Python MCP Client

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

MCP_URL = "https://oaktree-mcp.nattapon-r.workers.dev/mcp"
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

### 5. Node.js / TypeScript MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  const transport = new SSEClientTransport(
    new URL("https://oaktree-mcp.nattapon-r.workers.dev/mcp"),
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

### 6. cURL / HTTP Test

สามารถทดสอบเบื้องต้นผ่าน JSON-RPC 2.0:

```bash
curl -X POST "https://oaktree-mcp.nattapon-r.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
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

## 🛠️ รายการ Tools ทั้งหมด 20 รายการ (MCP Tools Reference)

สรุปเครื่องมือทั้งหมด 20 รายการที่ลงทะเบียนไว้ใน `OaktreeMCP`:

| หมวดหมู่ | Tool Name | คำอธิบาย | พารามิเตอร์หลัก |
| :--- | :--- | :--- | :--- |
| **Portfolio & Risk** | [`get_portfolio`](#1-get_portfolio) | ดึงข้อมูลหุ้นที่ถือครองในพอร์ตจริง (19 symbols) พร้อมต้นทุน, กำไรขาดทุน และ thesis | *ไม่มี* |
| | [`get_portfolio_history`](#2-get_portfolio_history) | ดึงประวัติผลตอบแทนพอร์ตลงทุนย้อนหลังรายปี | *ไม่มี* |
| | [`get_portfolio_risk_audit`](#16-get_portfolio_risk_audit-calculate_position_size--save_risk_advisory) | ตรวจสอบความเสี่ยงพอร์ตแบบครบวงจร (Health Score, Beta, Correlation, น้ำหนักหุ้น/Theme, Sizing Room) | *ไม่มี* |
| | [`calculate_position_size`](#16-get_portfolio_risk_audit-calculate_position_size--save_risk_advisory) | คำนวณขนาดไม้ลงทุนตามกฎ Fixed-Base (8% Target, 15% Stock Cap, 30% Theme Cap) และจำลองก่อนเทรด | `symbol`, `price`, `shares`, `type` |
| | [`save_risk_advisory`](#16-get_portfolio_risk_audit-calculate_position_size--save_risk_advisory) | บันทึกคำแนะนำจาก Chief Risk Officer (Health Score, Risk Level, คำเตือน, แผนปรับพอร์ต) ลง D1 | `health_score`, `risk_level`, `executive_summary`, `key_warnings`, `rebalancing_actions` |
| **DCF Valuation** | [`save_dcf_scenarios`](#10-save_dcf_scenarios) | บันทึกโมเดล DCF ทั้ง 3 Scenarios (`Base Case`, `Bull Case`, `Bear Case`) แบบ Atomic Overwrite | `symbol`, `scenarios`, `sync_target_price` |
| | [`get_dcf_model`](#11-get_dcf_model) | ดึงข้อมูล DCF Scenarios ของหุ้น พร้อมคำนวณ Upside/Downside % และ Margin of Safety % | `symbol` |
| | [`list_dcf_symbols`](#12-list_dcf_symbols) | แสดงรายชื่อหุ้นทั้งหมดที่มีโมเดล DCF ในระบบ พร้อมราคาประเมิน Base Case ล่าสุด | *ไม่มี* |
| **Fundamental & Debate** | [`save_fundamental_brief`](#13-save_fundamental_brief--get_fundamental_brief) | บันทึกข้อมูลพื้นฐานเชิงคุณภาพของบริษัท + โต้วาที Bull vs. Bear 3 รอบ + สร้างไฟล์ OKF ลง R2 | `symbol`, `business_model`, `moat`, `competitors`, `guidance`, `key_risks`, `thesis_kpis`, `debate` |
| | [`get_fundamental_brief`](#13-save_fundamental_brief--get_fundamental_brief) | ดึงข้อมูลวิเคราะห์พื้นฐานเชิงคุณภาพและบริบท Theme ของหุ้นที่ระบุ | `symbol` |
| | [`save_bull_bear_debate`](#14-save_bull_bear_debate--get_bull_bear_debate) | บันทึกผลการโต้วาทีเชิงวิพากษ์ (Bull vs. Bear 3 รอบ) พร้อม `conviction_score` (-10 ถึง +10) | `symbol`, `as_of_date`, `round1`, `round2`, `round3` |
| | [`get_bull_bear_debate`](#14-save_bull_bear_debate--get_bull_bear_debate) | ดึงข้อมูลการโต้วาที Bull vs. Bear และคะแนนความเชื่อมั่นของหุ้นที่ระบุ | `symbol` |
| | [`save_theme_sector_context`](#15-save_theme_sector_context) | บันทึกบริบทอุตสาหกรรม/Theme (แนวโน้ม, คอขวดห่วงโซ่อุปทาน, การแข่งขัน) และผูกกับรหัสหุ้น | `theme_name`, `industry_dynamics`, `symbols`, ฯลฯ |
| **Watchlist & News** | [`get_watchlist`](#6-get_watchlist) | ดึงรายการหุ้นใน Watchlist (24 symbols) พร้อมราคาเป้าหมายและราคาตลาด | `active_only` (optional) |
| | [`save_market_intelligence`](#7-save_market_intelligence) | บันทึกข่าวสารและบทวิเคราะห์ตลาดลงฐานข้อมูล D1 และ R2 Knowledge Base | `title`, `summary`, `key_takeaways`, `symbol`, ฯลฯ |
| | [`create_facebook_post_draft`](#8-create_facebook_post_draft) | สร้างร่างโพสต์ Facebook (Draft) เพื่อให้ผู้ใช้ตรวจสอบก่อนเผยแพร่ | `title`, `content` |
| | [`get_recent_intelligence`](#9-get_recent_intelligence) | ดึงข่าวและบทวิเคราะห์ตลาดล่าสุดที่บันทึกไว้ในระบบ | `limit`, `source` (optional) |
| | [`get_knowledge`](#3-get_knowledge) | ดึงหลักปรัชญาและกรอบการลงทุนตาม Category ที่ระบุ | `category` |
| | [`search_knowledge`](#4-search_knowledge) | ค้นหาบทความความรู้และรายการ Watchlist ด้วยคำค้นหา | `query` |
| | [`get_analysis_report`](#5-get_analysis_report) | ดึงรายงานวิเคราะห์เจาะลึกแบบ Value Investor ล่าสุดของหุ้น | `symbol` |

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

---

### 4. `search_knowledge`
ค้นหาข้อมูลใน Knowledge Base และ Watchlist ด้วยคำค้นหา (Full text search ในหัวข้อและเนื้อหา) 
*กรณีที่ค้นหาด้วยคำว่า "watchlist" จะผนวกสรุปรายการหุ้นทั้งหมดใน Watchlist กลับมาให้ด้วยโดยอัตโนมัติ*

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | `string` | **Yes** | คำค้นหา เช่น `'margin of safety'`, `'moat'`, `'watchlist'`, หรือชื่อแนวคิดการลงทุน |

---

### 5. `get_analysis_report`
ดึงรายงานวิเคราะห์เจาะลึกฉบับล่าสุด (Value Investor Deep Analysis Report) ของหุ้นที่ระบุจากตาราง `analysis_results`

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `symbol` | `string` | **Yes** | สัญลักษณ์หุ้น (Ticker symbol) เช่น `AAPL`, `MSFT`, `NVDA` |

---

### 6. `get_watchlist`
ดึงรายชื่อหุ้นทั้งหมดใน Watchlist ของผู้ใช้ (ทั้งหมด 24 หุ้น) พร้อมชื่อบริษัท, อุตสาหกรรม (Sector), ราคาเป้าหมาย (Target Price), ราคาสดตลาด, P/E Ratio และสถานะ Active

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `active_only` | `boolean` | No | หากเป็น `true` จะดึงเฉพาะหุ้นที่มีสถานะ Active (21 หุ้น), หากละเว้นหรือเป็น `false` จะดึงทั้งหมด 24 หุ้น |

---

### 7. `save_market_intelligence`
บันทึกสรุปข่าวสารตลาดและบทวิเคราะห์การลงทุนลงสู่:
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

---

### 8. `create_facebook_post_draft`
บันทึกฉบับร่างโพสต์ Facebook (Custom Draft) ลงในระบบ Oaktree เพื่อให้ผู้ใช้สามารถตรวจสอบ แก้ไข หรือกดเผยแพร่ได้ผ่านหน้าแดชบอร์ด

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | หัวข้อเรื่อง หรือประเด็นของโพสต์ |
| `content` | `string` | **Yes** | ข้อความเนื้อหาภาษาไทยสำหรับโพสต์ลง Facebook |

---

### 9. `get_recent_intelligence`
ดึงรายการข่าวและบทวิเคราะห์ตลาดล่าสุดที่เคยถูกบันทึกไว้ในฐานข้อมูล (`notebook_articles`)

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `limit` | `number` | No | จำนวนบทความที่ต้องการดึง (Default: 10, สูงสุด 50) |
| `source` | `string` | No | กรองตามแหล่งที่มา เช่น `'gemini_spark'` หรือ `'notebooklm'` |

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
- `shares_outstanding` (*Required*): จำนวนหุ้นทั้งหมดในหน่วย **ล้านหุ้น ($M)** (เช่น หุ้น 15B ให้ใส่ `15000`)
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

---

### 12. `list_dcf_symbols`
ดึงรายชื่อหุ้นทั้งหมดที่มีการประเมินและบันทึกโมเดล DCF ไว้ในระบบ พร้อมสรุปราคาประเมิน Base Case และวันที่ประเมินล่าสุด

---

### 13. `save_fundamental_brief` & `get_fundamental_brief`
บันทึกหรือดึงข้อมูลวิจัยพื้นฐานเชิงคุณภาพของบริษัท (`business_model`, `moat`, `competitors`, `guidance`, `key_risks`, `thesis_kpis`) พร้อมตัวเลือกแนบผลโต้วาที Bull vs. Bear 3 รอบ (`debate`) ในการเรียกครั้งเดียวแบบ Atomic ลงฐานข้อมูล D1 และสร้างไฟล์ OKF Markdown ลง R2

---

### 14. `save_bull_bear_debate` & `get_bull_bear_debate`
บันทึกหรือดึงข้อมูลการโต้วาทีเชิงวิพากษ์ 3 รอบ (Round 1 Opening Theses, Round 2 Cross-Examination Rebuttals, Round 3 Arbiter Synthesis) พร้อมคะแนนความเชื่อมั่น `conviction_score` (สเกล `-10` Strong Bear ถึง `+10` Strong Bull)

---

### 15. `save_theme_sector_context`
บันทึกบริบทอุตสาหกรรมหรือ Theme การลงทุน (`theme_name`, `industry_dynamics`, `supply_chain_bottlenecks`, `competitive_landscape`, `macro_trends`) และผูกความสัมพันธ์เข้ากับรายการหุ้น (`symbols`)

---

### 16. `get_portfolio_risk_audit`, `calculate_position_size` & `save_risk_advisory`
ชุดเครื่องมือบริหารความเสี่ยงพอร์ตตามหลักการของ Howard Marks:
- `get_portfolio_risk_audit`: คำนวณความเสี่ยงพอร์ตแบบครบวงจร (น้ำหนักรายตัวเทียบเพดาน 15%, น้ำหนักราย Theme เทียบเพดาน 30%, คู่หุ้นที่มี Correlation $\ge 0.70$, Portfolio Beta เทียบ S&P 500, Health Score 0-100 และวงเงินที่ซื้อเพิ่มได้ของแต่ละหุ้น)
- `calculate_position_size`: คำนวณขนาดไม้ลงทุนตามกฎ Fixed-Base (8% Target, 15% Stock Cap, 30% Theme Cap) และจำลองผลกระทบก่อนส่งคำสั่งซื้อ/ขายจริง
- `save_risk_advisory`: บันทึกบทวิเคราะห์และคำเตือนจาก Chief Risk Officer (`health_score`, `risk_level`, `executive_summary`, `key_warnings`, `rebalancing_actions`) ลง D1 เพื่อแสดงผลบนหน้าแดชบอร์ด

---

## 🔒 Internal & Admin Endpoints เพิ่มเติม

นอกเหนือจาก MCP Tools หลักแล้ว Worker นี้ยังมีฟังก์ชันการทำงานส่วนขยายดังนี้:

### 1. Database Agent Tools (`/database-chat`)
เมื่อเปิดใช้งาน `ENABLE_DATABASE_AGENT = "true"` ในตัวแปรสภาพแวดล้อม:
- Endpoint: `POST /database-chat` (ต้องมี JWT Authentication)
- เครื่องมือที่มี: `list_d1_tables`, `get_d1_table_schema`, `execute_d1_sql`, `list_r2_objects`, `get_r2_object`, `put_r2_object`, `delete_r2_object`

### 2. Oaktree Chat Agent (`/agents/oaktree-chat/:sessionId`)
- สตรีมข้อความตอบโต้กับ AI Assistant ที่ถูก Inject บริบทของ Portfolio และ Watchlist แบบเรียลไทม์
- ตรวจสอบสิทธิ์ผ่าน JWT และแยกประวัติการสนทนาตามผู้ใช้

---

## 🚨 รหัสข้อผิดพลาด (Error Codes & Troubleshooting)

| Code | HTTP Status | ความหมาย | แนวทางแก้ไข |
| :--- | :--- | :--- | :--- |
| `-32000` | `401 Unauthorized` | ขาด Token หรือ Token ไม่ถูกต้อง | ตรวจสอบว่าได้แนบ Header `Authorization: Bearer <MCP_SECRET>` หรือ parameter `?token=<SECRET>` ถูกต้องหรือไม่ |
| `-32603` | `500 Internal Error` | เกิดข้อผิดพลาดภายใน Worker | ตรวจสอบ Cloudflare Worker Logs (`npx wrangler tail`) หรือตรวจสอบการเชื่อมต่อฐานข้อมูล D1 |
| `-32601` | `400 Method not found` | ไม่พบชื่อ Tool ที่เรียก | ตรวจสอบว่าสะกดชื่อ Tool ถูกต้องตามรายการทั้ง 20 ตัวข้างต้น |
| `-32602` | `400 Invalid params` | พารามิเตอร์ไม่ตรงตาม Zod Schema | ตรวจสอบชนิดข้อมูล (Types) และฟิลด์ที่ Required ให้ครบถ้วน |

---

## 🧪 การทดสอบระบบ (Running Tests)

รันชุดการทดสอบ Unit Test ภายใน `mcp-worker`:
```bash
npm test
```
ครอบคลุมการตรวจสอบความถูกต้องของการลงทะเบียน Tools ทั้ง 20 รายการ, Input Validation, Authentication, และการสื่อสารผ่าน MCP Transport
