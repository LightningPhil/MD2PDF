---
name: project-init-metadata
description: "Sync canonical metadata from ProjectPlan.md and project-setup.json into repo docs and manifests."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Context
- `ProjectPlan.md` is the source of truth.
- `project-setup.json` should already exist from `/project-setup-json`.
- The workspace folder basename is the canonical project and repository name.
- Author is always `Philip Leichauer` unless explicitly overridden by the user.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (preferred)
3) `README.md`, `help.md`, `LICENSE` (if present)
4) Project manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
5) `todo.md` (if present)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Resolve canonical metadata:
- `projectName` and `repoName` from workspace folder basename
- `author = Philip Leichauer`
- `description` from `project-setup.json` first, then `ProjectPlan.md`
- `license` from existing files or explicit user instruction

2) Create or update `todo.md` for multi-step work.
- Prefix tasks with `[INIT]`.
- Keep tasks checked off as work completes.

3) Ensure `README.md` has consistent metadata:
- Title with `projectName`
- One-line description
- Author line
- License line
- Link to `ProjectPlan.md` and `help.md`

4) License handling:
- If license is explicit, ensure `LICENSE` matches it.
- If no license is explicit, ask once and add a `[INIT]` TODO until answered.

5) Sync manifest metadata where supported:
- name
- description
- author/maintainer
- license

6) Keep `ProjectPlan.md` stable.
- Do not rewrite plan sections.
- Only add a short `## Project Metadata` block if missing and if needed for consistency.

7) Run a consistency pass so README, LICENSE, manifests, and `project-setup.json` agree.

## Constraints
- Keep edits minimal and ecosystem-safe.
- Do not invent missing legal details.
- Do not delete user content.

## Completion Output
Return in chat:
- files changed
- unresolved metadata questions (if any)
- exact next step if a manual choice is still required