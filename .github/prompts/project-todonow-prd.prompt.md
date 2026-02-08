---
name: project-todonow-prd
description: "Generate todonowPRD.md with a detailed Claude-agent execution plan to close all gaps vs ProjectPlan.md."
agent: "agent"
---

You are working inside a VS Code workspace/repository.

## Canonical Defaults
- `workspaceName` = basename of `${workspaceFolder}`
- GitHub owner: `LightningPhil`
- Author/maintainer name: `Philip Leichauer`
- Default branch: `main`
- Canonical config file: `project-setup.json`

## Context
- Purpose: produce **todonowPRD.md** — a hyper-detailed PRD instructing Claude (inside Copilot) what to do next.
- It must close the delta between **current repo state** and **ProjectPlan.md**.
- Treat this as an actionable engineering contract, not a high-level brainstorm.

## Required Inputs (read in order)
1) `ProjectPlan.md` (required)
2) `project-setup.json`
3) `todo.md`
4) `Codex.md` (if present)
5) Entire repo tree

If `ProjectPlan.md` is missing, stop and report.

## Workflow
1) Extract all requirement IDs and acceptance criteria from ProjectPlan.md.
2) Inventory current implementation, tests, docs, scripts, and CI.
3) Produce a gap table:
   - REQ
   - Status (Missing / Partial / Broken)
   - Evidence files
4) Convert gaps into executable workstreams:
   - BUILD
   - TEST
   - DOCS
   - CI
   - UX
5) For every task include:
   - exact files to touch
   - commands to run
   - success criteria
   - rollback plan
6) Order tasks strictly by dependency.
7) Flag any ambiguity as blocking questions.

## todonowPRD.md Required Sections
1) Executive summary
2) Repo state snapshot
3) Requirement catalog
4) Gap analysis table
5) Dependency graph
6) Ordered execution plan
7) Verification gates
8) Stop conditions
9) Risks & unknowns
10) Suggested slash-command chain

## Constraints
- No scope creep beyond ProjectPlan.md.
- Prefer minimal edits.
- Everything must be verifiable locally.

## Completion Output
Return in chat:
- file path written
- number of tasks created
- recommended next slash command
