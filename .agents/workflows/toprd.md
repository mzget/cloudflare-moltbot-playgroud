---
description: Merge working branch into develop, then into main, and push both
---

# Release to Production (Git Flow)

This workflow helps you merge your current working branch into the `develop` branch, then merge `develop` into `main` with safety checks, and push both branches to the remote repository.

## Guardrails
- **DO NOT** perform destructive actions (like hard resetting or force pushing) without explicit user approval.
- **DO NOT** continue automatically if a merge conflict occurs. Stop and ask the user to resolve the conflict.
- **DO NOT** push to the remote repository without explicit user confirmation.
- **DO NOT** run this flow if the current branch is already `develop` or `main`.

## Steps

### 1. Understand Context
Ask clarifying questions to align on the release:
- Confirm the name of the current working branch you wish to merge.
- Ask if there are any specific remote names (defaults to `origin`) or flags to use.
- Ask if any pre-merge tests or checks should be run before starting.

### 2. Analyze Git State
Verify the repository state using Git commands:
- Identify the current branch and verify it is not `develop` or `main`.
- Check for uncommitted changes using `git status --porcelain`.
- Warn the user if there are uncommitted changes and suggest stashing or committing them before proceeding.
- Ensure the local repository has the latest references from remote (`git fetch`).

### 3. Merge Flow Execution
Execute the sequential merges:
1. **Merge to develop**:
   - Switch to `develop` (`git checkout develop`).
   - Pull the latest changes (`git pull`).
   - Merge the working branch into `develop` (`git merge <working-branch>`).
   - If conflicts occur, pause and request manual resolution.
2. **Merge to main**:
   - Switch to `main` (`git checkout main`).
   - Pull the latest changes (`git pull`).
   - Merge `develop` into `main` (`git merge develop`).
   - If conflicts occur, pause and request manual resolution.

### 4. Verify & Push
Ensure everything is ready and push:
1. Report the status of the local merges clearly to the user.
2. Ask for explicit confirmation before pushing.
3. Upon approval, push both branches:
   - `git push origin develop`
   - `git push origin main`
4. Return to the original working branch (`git checkout <working-branch>`).

## Principles
- **Safety First**: Verify state at every transition.
- **Clean History**: Ensure fast-forward merges where possible, or follow the repository's merge guidelines.
- **No Assumptions**: Always check branch existence and local status first.

## Reference
- [Git Branching - Git Flows](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
