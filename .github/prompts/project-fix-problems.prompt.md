---
name: project-fix-problems
description: "Iteratively clear VS Code #problems (Errors first, then warnings if low risk)."
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
- Focus only on items currently shown in VS Code `#problems`.
- Keep fixes minimal and consistent with existing style.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) Relevant files referenced by `#problems`
3) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Inspect `#problems` and group by root cause.
2) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:fix-problems]`.
3) Fix all **Errors** first.
4) Re-check `#problems` after each logical fix batch.
5) Fix warnings only when quick and low risk.
6) If blocked by design ambiguity, document options and choose the safest default aligned with `ProjectPlan.md`.

## Constraints
- Do not do broad refactors just to reduce warning count.
- Do not hide errors with suppression unless justified.
- Keep behavior changes aligned with `ProjectPlan.md`.

## Completion Output
Return in chat:
- error categories fixed
- files changed
- any remaining warnings and why they were left