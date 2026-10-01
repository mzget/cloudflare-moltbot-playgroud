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
5. **Mandatory Quality Gates**: Before executing any `git push`, all 3 verification gates must pass: (1) TypeScript type checks (`npm run ci:typecheck`), (2) Unit tests (`npm test` in backend and frontend), and (3) relevant E2E tests (if touched features affect UI or workflows with existing specs).
6. **Automated Push on Quality Gates**: Do NOT wait for a separate push command or manual confirmation from the user. When all quality gates pass cleanly, proceed to `git push` automatically. If ANY gate fails, **STOP immediately**, do NOT push, and report the errors.

---

## 🔍 Pre-Push Quality Gates

Before pushing to remote in either `tostaging` or `tomain`, run all quality verification gates:

### 1. Workspace-wide Type Check Gate (`ci:typecheck`)
```bash
npm run ci:typecheck
```
*Checks TypeScript across `backend`, `frontend`, and `mcp-worker`.*

### 2. Unit Test Gates (`npm test`)
```bash
# Backend Unit Tests
cd backend && npm test

# Frontend Unit Tests
cd frontend && npm test
```

### 3. E2E Test Gate (When Applicable)
If modified files touch UI pages, components, or user workflows with existing Playwright specs:
```bash
cd frontend && npx playwright test
```

> [!CAUTION]
> If any test or type check fails with errors, **DO NOT PUSH CODE**. Output the error trace, halt the release process immediately, and report the failure to the user.

---

## 🚀 Command 1: `tostaging`

**Objective**: Merge the current active working branch into `develop` and push to remote.

> [!NOTE]
> The workspace runs on a single production Cloudflare environment. Pushing to `develop` runs Continuous Integration (testing, typecheck, dry-run build) only; Continuous Deployment (CD) occurs exclusively upon pushing to `main`.

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

4. **Execute Quality Gates**:
   - Run `npm run ci:typecheck` (workspace-wide type checking).
   - Run `npm test` in `backend` and `frontend`.
   - Run relevant E2E tests if modified features affect UI/workflows.
   - If ANY test fails, **STOP immediately**, do NOT push, and report the failure trace.

5. **Automated Push**:
   - When all quality gates pass cleanly, push automatically without waiting:
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

4. **Execute Quality Gates**:
   - Run `npm run ci:typecheck` (workspace-wide type checking).
   - Run `npm test` in `backend` and `frontend`.
   - Run relevant E2E tests if modified features affect UI/workflows.
   - If ANY test fails, **STOP immediately**, do NOT push, and report the failure trace.

5. **Automated Push**:
   - When all quality gates pass cleanly, push automatically without waiting:
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
