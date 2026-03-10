# Adapter Authoring Guide

## Purpose
Guide engineers implementing `packages/product-adapters` integrations for built-product compatibility validation.

## Contract Requirements
1. Input must satisfy `built-product-intake.schema.json`.
2. Output preview session must satisfy `preview-session.schema.json`.
3. Compatibility report must satisfy `compatibility-report.schema.json`.
4. Adapter version must be declared in `adapters.index.json`.

## Implementation Checklist
1. Implement adapter with deterministic transforms only.
2. Keep key ordering stable in serialized outputs.
3. Avoid non-normalized timestamps in hash inputs.
4. Emit diagnostics with:
   - `code`
   - `severity`
   - `path`
   - `message`
5. Add unit tests for:
   - valid mapping pass
   - missing mandatory fields (blocking)
   - warning category behavior
   - deterministic output equivalence

## Testing Workflow
1. Build/test adapter workspace:
   - `npm run build --workspace @pgw/packages-product-adapters`
   - `npm test --workspace @pgw/packages-product-adapters`
2. Validate integration with API:
   - `npm run build --workspace @pgw/apps-generator-api`
   - `npm test --workspace @pgw/apps-generator-api`
3. Validate fixture determinism:
   - `npm run preview:gate`

## Versioning Rules
1. Backward-compatible changes increment minor version.
2. Breaking contract changes increment major version.
3. Deprecations require an announced sunset date in governance docs.
4. CI must validate adapter index compatibility policy before merge.

## Review Criteria
1. Contract compliance.
2. Determinism guarantees.
3. Diagnostic quality and coverage.
4. Tenant and authorization boundary adherence.
