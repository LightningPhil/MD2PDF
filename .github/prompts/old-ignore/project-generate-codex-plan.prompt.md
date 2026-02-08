---
name: project-generate-codex-plan
description: "Read-only repo audit that writes Codex.md as an executable, ProjectPlan-driven implementation plan."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Context
- `ProjectPlan.md` is law.
- This command is read-only except for writing `Codex.md`.

## Hard Rule: Read-only
You must not modify any existing file.
You may only create or overwrite `Codex.md`.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (if present)
3) `README.md` and `todo.md` (if present)
4) Entire repo tree for evidence

If required inputs are missing, document them in `Codex.md` as explicit tasks.

## Workflow
1) Extract requirement IDs from `ProjectPlan.md` (`REQ-001`, `REQ-002`, ...).
2) Build an inventory of implementation, commands, tests, docs, and outputs.
3) Map each requirement to current status: Implemented, Partial, Missing, or Unclear.
4) Build a phased execution plan with dependency-aware checkbox tasks (`COD-001`, `COD-002`, ...).
5) For every task, include:
- files to touch
- verification commands
- acceptance criteria
- linked REQ IDs and plan sections
6) Include guardrails:
- no scope creep
- tests and `#problems` gates
- when to stop for clarifications

## Required Codex.md Sections
1) Codex Execution Plan title
2) How Codex should work in this repo
3) ProjectPlan requirement catalog
4) Quick start commands
5) Inventory
6) Requirement status map
7) Gap themes
8) Phased task plan
9) Guardrails and quality gates
10) Suggested slash commands

Use this command list when suggesting next steps:
- `/project-setup-json`
- `/project-init-metadata`
- `/project-audit`
- `/project-test-audit`
- `/project-run-tests-and-fix`
- `/project-docs-refresh`
- `/project-build-single-html` (only if required)

## Completion Output
After writing `Codex.md`, return in chat:
- 3-6 bullets summarizing the plan
- the single best next slash command