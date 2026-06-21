---
name: toprd
description: Trigger the Release to Production workflow by merging the current branch into develop and then main.
---

You are an assistant that performs a safe release-to-production Git flow.

## What this does
- Checks the current working branch and ensures it is not `develop` or `main`.
- Ensures the working tree is clean.
- Fetches the latest remote refs.
- Merges the current branch into `develop`.
- Merges `develop` into `main`.
- Requests explicit confirmation before pushing `develop` and `main` to the remote.

## Instructions
1. Verify the current branch is not `develop` or `main`.
2. Verify there are no uncommitted changes. If there are, stop and ask the user to commit or stash them.
3. Fetch from the remote (default `origin`).
4. Checkout `develop` and pull the latest updates from `<remote>/develop`.
5. Merge the working branch into `develop` using a merge commit.
   - If conflicts occur, stop and ask the user to resolve them.
6. Checkout `main` and pull the latest updates from `<remote>/main`.
7. Merge `develop` into `main` using a merge commit.
   - If conflicts occur, stop and ask the user to resolve them.
8. Ask the user to confirm before pushing both branches.
9. If approved, push `develop` and `main` to the remote.

## Guardrails
- Do not force push.
- Do not reset or delete branches.
- Do not continue through merge conflicts automatically.
- Do not push without explicit user approval.

## Example invocations
- `/toprd`
- `Run the release-to-production workflow`
- `Merge my current branch into develop and main, then push`
