# LIGHT public dashboard

Static research and simulated-portfolio snapshot. No dependency installation, build workflow, or custom CI is required. Existing GitHub Pages publishing remains unchanged.

## Existing production interface

The external contract remains `schema_version=cloud_monitor_dashboard.v1`, `ui_version=light_dashboard_portfolio_v3`, and `trade_permission=false`. The frontend uses these same markers. The temporary `light_dashboard_trust_v4` marker was an interface mistake, not a required producer upgrade; it is accepted only by the read adapter for old cached snapshots and is never valid for a new publication.

Required modules remain overview, weekly, watchlist, opportunities, industry, robotics and status. Overview retains metrics, domain_budget, decision, actual, seats, risk_family and focus. Both the original flat `source_as_of` form and the existing per-source trust extensions are accepted. Trust metadata, audit details, per-status source IDs, and preparation/publication times are optional, never new required producer fields. Legacy technical metadata is not freshness evidence. `next_trigger` may contain safe research follow-up text only; specific trading conditions, capital actions and execution windows remain prohibited.

The original daily publisher normally updates only `dashboard/current.json` and keeps the established shell. `contract.js`, this README and the tests are auxiliary; the producer does not need to add files, install Node, update those files daily, change its version or alter its schedule. Missing business dates remain unknown. This interface correction does not replay a rejected synchronization or diagnose a platform safety rejection.

## Public write contract and optional developer check

The existing publishing task can read `contract.js` as the public-field and content contract. Node execution is not a production prerequisite; no new runner is needed. Do not publish unreviewed source payloads or assume browser hiding protects a publicly accessible JSON file.

For a developer with Node already available, run from this directory:

    node tests/verify.js

This command validates `dashboard/current.json` itself before publication, checks the complete public field allowlist, rejects execution conditions in allowed text fields, and tests the same date logic used by the page. For a new publication, supplied fields in either supported v3 shape receive the same public-boundary checks; unrecognized fields fail the check; do not rely on hiding or sanitizing fields in the browser. The browser has a separate read-only adapter for old v1 snapshots: it selects safe fields, hides old execution text, and marks missing source dates unknown instead of rejecting a usable legacy snapshot. It never writes the source back. This does not protect the original public JSON or prove that an existing publisher uses this contract. Never upload unreviewed private source data to this public repository.

Actual simulated holdings, research Target weights and research budgets remain distinct. Specific trading triggers, capital-action instructions, account details, and execution ledgers are not public fields. A text scan is an additional guard, not a substitute for reviewing new public text.

## Time and status contract

- `source_as_of`: independent business-source cutoff times; never inferred from JSON generation or deployment.
- `generated_at`: time this public JSON was prepared; it does not establish business freshness.
- `source_snapshot_generated_at`: original historical snapshot preparation time, when known.
- `published_at`: independently confirmed completed deployment time, otherwise `null`.
- `snapshot_commit`: independently verified source commit, otherwise `null`; never invent a self-referential SHA.
- All full timestamps must include a timezone. Date-only business sources are displayed as day precision and conservatively measured from 00:00 Asia/Shanghai.
- A fixed 48-hour display threshold marks historical sources stale. This is a conservative UI rule, not an exchange calendar or a production service-level claim. Invalid, absent, or more than five-minute future source times are unknown, never healthy.

The page re-evaluates time every minute and on navigation. A successful page read or deployment does not establish production recovery. Check the remote commit and the existing Pages deployment for that exact SHA separately.
