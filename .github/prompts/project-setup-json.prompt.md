---
name: project-setup-json
description: "Create or update project-setup.json from ProjectPlan.md with canonical repo metadata."
agent: "agent"
argument-hint: configFile=project-setup.json
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
- `ProjectPlan.md` is the gold-standard source of intent.
- This command should run first after a plan is present.
- Do **not** initialize git, create commits, or push anything.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) Existing `${workspaceFolder}/${input:configFile:project-setup.json}` (if present)
3) `README.md` and `package.json` (optional, for description hints only)

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Compute `workspaceName` from the basename of `${workspaceFolder}`.
2) Extract a short description from `ProjectPlan.md` (first clear purpose statement).
3) Create or update `${workspaceFolder}/${input:configFile:project-setup.json}` with this schema:

```json
{
  "version": 1,
  "project": {
    "name": "",
    "description": "",
    "author": "Philip Leichauer"
  },
  "repository": {
    "name": "",
    "provider": "github",
    "owner": "LightningPhil",
    "defaultBranch": "main",
    "remoteUrl": ""
  },
  "maintainer": {
    "name": "Philip Leichauer",
    "email": ""
  },
  "git": {
    "initialCommitMessage": "chore: initial commit",
    "includeAll": true,
    "signoff": false,
    "gpgSign": false
  },
  "files": {
    "ensureGitignore": true,
    "gitignoreTemplate": "",
    "ensureGitattributes": true,
    "ensureReadme": false,
    "ensureLicense": false
  },
  "notes": {
    "fromProjectPlan": [],
    "todos": []
  }
}
```

4) Enforce canonical values:
- `project.name = workspaceName`
- `repository.name = workspaceName`
- `repository.owner = "LightningPhil"`
- `project.author = "Philip Leichauer"`
- `maintainer.name = "Philip Leichauer"`
- leave `maintainer.email` as an empty string

5) Populate:
- `project.description` from step (2).
- If `repository.remoteUrl` is empty, set a **default guess**:
  - `https://github.com/LightningPhil/${workspaceName}.git`
  - and add a TODO in `notes.todos` to confirm it matches the actual remote (or blank it if undesired).

6) Preserve existing non-conflicting values when reasonable (never overwrite canonical fields).
7) If any data is unknown/uncertain, leave it blank and add a TODO in `notes.todos`.
8) Add 2–5 bullets in `notes.fromProjectPlan` summarizing what was inferred from `ProjectPlan.md`.

## Constraints
- Do not initialize git, create commits, or push.
- Do not delete files.
- Do not overwrite unrelated files.

## Completion Output
Return in chat:
- path written
- canonical values used (`workspaceName`, owner, author)
- any TODOs added
- recommended next command: `/project-sync-metadata`
- a short manual checklist for first remote push (commands only, no pushing automatically)