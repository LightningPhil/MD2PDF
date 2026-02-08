---
name: project-git-initial-commit
description: "Initialize git (if needed), enforce .gitignore/.gitattributes hygiene, and create the first commit safely."
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
- This command performs the **first commit** workflow.
- `ProjectPlan.md` defines scope; `project-setup.json` defines git/setup preferences.
- Git ignore hygiene is mandatory before committing.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json` (required)
3) Existing `.gitignore` and `.gitattributes` (if present)
4) `README.md` and core project files (for sanity checks)

If `ProjectPlan.md` or `project-setup.json` is missing, stop and report.

## Workflow
1) If multi-step, create/update `todo.md` and prefix tasks with `[CMD:git-initial-commit]`.

2) Validate repository state:
- If no `.git/` directory exists, run `git init`.
- If commits already exist (`git rev-list --count HEAD > 0`), stop and report that the initial commit is already done.

3) Build git ignore policy from `project-setup.json`:
- Respect `files.ensureGitignore`, `files.gitignoreTemplate`, `files.ensureGitattributes`.
- If ensuring `.gitignore`, create it if missing and **merge** patterns (do not remove user rules).
- Always ensure common local-noise patterns are handled:
  - dependency folders (as appropriate for the stack)
  - build outputs (`dist`, `build`, `coverage`, cache dirs)
  - logs and temp files
  - local env/secrets (`.env`, `.env.*` except explicit examples)
  - editor/OS artifacts (`.vscode`, `.idea`, `.DS_Store`, `Thumbs.db`)

4) Ensure `.gitattributes` when configured:
- If enabled, ensure a minimal safe baseline, e.g. `* text=auto`.

5) Validate staging safety before commit:
- Stage according to `git.includeAll` (`git add -A` when true).
- Inspect staged files and detect forbidden entries (e.g., `node_modules/`, `.env`, large local artifacts).
- If forbidden files are staged: unstage them, adjust `.gitignore`, re-stage safely.

6) Create the first commit:
- Use `git.initialCommitMessage` from `project-setup.json`.
- Apply optional flags: `git.signoff`, `git.gpgSign`.
- Ensure default branch exists and is named per `repository.defaultBranch` (usually `main`).

7) Provide remote guidance only:
- Do not push automatically.
- If `repository.remoteUrl` exists, print exact commands for `git remote add origin` and first push.

## Constraints
- Do not force-push, rewrite history, or delete user files.
- Keep `.gitignore` additive; do not remove user-defined rules unless clearly broken.
- If unsure whether a file should be tracked, default to **not committing** it and report.

## Completion Output
Return in chat:
- whether git was initialized
- `.gitignore`/`.gitattributes` actions taken
- commit hash and commit message
- any files intentionally excluded from commit
- exact next commands for remote setup/push