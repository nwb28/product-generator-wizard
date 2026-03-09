# Contract Governance Policy

## Scope
Governs changes to intake and manifest contracts for Product Generator Wizard.

## Versioning Rules
- Breaking schema change: increment major version.
- Backward-compatible additive change: increment minor version.
- Metadata/comment-only adjustment: increment patch version.

## Change Process
1. Author schema/index update in `packages/contracts`.
2. Add or update contract tests in `packages/contracts/src/index.test.ts`.
3. Update validator/compiler behavior if contract semantics changed.
4. Run `npm run release:check`.
5. Submit PR with explicit compatibility impact summary.

## Approval Requirements
- 1 approval from Tech Lead (contract owner).
- 1 approval from Backend Engineer (validator/compiler owner).
- CI checks `bootstrap` and `contract-gate` must pass.

## Compatibility Registry
- Active versions are tracked in `packages/contracts/src/contracts.index.json`.
- Every contract change must include compatibility matrix updates.

## Deprecation
- Mark deprecated schema versions in `contracts.index.json`.
- Keep deprecated versions readable for at least one release cycle unless security-risk exception is documented.
