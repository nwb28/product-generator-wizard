# Product Generator Wizard

Monorepo for the Product Generator Wizard MVP.

## Structure
- `apps/wizard-ui`: React UI for intake, validation, generation, and downloads
- `apps/generator-api`: HTTP API exposing validate/compile/generate/review-document
- `apps/preview-sandbox`: React app for built-product preview session simulation
- `tools/generator-cli`: CLI for local and CI workflows
- `packages/contracts`: Versioned intake/manifest schemas and contracts index
- `packages/product-adapters`: Built-product adapter interfaces and registry primitives
- `packages/validator`: Intake validation + diagnostics
- `packages/compiler`: Intake -> manifest compilation
- `packages/scaffold-templates`: Deterministic scaffold generation for pilot profile
- `packages/review-doc`: Human review markdown generation
- `fixtures/golden`: Golden deterministic fixtures

## Getting started
```bash
npm install
npm run build
npm test
```

## Operational Checks
- `npm run config:check` validates production-grade secret/runtime configuration.
- `npm run perf:baseline` runs local API load baseline and threshold checks.
- API contract reference: `docs/api/openapi.yaml`.
- OpenAPI validation: `npm run openapi:check`.
- Full documentation index: `docs/README.md`.
