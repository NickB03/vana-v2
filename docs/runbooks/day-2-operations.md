# Day-2 Operations Runbook

This runbook is for operators maintaining Vana v2 after initial deployment.

## 1) Incident triage flow

1. Confirm blast radius (all users vs subset)
2. Check app logs for API failures (`/api/chat`, provider errors)
3. Check database connectivity and migration state
4. Check search provider and model provider health
5. Mitigate with rollback or provider fallback

## 2) Key rotation checklist

Rotate on schedule and after any suspected exposure:

- AI provider key(s)
- Search provider key(s)
- Supabase anon key (if rotated at project level)
- Upstash Redis token

After rotation:

1. Update secrets in deployment platform
2. Redeploy
3. Run smoke test (chat request + citation path)

## 3) Provider outage fallback

If primary LLM provider fails:

1. Switch to alternate configured provider keys
2. Validate model IDs in `config/models/*.json`
3. Redeploy and verify one complete response

If search provider fails:

1. Switch `SEARCH_API` to alternate provider
2. Ensure corresponding API key exists
3. Validate search and citation output

## 4) Telemetry review routine

Daily checks:

- Error logs trend
- Request latency anomalies
- Rate-limit spikes
- Provider-specific failure rates

Weekly checks:

- Cost and token usage trends
- Slow query/provider patterns
- Alert thresholds and routing correctness
