# Slash Commands Reference

These are custom slash-command prompts intended for **GitHub Copilot Chat** inside a VS Code workspace.

## Canonical assumptions shared by all commands
- `ProjectPlan.md` is the **gold standard** source of truth.
- The **workspace folder name** (basename of the folder opened in VS Code) is used as:
  - the project name
  - the GitHub repository name
- Repo owner: **LightningPhil**
- Author/maintainer name: **Philip Leichauer**
- Maintainer email: **left blank**
- Default branch: **main**
- Multi-step work is tracked in `todo.md` using a `[CMD:...]` prefix.

## Recommended order
1. `/project-setup-json` (create `project-setup.json` from `ProjectPlan.md`)
2. `/project-sync-metadata` (align README/LICENSE/manifests with the JSON + plan)
3. `/project-audit-implementation` (bootstrap or audit implementation against the plan)
4. `/project-git-initial-commit` (initialize git + first commit, safely)
5. `/project-audit-tests` **or** `/project-fix-tests`
6. `/project-fix-problems`
7. `/project-fix-runtime`
8. `/project-refresh-docs`
9. `/project-build-single-html` (only if required by `ProjectPlan.md`)
10. `/project-plan-codex` (planning artifact only)

## Command summary

### `/project-setup-json`
Creates/updates `project-setup.json` by reading `ProjectPlan.md`.  
Sets canonical fields (workspace name, owner, author) and records TODOs for anything unknown.

### `/project-sync-metadata`
Uses `project-setup.json` + `ProjectPlan.md` to keep metadata consistent across:
- `README.md`
- `LICENSE` (if present)
- common manifests (`package.json`, `pyproject.toml`, etc.)

### `/project-audit-implementation`
Detects **Bootstrap** vs **Audit** mode, converts `ProjectPlan.md` into a checklist, executes minimal changes to align the repo, and verifies basic quality gates.

### `/project-git-initial-commit`
Initializes git (if needed), enforces `.gitignore` / `.gitattributes` hygiene, and creates the **first commit** without accidentally committing secrets or bulky local artifacts.

### `/project-audit-tests`
Builds a requirement-to-test matrix from `ProjectPlan.md`, improves test coverage/quality, and verifies gates (tests + `#problems` Errors).

### `/project-fix-tests`
Runs the full test suite, groups failures by root cause, fixes iteratively, and keeps VS Code `#problems` Errors cleared during the loop.

### `/project-fix-problems`
Focused pass to clear VS Code `#problems` items (Errors first; warnings only if low-risk and quick).

### `/project-fix-runtime`
Runs the app, asks for ~30 seconds of real interaction, captures browser/runtime errors, fixes root causes, and re-verifies with tests + `#problems`.

### `/project-refresh-docs`
Updates `README.md` and `help.md` so documentation matches reality and `ProjectPlan.md` (no invented features).

### `/project-build-single-html`
Produces a **single offline HTML** artifact (default `dist/singlefile/index.html`) with repeatable build steps and verification.

### `/project-plan-codex`
**Read-only** audit (except writing `Codex.md`). Produces a phased, dependency-aware implementation plan mapped to `ProjectPlan.md` requirements.

## Legacy command name mapping (old → new)
- `/project-init-metadata` → `/project-sync-metadata`
- `/project-audit` → `/project-audit-implementation`
- `/project-initial-commit` → `/project-git-initial-commit`
- `/project-test-audit` → `/project-audit-tests`
- `/project-run-tests-and-fix` → `/project-fix-tests`
- `/project-interactive-console-fix` → `/project-fix-runtime`
- `/project-docs-refresh` → `/project-refresh-docs`
- `/project-generate-codex-plan` → `/project-plan-codex`

## Obvious missing commands to consider (optional)
- `/project-verify`
  - Runs the repo’s “full gate” locally (build + lint + typecheck + tests) and reports a single pass/fail summary.

- `/project-format-lint-fix`
  - Applies formatting and lint auto-fixes (Prettier/ESLint/ruff/etc.) and then re-runs the relevant checks.

- `/project-security-audit`
  - Dependency + secret/config sanity checks with actionable fixes (kept lightweight; no huge new tooling).

- `/project-ci-refresh`
  - Aligns local scripts with CI workflow files and enforces consistent gates.

- `/project-release-prep`
  - Version bump, changelog update, release checklist, and tag prep (keeps steps explicit and manual where appropriate).

- `/project-create-remote`
  - Creates/configures the GitHub repo remote (only if you use `gh` CLI and are authenticated).
