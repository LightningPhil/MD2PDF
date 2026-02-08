# Copilot workspace instructions (home/DIY web repos)

## Canonical sources of truth (read in this order)
1) `ProjectPlan.md` — **gold standard** for intent, scope, requirements, and non-goals.
2) `project-setup.json` — canonical repo metadata derived from `ProjectPlan.md`.
3) Repo files (`README.md`, `package.json`, configs, code) — must conform to (1) and (2).

If `ProjectPlan.md` is missing, stop and report.

## Non-negotiable defaults
- Workspace folder basename is **both** the project name **and** the repository name.
- GitHub owner: `LightningPhil`
- Author / maintainer name: `Philip Leichauer`
- Maintainer email: **empty string** (do not invent one)
- Default branch: `main`

## Project type & coding style
- This is a web application.
- Prefer **TypeScript** over JavaScript when practical.
- Use existing project patterns and dependencies; **don’t introduce new libraries** unless asked.
- Keep changes minimal and scoped to what the user requested or what `ProjectPlan.md` requires.

## Standard dev commands (discover from `package.json`, then use)
- Install: `npm ci` (fallback `npm install` if lockfile is unreliable)
- Dev server: `npm run dev`
- Build/typecheck: `npm run build` and/or `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test` or `npm run test` (use the repo’s scripts)

## Preview & UI debugging (VS Code)
- When asked to preview or validate UI changes, use VS Code’s **Integrated Browser** for localhost pages.
- When debugging UI issues, use **“Add element to chat”** so the chat receives exact HTML/CSS context.

## Required workflow: TODO-driven execution
- Before any multi-step work (more than one edit), create or update `todo.md` in the repo root.
- Put the plan as a Markdown checklist; keep items short and concrete.
- Tick items off as you complete them.
- Keep `todo.md` current throughout the work (not just at the end).

## Finishing pass (always)
After edits, do a diagnostics + verification pass:
1) Check VS Code `#problems`:
   - Fix **Errors** first, then low-risk Warnings.
2) Run the relevant scripts (tests/build/typecheck/lint) that match the change.
3) Re-verify `#problems` is clear of Errors.

## Slash-command workflow (recommended order)
1) `/project-setup-json`
   - Create/update `project-setup.json` from `ProjectPlan.md` using the defaults above.
2) `/project-sync-metadata`
   - Sync README/LICENSE/manifests/etc. to match `project-setup.json` + `ProjectPlan.md`.
3) `/project-audit-implementation`
   - Convert requirements into an actionable `todo.md` and execute safely.
4) `/project-git-initial-commit`
   - Initialize git if needed; ensure `.gitignore`/`.gitattributes` hygiene; make the first commit.
5) Choose as needed:
   - `/project-audit-tests` → map requirements to tests + coverage plan
   - `/project-fix-tests` → run tests and fix iteratively
   - `/project-fix-problems` → clear VS Code `#problems` Errors
   - `/project-fix-runtime` → run app, capture console/runtime errors, fix iteratively
   - `/project-refresh-docs` → update docs to match real behavior
   - `/project-build-single-html` → produce a single offline HTML artifact (only if `ProjectPlan.md` requires it)
   - `/project-plan-codex` → produce a planning-only `Codex.md` (no implementation)

## How to behave during fixes
- Prefer **root-cause** fixes over silencing errors.
- Avoid broad try/catch wrappers used only to hide issues.
- If unsure about intent, return to `ProjectPlan.md` and align to it.
