# ADR-0001: Build Artifact Strategy

## Status
Accepted

## Date
2026-03-10

## Context
The repository previously contained generated build outputs (`dist/`, `.test-dist/`) in source control. This creates operational noise, merge conflicts, and non-source diffs that scale poorly for enterprise development velocity.

## Decision
1. Keep generated artifacts out of source control.
2. Generate build/test outputs during CI and local test workflows.
3. Enforce cleanliness checks that fail if tracked files are mutated by build/test steps.
4. Preserve deterministic build behavior through reproducible scripts and fixture-based tests.

## Rationale
1. Source repository remains focused on maintainable inputs (source, contracts, tests, docs, workflows).
2. CI is the authoritative producer of build outputs and release artifacts.
3. Reduces accidental drift between source and generated outputs.
4. Improves review quality by removing generated noise from PRs.

## Consequences
### Positive
1. Smaller, cleaner diffs and lower merge friction.
2. Better governance of release artifacts via CI evidence bundles and attestations.
3. Cleaner branch policy enforcement through worktree-clean checks.

### Tradeoffs
1. Builds are required before runtime tests that execute compiled outputs.
2. CI time can increase due to on-demand compilation.

## Implementation Notes
1. Ignore generated output paths in `.gitignore`.
2. Run `node tools/ensure-clean-worktree.mjs` in CI gates.
3. Keep deterministic/golden tests to guarantee repeatable generation.

## Alternatives Considered
1. Keep build outputs committed:
   - Rejected due to review noise and high risk of artifact drift.
2. Commit build outputs only for selected packages:
   - Rejected due to inconsistent policy and future confusion.
