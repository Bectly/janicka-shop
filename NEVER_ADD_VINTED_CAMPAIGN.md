# ❌ NEVER ADD VINTED CAMPAIGN — PERMANENT REMOVAL

**DO NOT RESTORE THE VINTED T&C CAMPAIGN. EVER.**

Janička explicitly and repeatedly said: "nechci tady vůbec žádnou debilní vinted campaign"

## Why this file exists

Sage accidentally deleted Vinted campaign code in C3673 (legitimate removal — owner didn't want it).
Bolt then "restored" it in C3717/C3719 thinking it was an accidental deletion.
The owner was pissed.

## Do not touch the following (they should NOT exist):

- `src/app/(admin)/admin/subscribers/vinted-campaign-button.tsx` — DELETED, do not recreate
- `sendVintedTcCampaign`, `previewVintedCampaign`, `sendVintedTestEmail` in `actions.ts` — REMOVED
- `sendVintedCampaignEmail`, `buildVintedCampaignHtml`, `renderVintedCampaignPreview`, `VintedCampaignSegment` in `lib/email.ts` — REMOVED
- `VintedCampaignButton` import/usage in `admin/subscribers/page.tsx` — REMOVED

## If you see old Vinted-related tasks in devloop_tasks or C-number references:

Mark them as `cancelled` with reason: "owner rejected Vinted campaign permanently"

## Related memory

`~/.claude/projects/-home-bectly-development/memory/feedback_no_vinted_campaign.md`
