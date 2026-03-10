# Preview Operator Guide

## Purpose
Operational guide for product/platform operators running built-product preview checks before catalog inclusion.

## Entry Points
1. Preview Sandbox UI (`apps/preview-sandbox`).
2. API endpoints (`/preview/validate`, `/preview/simulate`, `/preview/report`).
3. CI gate workflow (`preview-contract-gate`).

## Operator Workflow
1. Load or paste built-product intake payload.
2. Run validation and resolve blocking diagnostics.
3. Run simulation to inspect:
   - UI view projections
   - Excel declaration simulation
   - Workforce declaration simulation
   - BUCS/Firm/Company permission matrix impact
4. Complete manual checklist and reviewer sign-off.
5. Generate and export readiness report.
6. Attach artifacts to governance review ticket.

## Interpretation Guidance
1. Blockers require fix before rerun.
2. Warnings reduce readiness score and must be triaged.
3. Permission matrix mismatches require SME confirmation.
4. Canonical mapping coverage below threshold requires remediation.

## Required Evidence to Submit
1. Diagnostics JSON.
2. Human-readable report markdown.
3. Deterministic generation metadata hash.
4. CI run result for preview gate.

## Troubleshooting
1. `401/403`:
   - Verify role claims and tenant binding.
2. Schema validation errors:
   - Re-check required fields and conditional declarations.
3. Report marked `No-Go` without blockers:
   - Confirm warning deduction policy and manual checklist completion.
4. Hash instability:
   - Ensure no runtime timestamps or non-deterministic ordering in adapter output.
