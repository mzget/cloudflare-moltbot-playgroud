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