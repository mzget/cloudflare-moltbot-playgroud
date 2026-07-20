---
trigger: always_on
---

# Oaktree Agent Rules

- **Rule Name**: Oaktree Agent Rules
- **Description**: Defines guidelines, conditional skills activation, and stack constraints for the Moltbot workspace.

These rules govern the behavior of the Oaktree Agent in this repository.

---

## 🛠️ Stack Constraints (Strict Precedence Rule)

- **Backend**: Cloudflare Worker running in Node.js compatibility mode.
- **Frontend**: Astro framework UI using React with **MUI Joy UI** and **`sx` props** (Strictly **NO Tailwind CSS**).
- **Conflict Resolution**: The project stack constraints (Astro + React, MUI Joy UI, `sx` prop, and no Tailwind) **MUST** take precedence over any default stacks suggested in external skills.

---

## ⚡ Conditional Skills Activation (Load only when relevant)

Do NOT load all skills at the start of every turn. Only call `view_file` to load the instructions of a specific skill when the task matches the following conditions:

1. **Karpathy Guidelines**:
   - *Condition*: Load when writing, modifying, reviewing, or debugging code.
   - *Path*: [karpathy-guidelines/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/karpathy-guidelines/SKILL.md)
2. **Cloudflare Platform & Wrangler**:
   - *Condition*: Working on Worker backend, `wrangler.jsonc` configuration, or database schemas (D1, KV, R2).
   - *Path*: [cloudflare/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/cloudflare/SKILL.md)
3. **Hono Web Framework**:
   - *Condition*: Creating/modifying API endpoints, backend routing, or RPC-client services.
   - *Path*: [@hono/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/@hono/SKILL.md)
4. **Agents SDK**:
   - *Condition*: Working on stateful agent logic, agent-chat components, or durable workflows.
   - *Path*: [agents-sdk/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/agents-sdk/SKILL.md)
5. **2D Games**:
   - *Condition*: Working with canvas games, sprites, physics, or game loops.
   - *Path*: [2d-games/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/2d-games/SKILL.md)

---

## 🎨 Antigravity UI Style (Adapted for MUI Joy UI)

Apply these design principles using MUI Joy UI `sx` props (do not load the `@antigravity-design-expert` skill to avoid Tailwind/GSAP stack conflicts):
- **Glassmorphism**: Use translucent backgrounds (`rgba`), blur effects (`backdropFilter: 'blur(12px)'`), and thin subtle borders.
- **Weightlessness**: Add soft, layered, and diffused shadows.
- **Motion**: Ensure all hover/focus/active state changes have smooth transitions (`transition: 'all 0.3s ease-out'`).
- **React Entrypoint**: `src/components/App.tsx` **MUST** remain directly under `src/components/` to integrate with Astro.
- **Component Folder Structure**:
  - `src/components/layout/` – Shell components (`Header.tsx`, `Sidebar.tsx`).
  - `src/components/common/` – Reusable contexts/helpers (`AuthContext.tsx`, `ThemeToggle.tsx`).
  - `src/components/features/` – Domain-specific views in subfolders (e.g., `agent/`, `portfolio/`).
- **Relative Paths**: Always use relative paths (e.g., `../../common/`) rather than flat imports when crossing folder boundaries.

---

## ⚠️ PowerShell Encoding & File Modification Guidelines

When editing or writing code files containing non-ASCII text (e.g., Thai labels, placeholders, or comments) via PowerShell command runner:
- Strictly **avoid** using standard `Set-Content` or `Out-File` without explicitly setting encoding, as they default to ANSI/ASCII and will corrupt characters to `?`.
- Always use `[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)` to write files with proper UTF-8 encoding.

---

## ⚡ Database Date/Time Formatting Guidelines

For any newly created tables, standardize datetime fields to use ISO-8601 string format (`DATETIME DEFAULT CURRENT_TIMESTAMP` or `TEXT`) instead of Unix Epoch integers to maintain query consistency across new database architectures.
---

## 🚫 Ad-Blocker Resilient API Naming Guidelines

When designing and naming backend API paths, avoid naming routes using common ad-blocker keywords such as `notification`, `notifications`, `alert`, `alerts`, `track`, `tracking`, or `analytics` (e.g. `/api/notifications` or `/api/in-app-notifications`). 
- **Reasoning**: Popular ad-blockers (e.g., uBlock Origin) and privacy filters routinely intercept and block these network requests in production environments (causing errors like `net::ERR_CONNECTION_CLOSED`).
- **Solution**: Use alternative, less common terms for paths, such as `/api/triggered-alerts` or general transaction/resource names.

---

## ⚡ Cloudflare D1 Database Batching & Query Guidelines

To prevent latency bottlenecks when writing database operations:
- **No Database Queries in Loops**: Avoid executing inline queries (`await env.DB.prepare(...).first()`, `.run()`, etc.) inside loops.
- **Pre-fetching SELECT queries**: If you need to check if records exist for multiple items, pre-fetch the list of existing records before entering the loop (e.g., matching on date or IDs) and use an in-memory `Set` or `Map` for checking.
- **Batching Writes/Updates**: For multiple database inserts/updates, accumulate `D1PreparedStatement` instances in an array (e.g., `batchStatements: any[]`) and execute them in a single batch transaction using `await env.DB.batch(batchStatements)` after the loop completes.

---

## 🚫 No Native Browser Dialogs — Use MUI Joy UI Modals

Never use `window.confirm()`, `window.alert()`, `window.prompt()`, or the bare `confirm()` / `alert()` / `prompt()` globals for user-facing interactions in the frontend.
- **Reasoning**: Native browser dialogs are visually inconsistent with the project's glassmorphism design system and cannot be styled or animated.
- **Solution**: Always implement confirmation dialogs using MUI Joy UI components:
  - `<Modal>` + `<ModalDialog role="alertdialog">` for destructive actions (delete, remove).
  - `<DialogTitle>`, `<DialogContent>`, and `<Stack>` for layout inside the modal.
  - Use `color="danger"` buttons with a relevant Lucide icon (`<Trash2>`) for destructive confirms.
  - Control visibility with a dedicated `useState` boolean (e.g., `isDeleteConfirmOpen`).