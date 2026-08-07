# Relationship Graph Builder agent guide

## Scope and safety

- Start from the latest `main` in an isolated branch or worktree. Preserve unrelated local changes.
- This is a static GitHub Pages application. Prefer direct HTML, CSS, and JavaScript changes; do not add a runtime backend or build framework unless the task requires one.
- Treat `data/catalog.json` and `data/duplicate_candidates.json` as generated files. Change their source data or `scripts/build_catalog.py`, then rebuild; do not hand-edit generated output.
- Do not commit `_machine-data/`, temporary exports, dependency caches, or incidental catalog rebuilds.

## Validation

- Always run `git diff --check` and the smallest relevant tests.
- For JavaScript or UI changes, run:

  ```sh
  node --check app.js
  node --check map-globe.js
  node --test tests/test_app.js
  ```

- For catalog or Python changes, run:

  ```sh
  python3 -m unittest discover -s tests -v
  ```

- When behavior depends on current machine data, rebuild with `--require-data` against a local `ufo-files/machine-data` checkout using the same command shape as `.github/workflows/rebuild-graph.yml`.
- Report any check you could not run and why. Do not describe unrun checks as passing.

## Visual review

- For user-visible changes, capture before and after screenshots at the same viewport, graph configuration, and interaction state. Documentation-only, test-only, and nonvisual changes do not need screenshots.
- Store task-specific review images in `screenshots/`; do not overwrite the generated README gallery in `assets/screenshots/`.
- Check desktop and mobile layouts when responsive behavior could be affected. Inspect dense labels, empty states, focus/hover states, and long text where relevant.
- Serve previews with `python3 -m http.server 4173 --bind 0.0.0.0`. In the PR, include a Tailnet URL a reviewer can actually reach, including the exact path or hash needed to reproduce the view. Keep the server available during review, or say explicitly when it is no longer running.

## Pull requests

- Open a focused draft PR with the problem, solution, user impact, validation results, residual risk, and testing URL. Include before/after screenshots for user-visible changes.
- Do not mix generated catalog refreshes, automated screenshot refreshes, or unrelated cleanup into a feature PR.
- Monitor CI and review feedback. Address actionable comments, reply with what changed and how it was verified, and resolve a thread only after its concern is fixed or explicitly answered.
- If feedback changes visible output, replace the after screenshot and confirm the testing URL still reproduces the updated result.
- After merge, confirm the branch is deleted and report any deployment or follow-up work that remains.
