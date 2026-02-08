---
name: project-fix-tests
description: "Run the full suite, fix failures iteratively, and clear VS Code #problems Errors."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Canonical Defaults
- `workspaceName` = basename of `${workspaceFolder}` (also the **project name** and **GitHub repository name**)
- GitHub owner (user/organization): `LightningPhil`
- Author/maintainer name: `Philip Leichauer`
- Maintainer email: leave blank
- Default branch: `main`
- Canonical config file: `project-setup.json` (created by `/project-setup-json`)

## Context
- Goal: reach a clean green state quickly and safely.
- Focus on existing tests first.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `README.md`
3) Test/build/lint config (`package.json`, workflow files, etc.)
4) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:fix-tests]`.

2) Discover canonical commands from scripts and CI.
3) Run the full test command and group failures by root cause.
4) Fix in tight loops:
- one failure cluster at a time
- re-run targeted tests
- re-run full suite regularly

5) Clean VS Code `#problems` **Errors** during the same loop.
6) Run lint/typecheck if part of CI.
7) Stop when tests pass and `#problems` has no Errors.

## Constraints
- Default: do not add new tests unless a tiny regression test is clearly warranted.
- Do not weaken assertions just to pass.
- Prefer root-cause fixes over workaround toggles.

## Completion Output
Return in chat:
- commands used
- initial failure clusters
- fixes applied
- remaining risks or warnings
- recommended next command: `/project-fix-problems` or `/project-refresh-docs`