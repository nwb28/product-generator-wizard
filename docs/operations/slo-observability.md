# SLO and Observability Baseline

## Scope
This baseline covers `apps/generator-api` for enterprise operation with multi-tenant workloads.

## SLOs
1. Availability SLO: `99.9%` successful requests (HTTP `<500`) over 30 days for `/validate`, `/compile`, `/generate`, `/review-document`.
2. Latency SLO: p95 request latency under `750ms` for `/validate` and under `1500ms` for `/generate` over 30 days.
3. Correctness SLO: `0` successful responses for requests that violate blocking contract rules.
4. Abuse Protection SLO: `100%` of over-limit requests return `429` with `Retry-After`.

## Telemetry Signals
The API emits OpenTelemetry-style hooks through an injectable telemetry client:
- Counter: `wizard_api_requests_total`
- Histogram: `wizard_api_request_duration_ms`
- Span: `http.server.request`

Required attributes:
- `method`
- `path`
- `statusCode`
- `outcome` (`success`, `error`, `throttled`)

## Alerting Baseline
1. Availability alert: trigger when 5-minute error rate (`5xx`) > 2%.
2. Latency alert: trigger when p95 over rolling 15 minutes breaches endpoint SLO.
3. Abuse alert: trigger when `429` rate increases by 3x baseline for 15 minutes.
4. Burn-rate response procedure is documented in `docs/operations/slo-alert-runbook.md`.

## Operational Guidance
1. Keep `WIZARD_TELEMETRY_STDOUT=false` in production unless a temporary debug session is active.
2. Export counters/histograms/spans to central observability backends (Azure Monitor, Datadog, or equivalent).
3. Keep endpoint-level dashboards per tenant segment and environment.
4. Review SLO attainment weekly and record action items in `docs/operations/operations-log.md`.
