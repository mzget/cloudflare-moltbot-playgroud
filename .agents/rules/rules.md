# Workspace Rules for Oaktree Agent

- **Rule Name**: Workspace Rules for Oaktree Agent
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

---

## Guidelines for execution

### 1. Verification of Skills
- Read the instructions in all three skill files above before proposing any changes or modifications to the code.
- Align code designs with Cloudflare Wrangler specifications, the simplified architecture guidelines from Andrej Karpathy, and the Antigravity design principles.

### 2. Stack Constraints (Precedence Rule)
- **Backend**: Cloudflare Worker running in Node.js compatibility mode.
- **Frontend**: Astro framework UI using React with **MUI Joy UI** and **`sx` props** (no Tailwind).
- **Conflict Resolution**: The project stack constraints (Astro + React, MUI Joy UI, `sx` prop, and no Tailwind) **MUST** take precedence over the default stack suggested in the Antigravity UI & Motion Design Expert skill.
- Avoid introducing unnecessary libraries or frameworks.
