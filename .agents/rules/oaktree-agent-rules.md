---
trigger: always_on
---

# Oaktree Agent Rules

- **Rule Name**: Oaktree Agent Rules
- **Description**: Defines guidelines, mandatory skills activation, and stack constraints for the Moltbot workspace.

These rules govern the behavior of the Oaktree Agent in this repository. The agent **MUST** read and adhere to these guidelines for every task.

## Mandatory Skills Activation

For all tasks, code changes, and analysis in this repository, you **MUST** load and follow the instructions in the following specific skills at the start of your turn:

1. **Cloudflare Platform Skill**:
   - **File Path**: [SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/cloudflare/SKILL.md)
   - **Description**: Guidance for building on the Cloudflare platform (Workers, D1, Pages, Durable Objects, Workers AI, Wrangler).
   - **Key Requirement**: Bias heavily toward retrieval from active documentation (using search tools) over pre-trained knowledge.

2. **Karpathy Guidelines**:
   - **File Path**: [SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/karpathy-guidelines/SKILL.md)
   - **Description**: Behavioral guidelines to reduce common AI coding mistakes.
   - **Key Requirement**: Adhere to Simplicity First (minimum code), Surgical Changes (only touch what is necessary), and Goal-Driven Execution.

3. **Antigravity UI & Motion Design Expert**:
   - **File Path**: [SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/@antigravity-design-expert/SKILL.md)
   - **Description**: Core UI/UX engineering skill for building highly interactive, spatial, weightless, and glassmorphism-based web interfaces.
   - **Key Requirement**: Apply weightlessness (layered soft drop-shadows), spatial depth, glassmorphism (translucency, background blur), and smooth motion design. Adapt these principles to the project's stack constraints (do not use Tailwind or Next.js).

4. **Hono Web Framework**:
   - **File Path**: [SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/@hono/SKILL.md)
   - **Description**: Build ultra-fast web APIs and full-stack apps with Hono — runs on Cloudflare Workers, Deno, Bun, Node.js, and any WinterCG-compatible runtime.
   - **Key Requirement**: Use Hono's routing, middleware, Zod validation middleware (`zValidator`), and RPC client (`hc`) for building clean, type-safe API endpoints on Cloudflare Workers.

5. **2D Games Skill** (Activated when working with canvas/game-related code):
   - **File Path**: [SKILL.md](file:///c:/Users/natta/Documents/oaktree-agent/.agents/skills/2d-games/SKILL.md)
   - **Description**: 2D game development principles including sprites, tilemaps, physics, and camera controls.
   - **Key Requirement**: Apply structured game loops, coordinate systems, collision detection, and layout scaling rules for canvas games.

---

## Guidelines for execution

### 1. Verification of Skills
- Read the instructions in all relevant skill files above (including the 2D Games skill if the task involves the canvas game) before proposing any changes or modifications to the code.
- Align code designs with Cloudflare Wrangler specifications, the simplified architecture guidelines from Andrej Karpathy, the Antigravity design principles, and Hono framework best practices, and 2D canvas game principles when applicable.

### 2. Stack Constraints (Precedence Rule)
- **Backend**: Cloudflare Worker running in Node.js compatibility mode.
- **Frontend**: Astro framework UI using React with **MUI Joy UI** and **`sx` props** (no Tailwind).
- **Conflict Resolution**: The project stack constraints (Astro + React, MUI Joy UI, `sx` prop, and no Tailwind) **MUST** take precedence over the default stack suggested in the Antigravity UI & Motion Design Expert skill.
- Avoid introducing unnecessary libraries or frameworks.

### 3. Component Folder Structure & Best Practices
- **React Entrypoint**: `src/components/App.tsx` **MUST** remain directly under `src/components/` so it integrates smoothly into Astro pages (e.g., [index.astro](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/pages/index.astro)).
- **Subdirectory Classification**:
  - `src/components/layout/` – Shell components for the dashboard frame (`Header.tsx`, `Sidebar.tsx`, `RoutesLayout.tsx`).
  - `src/components/common/` – Reusable contexts, helper components, and SVGs (`AuthContext.tsx`, `OaktreeIcon.tsx`, `ThemeToggle.tsx`).
  - `src/components/features/` – Domain-specific views organized by subfolders (`auth/`, `portfolio/`, `watchlist/`, `market/`, `agent/`, `sources/`).
- **Relative Path Integrity**: Always use correct relative path imports when traversing module boundaries (e.g., importing type definitions from `../../../types/` or shared components from `../../common/`). Do not write flat component lists directly inside `src/components/`.