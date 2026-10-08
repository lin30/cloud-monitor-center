# LIGHT public dashboard

Static research and simulated-portfolio snapshot. No dependency installation, build workflow, or custom CI is required. Existing GitHub Pages publishing remains unchanged.

## Fixed pre-publication check

Run from this directory:

    node tests/verify.js

This command validates `dashboard/current.json` itself before publication, checks the complete public field allowlist, rejects execution conditions in allowed text fields, and tests the same date logic used by the page. Unknown fields fail closed; do not rely on hiding or sanitizing fields in the browser. Never upload unreviewed private source data to this public repository.

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
