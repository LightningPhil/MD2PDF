---
name: project-audit-tests
description: "Audit requirement coverage, improve the test suite, and verify quality gates against ProjectPlan.md."
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
- `ProjectPlan.md` defines what must be validated.
- This command is broader than just making current tests pass.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `README.md`
3) Test config and CI workflow files
4) Existing tests and test utilities
5) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:audit-tests]`.

2) Build a requirement-to-test matrix in `todo.md`:
- `REQ-xxx -> test file / test case`

3) Audit coverage support:
- Run existing coverage command when available.
- Identify important uncovered behavior tied to `ProjectPlan.md`.

4) Add or repair tests and minimal production fixes in Red/Green loops.
5) Validate tests are meaningful (observable behavior, not superficial assertions).
6) Ensure VS Code `#problems` has **no Errors**.
7) Re-run full test suite and coverage.

## Constraints
- Prefer incremental changes over rewrites.
- Avoid heavy new tooling unless justified.
- Keep assertions requirement-focused.

## Completion Output
Return in chat:
- requirement-to-test coverage status
- tests added/updated
- coverage findings
- commands to run tests and coverage
- recommended next command: `/project-fix-tests` (if failures remain) or `/project-refresh-docs`