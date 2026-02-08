---
name: project-build-single-html
description: "Produce a single self-contained offline HTML artifact, with repeatable build steps and verification."
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
- Target output: one portable HTML file that opens locally with `file://`.
- Use this only when `ProjectPlan.md` requires offline single-file distribution.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `README.md`
3) Build/test scripts and bundler config
4) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:build-single-html]`.

2) Detect setup state:
- If a repeatable single-file build already exists, run tests then regenerate.
- If not, add the smallest required tooling to make it repeatable.

3) Produce artifact at `dist/singlefile/index.html` by default.
4) Verify no required sibling assets remain (open locally and check for missing resources).
5) Document build and usage instructions in `README.md`.
6) Ensure VS Code `#problems` has no Errors.

## Constraints
- Prefer existing bundler and scripts.
- Keep dependency additions minimal.
- Do not break normal dev workflow.

## Completion Output
Return in chat:
- build command(s)
- files changed
- artifact path
- known offline limitations