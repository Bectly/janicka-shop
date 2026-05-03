# Performance Audit Convention

Established 2026-05-03 after Cycle #5182 (Trace) committed 8 raw Lighthouse
artefacts (4× `.report.json`, 4× `.report.html` ≈ +82k LOC) that had no
downstream consumer. Removed in C5185, gitignore guard added in C5187.

## Rule

Raw Lighthouse output (`.report.json`, `.report.html`) **never** lands in the repo.

```
/tmp/lighthouse/<YYYY-MM-DD>-<route>-<form>.{json,html}
```

The repo only carries the synthesised, human-readable summary:

```
docs/perf-reports/<YYYY-MM-DD>-summary.md
```

Optional sidecars allowed in `docs/perf-reports/`:

- `<date>-bolt-changes.md` — Bolt's response checklist for the audit
- `<date>-notes.md` — anything else markdown, hand-curated

## Why

- The JSON dump is ~17k LOC each; HTML embeds the same data plus client JS.
- Nobody reads them — diffs are unreadable, GitHub renders them as 404, the
  summary already extracts what's actionable.
- Bloating `.git` makes clones slower and burns LFS bandwidth on Vercel.
- If a future audit wants a numerical diff, running Lighthouse fresh against
  prod is faster (and more accurate) than parsing a stale committed JSON.

## Trace workflow (audit author)

1. Run Lighthouse, write outputs to `/tmp/lighthouse/...`.
2. Read the JSON inline (jq, grep, whatever) to extract metrics.
3. Read `docs/perf-reports/<previous-date>-summary.md` for prior baseline.
4. Write a new `docs/perf-reports/<today>-summary.md` with:
   - Route × form-factor table (perf, LCP, CLS, TBT, INP)
   - Delta vs previous summary (regressions ⚠, wins ✅)
   - ROI-sorted Bolt followups
5. Commit only the `summary.md` (and optional sidecars). Never `git add` the
   raw `/tmp/lighthouse/*` files.

## If you genuinely need a numerical diff across runs

- Push the JSON to S3 / Cloudflare R2 (separate bucket, lifecycle ≤ 90 days),
  link from the summary.
- Or use git LFS in a dedicated branch (do not merge to `main`).
- Never commit raw JSON directly to the tracked tree on `main`.

## Enforcement

`.gitignore` blocks the patterns:

```
docs/perf-reports/*.report.json
docs/perf-reports/*.report.html
```

If `git status` shows one of these as tracked, it slipped in before the
gitignore was added — `git rm --cached` and recommit.
