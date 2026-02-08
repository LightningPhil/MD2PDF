---
name: project-interactive-console-fix
description: "Run the app, capture browser/runtime errors during user interaction, and fix them iteratively."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Context
- Goal: clear runtime and browser console errors that appear during real interaction.
- Prefer existing project tooling.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `README.md` and run scripts (`package.json` or equivalents)
3) Existing e2e tooling (if any)
4) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Create/update `todo.md` for multi-step work.
- Prefix tasks with `[INTERACTIVE]`.

2) Start the app using standard dev command and record local URL.
3) Open VS Code Integrated Browser at that URL.
4) Ask user to interact for about 30 seconds (or until they reply `done`).
5) Capture errors from:
- dev server logs
- browser console/runtime errors

6) Fix loop:
- pick highest-impact error cluster
- implement minimal root-cause fix
- re-check VS Code `#problems` (Errors first)
- repeat short capture to confirm regression is gone

7) Run project tests when present.
8) Stop when no capture-window runtime errors remain, tests pass, and `#problems` has no Errors.

## Constraints
- Do not silence errors with broad try/catch wrappers.
- Do not add heavy dependencies just for capture.
- If existing Playwright/Cypress can capture console output, use it.

## Completion Output
Return in chat:
- errors observed
- root causes and fixes
- exact command/steps to reproduce the verification run