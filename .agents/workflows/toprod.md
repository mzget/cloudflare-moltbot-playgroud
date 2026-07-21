---
description: Merge current working branch into develop and main, then safely push.
---

# Release to Production (toprod)

Safely merge your working branch into `develop`, then merge `develop` into `main`, and push both remote branches after confirmation.

## Guardrails
- **No Force Push**: Never use `git push --force` or overwrite remote ref history.
- **No Branch Deletions/Resets**: Do not delete, hard-reset, or rebase public branches.
- **Stop on Conflicts**: If merge conflicts occur at any point, stop immediately and ask the user to resolve them manually.
- **Require Confirmation**: Never push to the remote repository without explicit user approval.
- **Clean State Required**: Do not proceed if the working tree has uncommitted changes or if the active branch is `develop` or `main`.

## Steps

### 1. Understand Context & Options
Ask clarifying questions:
- What is the remote repository name? (Default: `origin`)
- Should Antigravity return to your original working branch after the release finishes?

### 2. Analyze Git State
Inspect current branch and working directory:
- Run `git status` to ensure working tree is clean. If dirty, warn user and stop.
- Run `git branch --show-current` to identify working branch.
- If current branch is `develop` or `main`, stop and inform the user.

### 3. Fetch & Update Develop
Perform merge into `develop`:
1. Fetch latest changes: `git fetch <remote>`
2. Switch to develop: `git checkout develop`
3. Pull remote updates: `git pull <remote> develop`
4. Merge working branch: `git merge --no-ff <working-branch>`
5. If merge conflicts occur, stop execution immediately and notify the user.

### 4. Update & Merge to Main
Perform merge into `main`:
1. Switch to main: `git checkout main`
2. Pull remote updates: `git pull <remote> main`
3. Merge develop: `git merge --no-ff develop`
4. If merge conflicts occur, stop execution immediately and notify the user.

### 5. Confirm & Push Remote
Confirm and push:
1. Prompt the user for explicit confirmation to push `develop` and `main` to `<remote>`.
2. Upon confirmation, execute: `git push <remote> develop main`
3. If requested in Step 1, switch back to the original working branch: `git checkout <working-branch>`

### 6. Verify
- Verify branch statuses with `git status`.
- Check git commit history with `git log -n 5 --graph --oneline` on `main` and `develop`.

## Principles
- **Safety First**: Verify preconditions before making modifications.
- **Explicit Approvals**: Always obtain approval before pushing state changes to remote.
- **Clean Failures**: Pause immediately on conflict rather than leaving repositories in broken merge states.
