---
name: project-sync-metadata
description: "Sync canonical metadata from ProjectPlan.md and project-setup.json into repo docs and manifests."
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
- `ProjectPlan.md` defines intent; `project-setup.json` defines canonical metadata.
- The goal is **consistency** across README, LICENSE, and manifests, without rewriting the plan.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (required — create it with `/project-setup-json` if missing)
3) `README.md`, `help.md`, `LICENSE` (if present)
4) Project manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
5) `todo.md` (if present)

If `ProjectPlan.md` or `project-setup.json` is missing, stop and report.

## Workflow
1) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:sync-metadata]`.
2) Load canonical metadata from `project-setup.json`, then validate against `workspaceName` defaults.
   - Ensure `project.name` and `repository.name` match `workspaceName`.
   - Ensure `repository.owner` is `LightningPhil` unless explicitly overridden by the user.
   - Ensure author/maintainer name is `Philip Leichauer`.
   - Keep maintainer email blank.

3) Update `README.md` (create only if it already exists OR `files.ensureReadme` is true):
- Title = `project.name`
- One-line description = `project.description`
- Link/reference to `ProjectPlan.md`
- Quick start / dev / test commands (only if they exist)
- License line (only if a license exists)

4) License handling:
- If a license already exists, keep it consistent across README/manifests.
- If no license is explicit anywhere, add a TODO (do not invent legal text).

5) Sync manifest metadata where supported (minimal edits):
- name
- description
- author/maintainer **name only** (no email)
- license (only if known)

6) Consistency pass:
- README, LICENSE, manifests, and `project-setup.json` must agree on names and description.

## Constraints
- Keep edits minimal and ecosystem-safe.
- Do not invent missing legal details.
- Do not add a maintainer email.

## Completion Output
Return in chat:
- files changed
- any unresolved metadata TODOs
- recommended next command: `/project-audit-implementation`