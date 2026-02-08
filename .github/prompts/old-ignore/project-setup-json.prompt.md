---
name: project-setup-json
description: "Create or update project-setup.json from ProjectPlan.md with canonical repo metadata."
agent: "agent"
argument-hint: configFile=project-setup.json
---

You are working inside a VS Code workspace/repository.

## Context
- `ProjectPlan.md` is the gold-standard source of intent.
- This command should run first after a plan is present.
- Use the workspace folder basename as both project name and repository name.
- Author defaults to `Philip Leichauer`.

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
    "owner": "",
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
- `project.author = "Philip Leichauer"`
- `maintainer.name = "Philip Leichauer"`

5) Preserve existing non-conflicting values when reasonable.
6) If data is unknown, leave an empty string and add a TODO in `notes.todos`.
7) Add 2-5 bullets in `notes.fromProjectPlan` summarizing what was inferred from `ProjectPlan.md`.

## Constraints
- Do not initialize git, create commits, or push.
- Do not delete files.
- Do not overwrite unrelated files.

## Completion Output
Return in chat:
- path written
- canonical values used (`workspaceName`, author)
- short manual checklist for first remote push
- recommended next command: `/project-initial-commit`
