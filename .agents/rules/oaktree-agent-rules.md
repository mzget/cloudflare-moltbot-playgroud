---
trigger: always_on
---

# Oaktree Agent Rules

- **Rule Name**: Oaktree Agent Rules
- **Description**: Core guidelines, stack constraints, and conditional skills activation rules for the Moltbot/Oaktree workspace.

These rules govern the core behavior of the Oaktree Agent in this repository.

---

## 🛠️ Stack Constraints (Strict Precedence Rule)

- **Backend**: Cloudflare Worker running in Node.js compatibility mode.
- **Frontend**: Astro framework UI using React with **MUI Joy UI** and **`sx` props** (Strictly **NO Tailwind CSS**).
- **Conflict Resolution**: The project stack constraints (Astro + React, MUI Joy UI, `sx` prop, and no Tailwind) **MUST** take precedence over any default stacks suggested in external skills.

---

## ⚡ Conditional Skills Activation (Load only when relevant)

Do NOT load domain-specific guidelines or all skills at the start of every turn. Only call `view_file` to load the instructions of a specific skill when the task matches the following conditions:

1. **Frontend UI Guidelines**:
   - *Condition*: Working on React components, Astro pages, MUI Joy UI components, tables, modals, buttons, or styling.
   - *Path*: [oaktree-frontend/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/oaktree-frontend/SKILL.md)
2. **Backend & Cloudflare Database Guidelines**:
   - *Condition*: Working on backend Workers, API routes, database schemas (D1, KV, R2), Worker AI models, or batch queries.
   - *Path*: [oaktree-backend/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/oaktree-backend/SKILL.md)
3. **Karpathy Guidelines**:
   - *Condition*: Load when writing, modifying, reviewing, or debugging code.
   - *Path*: [karpathy-guidelines/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/karpathy-guidelines/SKILL.md)
4. **Cloudflare Platform & Wrangler**:
   - *Condition*: Working on Worker backend, `wrangler.jsonc` configuration, or Cloudflare infrastructure.
   - *Path*: [cloudflare/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/cloudflare/SKILL.md)
5. **Hono Web Framework**:
   - *Condition*: Creating/modifying API endpoints, backend routing, or RPC-client services.
   - *Path*: [@hono/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/@hono/SKILL.md)
6. **Agents SDK**:
   - *Condition*: Working on stateful agent logic, agent-chat components, or durable workflows.
   - *Path*: [agents-sdk/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/agents-sdk/SKILL.md)
7. **DCF Valuation Model Guidelines**:
   - *Condition*: Working on stock valuation, DCF calculations, DCF parameters entry, or DCF UI components.
   - *Path*: [dcf-valuation-model/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/dcf-valuation-model/SKILL.md)
8. **Release Management Guidelines (tostaging / tomain)**:
   - *Condition*: Merging branches, preparing staging/production releases, or executing release commands.
   - *Path*: [release/SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/release/SKILL.md)

---

## ⚠️ PowerShell Encoding & File Modification Guidelines

When editing or writing code files containing non-ASCII text (e.g., Thai labels, placeholders, or comments) via PowerShell command runner:
- Strictly **avoid** using standard `Set-Content` or `Out-File` without explicitly setting encoding, as they default to ANSI/ASCII and will corrupt characters to `?`.
- Always use `[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)` to write files with proper UTF-8 encoding.

---

## 🧪 Unit Test Coverage Rule (Mandatory)

After writing or modifying any backend logic (Workers, API routes, utility functions, or database queries), you MUST:

1. **Write or update unit tests** covering the changed behavior before considering the task done.
2. **Run `npm test`** in the relevant package directory and confirm all tests pass.
3. **Cover at minimum**:
   - The happy path (expected input → expected output)
   - Null/empty/missing field cases (edge cases most likely to surface in production)
   - Any conditional branches introduced by the change

### Scope
- Applies to: backend (`/backend/src/`) changes that introduce or modify logic.
- Exempt: pure config changes (e.g., `wrangler.jsonc`), schema-only migrations with no logic, or changes the user explicitly says to skip tests for.

### Test file naming
- Co-locate tests: `src/<featureName>.test.ts` next to the source file.
- Match the pattern already used by `marketEvents.test.ts`, `portfolioUtils.test.ts`, `sectorLabel.test.ts`, etc.

### Frontend
- Frontend React component tests are **not required** unless the user explicitly asks.
- However, **pure utility/display logic** (e.g., fallback label resolution) should be tested in the backend test file or a shared utility test file when feasible.