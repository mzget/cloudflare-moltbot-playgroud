# Oaktree & Simplicity Federated Architecture Glossary

เอกสารรวบรวมคำศัพท์มาตรฐาน (Ubiquitous Language) สำหรับสถาปัตยกรรม Micro-Frontend ระหว่าง **Oaktree Host (`@oaktree/host`)** และ **Simplicity Finance (`simplicity_finance`)** (อ้างอิง [ADR-0019](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/docs/adr/0019-standalone-host-workspace-and-shell-extraction.md) และ [ADR-0021](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/docs/adr/0021-federated-microfrontend-boundary-and-host-contract.md))

---

## 1. Core Architectural Roles

| Term | Definition | Owner |
| :--- | :--- | :--- |
| **Host Shell (`@oaktree/host`)** | แอปพลิเคชันโครงสร้างหลักที่รับผิดชอบ Authentication, Global Navigation (`Header`, `Sidebar`, `Drawer`), Routing (`@tanstack/react-router`), Theme (`MUI Joy UI`) และการโหลด Remote Micro-Frontend | `oaktree-agent/host` |
| **Remote Micro-Frontend (`simplicity_finance`)** | แอปพลิเคชันจัดการการเงินส่วนบุคคลที่ถูก build และ expose ผ่าน `@originjs/vite-plugin-federation` (`./FinanceApp`) เพื่อให้ Host โหลดใช้งานแบบ Runtime | `simplicity` repo |
| **Embedded Mode (`isEmbedded: true`)** | โหมดการทำงานเมื่อ `simplicity_finance` ถูก mount อยู่ภายใต้ `RemoteFinanceContainer` ของ Host โดยที่ Host เป็นเจ้าของ URL, Browser History, และ Auth Session เพียงผู้เดียว | Host-Controlled |
| **Standalone Mode (`isEmbedded: false \| undefined`)** | โหมดการทำงานเมื่อ `simplicity_finance` ถูกรันหรือเปิดใช้งานเดี่ยวๆ โดยตรง ไม่ผ่าน Host ซึ่งตัวแอปจะจัดการ Router, `window.history`, และ Local Fallback ของตัวเองได้เต็มรูปแบบ | Remote-Controlled |

---

## 2. State, Routing & Communication Terms

| Term | Definition | Mechanism |
| :--- | :--- | :--- |
| **Controlled Route State** | สถานะการนำทาง (`activeTab` และ `selectedWalletId`) ที่มี **URL Search Parameters ของ Host (`?tab=...&wallet=...`)** เป็น Single Source of Truth เสมอเมื่ออยู่ใน Embedded Mode | `FederatedFinanceProps` |
| **Typed Props Contract (`FederatedFinanceProps`)** | สัญญาการส่งข้อมูลและคำสั่งระหว่าง Host กับ Remote ผ่าน React Props ที่มีการกำหนด Type ชัดเจน แทนการใช้ Global `window.dispatchEvent(CustomEvent)` | `RemoteFinanceContainer.tsx` |
| **Pending Action Queue (`pendingAction` / `onActionConsumed`)** | กลไกส่งคำสั่งด่วน (`add-tx`, `ai-scan`, `csv-import`, `add-wallet`) จากปุ่มใน Header หรือ Mobile Drawer ของ Host ไปยัง Remote ผ่าน Props เมื่อ Remote เปิด Modal สำเร็จจะเรียก `onActionConsumed()` เพื่อล้างคิว | `useFinanceBridgeStore` |
| **Commanded-Transition Guard** | ตัวแปร Ref (`lastCommandedTabRef`, `lastDispatchedTabRef`) ที่ป้องกันไม่ให้การเปลี่ยนค่า `tab` หรือ `wallet` เกิดการสะท้อนกลับไปมา (Bidirectional Echo Loop) ระหว่าง Host กับ Remote | `RoutesLayout.tsx` & `RemoteFinanceContainer.tsx` |
| **History Isolation Guard (`createIsolatedBrowserHistory`)** | เกราะป้องกันชั้นที่สองในฝั่ง Host ที่ห่อหุ้ม `createBrowserHistory()` ของ TanStack Router เพื่อกรองไม่ให้การเปลี่ยนแปลง `history.state` ภายในของ Modal (ที่ไม่ได้เปลี่ยน URL `href`) ไปสั่ง Re-render ทั้งแอป | `HostAppShell.tsx` |

---

## 3. UI Overlay & Environment Governance Terms

| Term | Definition | Standard / Value |
| :--- | :--- | :--- |
| **Overlay Mutual Exclusion** | กฎที่กำหนดให้ต้องปิด Drawer/Modal ของฝั่งหนึ่งและคืนค่า Focus Trap / Scroll Lock (`body.style.overflow`) ให้เสร็จสิ้นก่อน (ผ่านการหน่วง 1 เฟรม `16ms`) จึงจะสั่งเปิด Modal ของอีกฝั่งได้ | `Sidebar.tsx` (`handleAction`) |
| **Z-Index Tiering** | ลำดับชั้นความสูงของ UI ข้ามโปรเจกต์เพื่อไม่ให้เกิดการบังกันระหว่าง MUI Joy UI กับ Tailwind/Radix UI:<br>• `--oaktree-z-header`: `1100`<br>• `--oaktree-z-drawer`: `1300`<br>• `--oaktree-z-host-modal`: `1350`<br>• `--oaktree-z-remote-modal`: `1400` | CSS Custom Properties (`:root`) |
| **Host-Governed Local Fallback (`allowLocalFallback`)** | สิทธิ์ในการสลับไปใช้ข้อมูลจาก `localStorage` / `IndexedDB` เมื่อเรียก API ไม่สำเร็จ โดยอนุญาตเฉพาะตอนรัน Local Dev (`allowLocalFallback: true`) และห้ามใช้ใน Production (`allowLocalFallback: false`) | `RemoteFinanceContainer.tsx` |
