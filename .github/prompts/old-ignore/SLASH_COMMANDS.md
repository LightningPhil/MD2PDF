# Slash Commands Reference

This folder contains custom slash-command prompts for this repository.

## Recommended order
1. `/project-setup-json`
2. `/project-init-metadata`
3. `/project-audit`
4. `/project-initial-commit`
5. `/project-test-audit` or `/project-run-tests-and-fix`
6. `/project-fix-problems`
7. `/project-interactive-console-fix`
8. `/project-docs-refresh`
9. `/project-build-single-html` (only if required by `ProjectPlan.md`)
10. `/project-generate-codex-plan` (planning artifact only)

## Renamed commands
- `/git-setup-json` -> `/project-setup-json`
- `/project-init` -> `/project-init-metadata`
- `/docs-refresh` -> `/project-docs-refresh`
- `/fix-problems` -> `/project-fix-problems`
- `/generate-codex` -> `/project-generate-codex-plan`
- `/interactive-console-fix` -> `/project-interactive-console-fix`
- `/run-tests-and-fix` -> `/project-run-tests-and-fix`
- `/test-audit` -> `/project-test-audit`
- `/build-single-html` -> `/project-build-single-html`

## Command summary
- `/project-setup-json`
  - Creates or updates `project-setup.json` from `ProjectPlan.md`.
  - Uses workspace folder name as both project and repository name.
  - Uses `Philip Leichauer` as author by default.

- `/project-init-metadata`
  - Syncs metadata across README, LICENSE, and manifests.
  - Uses `ProjectPlan.md` and `project-setup.json` as canonical inputs.

- `/project-audit`
  - Detects bootstrap vs audit mode.
  - Builds and executes a requirement-aligned todo plan.

- `/project-initial-commit`
  - Initializes git if needed and creates the first commit.
  - Enforces `.gitignore` and `.gitattributes` hygiene before commit.
  - Prevents common local/secrets/artifact files from being committed.

- `/project-test-audit`
  - Maps requirements to tests.
  - Improves coverage and test quality, then verifies gates.

- `/project-run-tests-and-fix`
  - Runs the full suite and fixes failures iteratively.
  - Clears VS Code `#problems` Errors during the loop.

- `/project-fix-problems`
  - Focused pass to clear VS Code `#problems`.
  - Errors first, then low-risk warnings.

- `/project-interactive-console-fix`
  - Runs app + interaction window, captures runtime/console errors.
  - Fixes issues iteratively and re-verifies.

- `/project-docs-refresh`
  - Updates `README.md` and `help.md` to match real behavior.
  - Keeps docs understandable for non-authors.

- `/project-build-single-html`
  - Produces a single offline HTML artifact.
  - Adds repeatable build steps and docs.

- `/project-generate-codex-plan`
  - Read-only repo audit that writes `Codex.md` task plan.
  - Intended for planning and sequencing work, not implementation.

## Ground rules used by all prompts
- `ProjectPlan.md` is the primary source of truth.
- Keep changes minimal and scoped.
- Track multi-step work in `todo.md`.
- Verify with tests/build and clear VS Code `#problems` Errors.

## Obvious missing commands to consider
- `/project-security-audit`
  - Dependency, secret, and config safety checks with actionable fixes.

- `/project-release-prep`
  - Version bump, changelog update, release checklist, and tag prep.

- `/project-ci-refresh`
  - Align local scripts with CI workflow files and enforce consistent gates.
