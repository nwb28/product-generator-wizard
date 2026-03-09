# Product Generator Wizard - Maintainer Guide

## Repository Layout
- `apps/wizard-ui`: intake editing, validation display, generation flow.
- `apps/generator-api`: validate/compile/generate/review endpoints.
- `tools/generator-cli`: CI and local command surface.
- `packages/contracts`: intake and manifest schemas + compatibility index.
- `packages/validator`: diagnostics engine.
- `packages/compiler`: intake -> manifest compiler.
- `packages/scaffold-templates`: deterministic scaffold generator.
- `packages/review-doc`: human review markdown generation.
- `fixtures/golden`: determinism fixtures.

## CI Contract Gate
Workflow: `.github/workflows/generator-contract-gate.yml`

Gate sequence:
1. Build workspace.
2. Validate intake.
3. Run `ci-check` for blocking diagnostics.
4. Generate output package.
5. Run scaffold tests including golden hash/file-tree test.
6. Publish diagnostics + review document artifacts.

## Versioning and Contracts
- Active schema versions are declared in `packages/contracts/src/contracts.index.json`.
- Breaking contract changes require major version updates.
- Keep intake and manifest compatibility policy synchronized with validator/compiler behavior.

## Determinism Requirements
- Stable key ordering in serialized JSON.
- Stable file ordering in generated outputs.
- No raw timestamps in generated artifacts unless normalized policy is explicitly changed.

## Release Checklist
1. Run `npm run build`.
2. Run `npm test`.
3. Verify golden fixture hash stability.
4. Verify pilot intake still passes `ci-check`.

## Automated Release Check
Run `npm run release:check` before merging release candidates.

## Environment Configuration
See `docs/environment-config.md` for required runtime variables and production auth hardening rules.
