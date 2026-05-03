---
description: Systematic workflow to debug frontend applications
---

# Debug Frontend

This workflow provides a structured approach to running, diagnosing, and fixing issues in frontend applications, ensuring a stable and functional user interface.

## Guardrails
- Do not assume a specific frontend framework (e.g., React, Vue, Astro).
- Do not assume specific ports or backend technologies.
- Always verify the underlying environment (backend, database, network) before making changes to UI code.
- Avoid making sweeping architectural changes when a localized fix is sufficient.

## Steps

### 1. Understand Context
Ask clarifying questions:
- What is the specific error, crash, or buggy behavior?
- What are the steps to reproduce the issue?
- Are there any known backend or API dependencies that might be failing or missing data?

### 2. Analyze Project
Detect existing stack:
- Identify the frontend framework and routing mechanism (e.g., React, Next.js, Vue, Astro).
- Identify the build tool and development server (e.g., Vite, Webpack).
- Determine default ports and API endpoints by checking `.env` files, `package.json` scripts, or config files.
If unclear, ask the user.

### 3. Environment Verification
Before debugging code, confirm the environment is healthy:
- Ensure the frontend development server is running and accessible.
- Ensure the corresponding backend API or worker is running and responsive.
- Verify that necessary environment variables (like API base URLs) are correctly configured for local development.

### 4. Browser-Based Testing
Use the browser subagent (if available) or ask the user to:
- Navigate to the local frontend URL.
- Capture a screenshot and look for broken layouts, missing data, or a "White Screen of Death".
- Inspect the browser console and network tabs for:
    - **Network Errors**: Missing assets (404s) or server crashes (500s).
    - **CORS Errors**: Cross-Origin Resource Sharing blocks indicating backend configuration issues.
    - **JavaScript Errors**: `ReferenceError`, `TypeError`, or undefined property crashes.
    - **Framework Errors**: React hydration mismatches, invalid hook calls, etc.

### 5. Iterative Debugging
Based on the logs, address the root cause systematically:
- **CORS Errors**: Update the backend API's CORS headers to explicitly allow the frontend's local origin.
- **API Data Missing / Network Failures**: Check backend logs, verify database state, and test the API endpoint independently (e.g., via cURL). Ensure mock data or database seeding is applied if needed.
- **UI / Rendering Bugs**: Locate the specific component in the source tree. Analyze its state, props, and lifecycle. Implement a fix that aligns with the project's existing design patterns and TypeScript interfaces.

### 6. Final Validation
- Re-run the reproduction steps to confirm the initial bug is resolved.
- Verify that the fix did not introduce regressions in related UI components.
- Ensure the core user flows interact smoothly with the backend.

## Principles
- **Isolate the Fault**: Determine if the bug is in the UI layer, network layer, or backend layer first.
- **Console is Source of Truth**: Always base fixes on actual error logs rather than guessing.
- **Stack-Agnostic**: Apply universal debugging patterns regardless of the specific JavaScript framework.

## Reference
- Standard Browser DevTools Documentation
- MDN Web Docs (for JavaScript and CORS concepts)
