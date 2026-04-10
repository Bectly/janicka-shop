# Bolt — Builder

## Current Task
**#110: SECURITY — Admin password change v nastavení**

## Progress Notes
Starting task. Files to modify:
- `src/app/(admin)/admin/settings/actions.ts` — add `updateAdminPassword` Server Action
- `src/app/(admin)/admin/settings/settings-form.tsx` — add password change section
- `src/app/(admin)/admin/settings/page.tsx` — add second card for password form

Requirements:
1. Verify current password via `bcrypt.compare`
2. Validate new password: min 8 chars, must match confirmation
3. Hash new password: `bcrypt.hash(newPw, 12)`
4. Update via `prisma.admin.update`
5. Zod validation schema
6. Rate-limit the action
7. Show success/error feedback

## Blockers
_none_

## Next Planned
Implement and commit #110

## History (last 5 tasks)
- C3011: #89 Lightbox black screen fix — DONE
- C2534: Delivery deadline tracking (Czech law) — DONE
- C2518: Packeta SOAP full stack — DONE
- C2513 area: Various fixes
