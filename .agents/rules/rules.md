# Workspace Rules for Antigravity Agent

These rules govern the behavior of the Antigravity agent in this repository. The agent **MUST** read and adhere to these guidelines for every task.

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

---

## Guidelines for execution

### 1. Verification of Skills
- Read the instructions in both skill files above before proposing any changes or modifications to the code.
- Align code designs with the Cloudflare wrangler specifications and the simplified architecture guidelines from Andrej Karpathy.

### 2. Stack Constraints
- **Backend**: Cloudflare Worker running in Node.js compatibility mode.
- **Frontend**: Astro framework UI using React.
- Avoid introducing unnecessary libraries or frameworks.
