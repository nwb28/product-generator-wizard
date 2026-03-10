# Adapter Versioning and Compatibility Policy

## Purpose
Control evolution of built-product adapters without breaking preview pipeline determinism or contract compatibility.

## Version Semantics
1. Major: breaking behavior changes in adapter output semantics.
2. Minor: backward-compatible feature additions.
3. Patch: non-semantic fixes and metadata updates.

## Required Registry Updates
1. Update `packages/product-adapters/src/adapters.index.json` for any adapter version change.
2. Declare supported schema versions for:
   - built-product-intake
   - preview-session
   - compatibility-report
3. Keep active schema version fields aligned with approved contract baseline.

## CI Requirements
1. Adapter version must be present in compatibility index.
2. Compatibility assertions must pass in package tests.
3. `preview-contract-gate` must fail on unknown or incompatible adapter version references.

## Deprecation Rules
1. Deprecate adapter versions in one release before removal unless emergency security exception is approved.
2. Deprecation notice must include migration target version and deadline.
3. Removal requires successful pilot validation on replacement adapter version.
