---
name: project-audit-implementation
description: "Bootstrap or audit implementation against ProjectPlan.md, execute todo tasks, and leave the repo runnable."
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
- `ProjectPlan.md` is the authoritative specification.
- This command supports two modes:
  - **Bootstrap** (repo is mostly empty)
  - **Audit** (implementation exists and needs alignment)

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (preferred; required if repo metadata decisions matter)
3) `todo.md` (if present)
4) Existing source, configs, tests, and docs

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Create or update `todo.md` before significant work.
- Prefix tasks with `[CMD:audit-implementation]`.
- Add sub-tags inside the task text if helpful (e.g., `BOOTSTRAP`, `AUDIT`, `REQ-xxx`).

2) Detect mode:
- Bootstrap if no meaningful source, no build config, and no README.
- Otherwise Audit.
- Record selected mode in `todo.md`.

3) Extract requirements from `ProjectPlan.md` into a checklist:
- features
- constraints/non-goals
- acceptance outcomes

4) Execute by mode:
- Bootstrap: scaffold the smallest viable project that matches the plan.
- Audit: map requirements to existing code and close gaps with minimal edits.

5) Verify quality gates:
- Run build/dev/test commands when available.
- Ensure VS Code `#problems` has **no Errors**.
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
- recommended next command: `/project-git-initial-commit` (if no commits yet) or `/project-fix-tests`