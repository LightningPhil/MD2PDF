---
name: project-run-tests-and-fix
description: "Run the full suite, fix failures iteratively, and clear VS Code #problems Errors."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

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
1) Build or update `todo.md` for multi-step work.
- Prefix tasks with `[TEST-FIX]`.

2) Discover canonical commands from scripts and CI.
3) Run the full test command and group failures by root cause.
4) Fix in tight loops:
- one failure cluster at a time
- re-run targeted tests
- re-run full suite regularly

5) Clean VS Code `#problems` Errors during the same loop.
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