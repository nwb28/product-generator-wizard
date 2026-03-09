# Remediation Tracker

| ID | Area | Severity | Status | Owner | Notes |
|---|---|---|---|---|---|
| REM-001 | API auth/header policy hardening | Medium | Closed | Backend | Replaced temporary role header checks with JWT claim-based authorization middleware.
| REM-002 | UI production build pipeline | Medium | Closed | Frontend | Added Vite production bundling/runtime entry and retained automated UI tests.
| REM-003 | CI artifact retention policy | Low | Closed | DevOps | Added artifact retention windows, strict upload rules, and naming conventions in contract-gate workflow.
| REM-004 | Contract versioning governance docs | Low | Closed | Tech Lead | Published contract governance/versioning/approval policy.

## Burn-Down Result
1. Medium severity items closed.
2. Low severity items closed.
3. Release-check and golden deterministic suite validated after closures.
