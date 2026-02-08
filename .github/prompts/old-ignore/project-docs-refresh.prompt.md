---
name: project-docs-refresh
description: "Refresh README.md and help.md so docs match ProjectPlan.md and actual behavior."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Context
- `ProjectPlan.md` is the source of truth for scope and intent.
- Docs must be accurate for someone who did not build the app.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `README.md` (if present)
3) `help.md` and `docs/` (if present)
4) Source code, configs, and scripts
5) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Build a doc task list in `todo.md` for multi-step work.
- Prefix tasks with `[DOCS]`.

2) Audit implementation reality.
- Main workflows
- user controls/options
- config/env settings
- failure modes and troubleshooting

3) Update `README.md` with:
- short overview
- quick start commands
- test/build commands
- project structure summary
- known limits and links to `help.md`

4) Create or update `help.md` as the user guide.
- plain language
- step-by-step workflows
- feature and control reference
- troubleshooting and FAQ

5) Verify docs against the current code.
- commands exist and run
- feature names match UI/API
- no stale instructions

6) Ensure VS Code `#problems` has no Errors caused by doc changes.

## Constraints
- Do not invent unsupported features.
- Prefer clarity over volume.
- Keep markdown structure easy to scan.

## Completion Output
Return in chat:
- files changed
- major sections added/updated
- best starting doc for a new teammate