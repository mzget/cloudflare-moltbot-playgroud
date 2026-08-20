---
name: release
description: Release management guidelines for Oaktree Agent. Automates merging and pushing code to staging (develop) and production (main) with strict safety guardrails and mandatory type checking (ci:typecheck) before push.
---

# Release Management Skill (`release`)

This skill defines the standardized workflow for safely promoting code between branches and releasing to staging (`develop`) and production (`main`).

---

## 🛡️ Guardrails & Safety Rules (Mandatory)

1. **Clean Working State**: Never start any release step if `git status` reports uncommitted or unstaged changes.
2. **No Force Push**: Strictly **forbidden** to use `git push --force` or `--force-with-lease` on public branches (`develop`, `main`).
3. **No Destructive Operations**: Never delete, hard-reset (`git reset --hard`), or rebase public branches.
4. **Immediate Stop on Conflicts**: If merge conflicts occur at any point, **stop immediately**. Do NOT attempt automatic resolution. Notify the user to resolve conflicts manually.
5. **Mandatory Type Check Gate (`ci:typecheck`)**: Before executing any `git push`, all TypeScript checks across the workspace (`backend`, `frontend`, `mcp-worker`) must pass without errors.
6. **Explicit User Confirmation**: Always prompt and require explicit confirmation from the user before running `git push` to remote.

---

## 🔍 Pre-Push Gate: `ci:typecheck`

Before pushing to remote in either `tostaging` or `tomain`, run type checks across all modules:

### 1. Root Command
If running from workspace root:
```bash
npm run ci:typecheck
```

### 2. Individual Module Verification (Fallback)
If running per module:
```bash
# Backend Type Check
cd backend && npm run cf-typegen && npx tsc --noEmit

# Frontend Type Check
cd frontend && npm run type-check

# MCP Worker Type Check
cd mcp-worker && npx tsc --noEmit
```

> [!CAUTION]
> If any type check fails with errors, **DO NOT PUSH CODE**. Output the error trace, halt the release process, and fix the type errors first.

---

## 🚀 Command 1: `tostaging`

**Objective**: Merge the current active working branch into `develop` and push to remote.

### Step-by-Step Procedure

1. **Inspect Working Tree & Active Branch**:
   - Run `git status` to verify the working directory is clean.
   - Run `git branch --show-current` to identify the current working branch (`<working-branch>`).
   - If current branch is `develop` or `main`, stop and alert the user (must branch off a feature/fix branch).

2. **Fetch & Update `develop`**:
   ```bash
   git fetch origin
   git checkout develop
   git pull origin develop
   ```

3. **Merge Working Branch into `develop`**:
   ```bash
   git merge --no-ff <working-branch>
   ```
   - If conflict occurs: **STOP immediately** and ask the user to resolve.

4. **Execute `ci:typecheck` Gate**:
   - Run `npm run ci:typecheck` (or per-module type checks).
   - If errors exist, abort push and report errors.

5. **Prompt for Confirmation & Push**:
   - Request explicit user approval: *"Typecheck passed cleanly. Confirm push to origin/develop? (y/n)"*
   - Upon confirmation, execute:
     ```bash
     git push origin develop
     ```

6. **Switch Back to Working Branch**:
   ```bash
   git checkout <working-branch>
   git status
   ```

---

## 🌟 Command 2: `tomain`

**Objective**: Merge `develop` into `main` (production release) and push to remote.

### Step-by-Step Procedure

1. **Inspect Working Tree**:
   - Run `git status` to verify the working directory is clean.
   - Record current branch to return to it afterward (`<initial-branch>`).

2. **Fetch & Update `develop` and `main`**:
   ```bash
   git fetch origin
   git checkout develop
   git pull origin develop
   git checkout main
   git pull origin main
   ```

3. **Merge `develop` into `main`**:
   ```bash
   git merge --no-ff develop
   ```
   - If conflict occurs: **STOP immediately** and ask the user to resolve.

4. **Execute `ci:typecheck` Gate**:
   - Run `npm run ci:typecheck` (or per-module type checks).
   - If errors exist, abort push and report errors.

5. **Prompt for Confirmation & Push**:
   - Request explicit user approval: *"Typecheck passed cleanly. Confirm push to origin/main? (y/n)"*
   - Upon confirmation, execute:
     ```bash
     git push origin main
     ```

6. **Switch Back to Initial Branch**:
   ```bash
   git checkout <initial-branch>
   git status
   ```

---

## 📋 Verification Checklist

After running either command, verify:
- `git status` shows clean working tree on the target/current branch.
- `git log -n 5 --graph --oneline` shows expected merge commit.
- CI pipeline triggers on GitHub Actions for the pushed branch.
