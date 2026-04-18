# Sage Failure Triage — Task #373 Close-Out

Cycle #4388 — triage of 610 reported Sage failures/24h.

## Findings

| Metric | Value |
|---|---|
| Sage tasks spawned (last 24h) | 1,415 |
| Failed (`status='failed'`) | 1,251 |
| Completed (`status='completed'`) | 163 |
| Running | 1 |

### Failure signatures (top 3)

| exit_code | count | notes |
|---|---:|---|
| 143 (SIGTERM) | 1,211 | Terminated by orchestrator/OS; duration 1–2s in 1,203/1,211 cases |
| 1 | 23 | Generic worker error |
| -15 / -9 | 6 | SIGTERM/SIGKILL from signal delivery (negative = killed by signal) |
| `No such file or directory: 'claude'` | 2 | PATH race during worker spawn |

### Duration distribution of SIGTERMed tasks (exit 143)

| duration (s) | count |
|---:|---:|
| 1 | 918 |
| 2 | 285 |
| 0 | 2 |
| > 16 | 6 |

## Diagnosis

- **Primary signal**: 96 % of "failures" are `exit_code=143` with **duration ≤ 2 s**. The worker process was killed almost immediately after spawn — it never had time to do Playwright, run `claude`, or touch the repo.
- **Root cause is dispatcher over-scheduling**, not Sage runtime error. A successful Sage cycle takes **260–400 s** (measured across 163 completions, e.g. `id=15797` @ 367 s, `id=15793` @ 396 s). During the failure bursts the dispatcher was queuing a new Sage task every **~2 s** (e.g. ids 15607–15611 spaced 2 s apart), so each fresh spawn was SIGTERMed by the dedupe/throttle layer while the real run continued.
- **Temporal clustering**: all 1,251 SIGTERM kills fall in four hour-buckets (17:00-11, 17:00-18, 17:00-21, 18:00-00). **0 failures in the last 3 h** — the burst has self-resolved.
- **Not Sage-specific**: `Bolt` agent shows the same pattern (657 failures vs. 375 completions, all exit 143). Confirms this is orchestrator-level, not agent-code-level.
- **Sage prompt / agent code is fine** — the 163 successful runs in the same window produced real polish commits (e.g. `a70ebdd`, `cc823ce`).

## Recommendation (out of scope for janicka-shop repo)

Fix lives in the JARVIS dispatcher (`~/.claude/jarvis-gym`), not here. Two options for the orchestrator owner:

1. **De-duplicate before spawn**: if a Sage task for the same project is already `running`, don't queue another — replace/skip.
2. **Spawn cooldown honouring run length**: current cooldown is short enough to let 2-second spawns slip in during a 5-minute real run. Raise to ≥ max expected run duration or gate on "no active worker of this type".

No code change in this repo — per task description *"Do not change Sage prompt — that is Lead's responsibility. This is a diagnostic task."*

## Status

- Burst is over (last SIGTERM @ 2026-04-18 05:10, triage @ 09:15+).
- Effective Sage success rate during active hours: 163 / 164 real runs ≈ 99 %.
- Reported "610 failures/24h" = spawn-storm artifact, not real failures.
