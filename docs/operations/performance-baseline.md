# Performance Baseline

## Objective
Provide a repeatable local/CI load test baseline for enterprise readiness before broader pilot onboarding.

## Command
Run:

```bash
npm run perf:baseline
```

Preview profile:

```bash
npm run perf:preview
```

The script will:
1. Build contracts and API artifacts.
2. Start the generator API in-process.
3. Execute sampled load against `/validate` and `/generate`.
4. Calculate latency summary metrics and enforce p95 thresholds.
5. Write run output to `.tmp/perf/latest.json`.

Preview profile output:
1. Builds contracts, adapters, and API artifacts.
2. Executes sampled load against `/preview/validate`, `/preview/simulate`, and `/preview/report`.
3. Enforces endpoint p95 thresholds and writes `.tmp/perf/preview-latest.json`.

## Default Thresholds
- `/validate` p95: `<= 750ms`
- `/generate` p95: `<= 1500ms`

## Tunable Environment Variables
- `PERF_SAMPLE_SIZE` (default `50`)
- `PERF_CONCURRENCY` (default `10`)
- `PERF_VALIDATE_P95_MS` (default `750`)
- `PERF_GENERATE_P95_MS` (default `1500`)

## Exit Code Contract
- Exit `0`: all thresholds met.
- Exit non-zero: at least one threshold failed.

## Usage in CI
Run this command in a dedicated optional performance job first. Once stable over multiple runs, elevate to a required gate for release candidates.

Current dedicated workflow:
- `.github/workflows/nonfunctional-reliability.yml` (scheduled weekly + manual dispatch)
- `.github/workflows/perf-trend.yml` (nightly long-run trend profile with artifacts)
- `.github/workflows/perf-trend.yml` also enforces `config/perf-load-policy.json` via `npm run perf:longrun:check`.
