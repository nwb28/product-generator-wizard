# Product Generator Wizard - User Guide

## Purpose
Use the wizard to validate intake payloads, generate deterministic scaffold artifacts, and download a package for review.

## UI Flow
1. Open `/wizard/new` (or deep-link with context query params).
2. Paste or edit intake JSON.
3. Review live validation diagnostics.
4. Click **Generate Artifacts** once validation is clean.
5. Download generated package output.

## Deep-Link Parameters
- `productType`
- `connectionType`
- `tenant`

Example:
`/wizard/new?productType=note-payable&connectionType=api&tenant=contoso`

## CLI Quick Start
```bash
node tools/generator-cli/dist/index.js validate fixtures/golden/pilot-intake.json
node tools/generator-cli/dist/index.js ci-check fixtures/golden/pilot-intake.json
node tools/generator-cli/dist/index.js generate fixtures/golden/pilot-intake.json --out .tmp/output
```

## Diagnostics
- `blocking`: must be fixed before CI passes.
- `warning`: lowers readiness score and should be reviewed.
