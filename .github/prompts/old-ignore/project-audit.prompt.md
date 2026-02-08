---
name: project-audit
description: "Bootstrap or audit implementation against ProjectPlan.md, execute todo tasks, and leave the repo runnable."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Context
- `ProjectPlan.md` is the authoritative specification.
- This command supports two modes:
  - Bootstrap mode (repo is mostly empty)
  - Audit mode (implementation exists and needs alignment)

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (if present)
3) `todo.md` (if present)
4) Existing source, configs, tests, and docs

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Create or update `todo.md` before significant work.
- Prefix bootstrap tasks with `[BOOTSTRAP]`.
- Prefix audit tasks with `[AUDIT]`.

2) Detect mode.
- Bootstrap mode if no meaningful source, no build config, and no README.
- Otherwise audit mode.
- Record selected mode in `todo.md`.

3) Extract requirements from `ProjectPlan.md` into a checklist.
- Features
- constraints/non-goals
- acceptance outcomes

4) Execute by mode.
- Bootstrap mode: scaffold the smallest viable project that matches the plan.
- Audit mode: map requirements to existing code and close gaps with minimal edits.

5) Verify quality gates.
- Run build/dev/test commands when available.
- Ensure VS Code `#problems` has no Errors.
- Ensure README quick-start exists and matches reality.

6) Keep docs and todo synchronized with what changed.

## Constraints
- No scope creep beyond `ProjectPlan.md`.
- Prefer existing stack and minimal dependencies.
- Stop and raise ambiguities instead of guessing requirements.

## Completion Output
Return in chat:
- mode used
- files created/changed
- commands used to verify
- remaining gaps or decisions