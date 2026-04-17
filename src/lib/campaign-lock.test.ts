import { strict as assert } from "node:assert";
import { getConflictingCampaignKeys, claimCampaignSendLock, releaseCampaignSendLock } from "./campaign-lock";
import { getDb } from "@/lib/db";

// ─── Part 1: Pure overlap matrix (no DB) ─────────────────────────────────────
// Run with: npx tsx src/lib/campaign-lock.test.ts
// Vinted segments: warm ⊂ all, cold ⊂ all, warm ∩ cold = ∅.

assert.deepEqual(getConflictingCampaignKeys("vinted:all").sort(), ["vinted:cold", "vinted:warm"]);
assert.deepEqual(getConflictingCampaignKeys("vinted:warm"), ["vinted:all"]);
assert.deepEqual(getConflictingCampaignKeys("vinted:cold"), ["vinted:all"]);

// Non-overlapping keys never conflict.
assert.deepEqual(getConflictingCampaignKeys("mothers-day:1"), []);
assert.deepEqual(getConflictingCampaignKeys("mothers-day:2"), []);
assert.deepEqual(getConflictingCampaignKeys("customs:1"), []);
assert.deepEqual(getConflictingCampaignKeys("customs:2"), []);
assert.deepEqual(getConflictingCampaignKeys("unknown"), []);

// Symmetry invariant: if A conflicts with B, B must conflict with A.
const keys = ["vinted:all", "vinted:warm", "vinted:cold", "mothers-day:1", "customs:1"];
for (const a of keys) {
  for (const b of getConflictingCampaignKeys(a)) {
    assert.ok(
      getConflictingCampaignKeys(b).includes(a),
      `asymmetric overlap: ${a} → ${b} but not reverse`,
    );
  }
}

// Exhaustive cross-segment pairs: warm ↔ all, cold ↔ all, warm ↔ cold (disjoint).
assert.ok(getConflictingCampaignKeys("vinted:warm").includes("vinted:all"), "warm must conflict all");
assert.ok(getConflictingCampaignKeys("vinted:cold").includes("vinted:all"), "cold must conflict all");
assert.ok(!getConflictingCampaignKeys("vinted:warm").includes("vinted:cold"), "warm must NOT conflict cold");
assert.ok(!getConflictingCampaignKeys("vinted:cold").includes("vinted:warm"), "cold must NOT conflict warm");

console.log("✓ Part 1 — overlap matrix: OK");

// ─── Part 2: DB-backed lock claim scenarios ───────────────────────────────────

async function cleanup(...campaignKeys: string[]): Promise<void> {
  const db = await getDb();
  await db.campaignSendLock.deleteMany({ where: { campaignKey: { in: campaignKeys } } });
}

async function runDbTests(): Promise<void> {
  const ALL_VINTED_KEYS = ["vinted:all", "vinted:warm", "vinted:cold"];

  // ── Scenario 1: vinted:all blocked by active vinted:warm lock ──────────────
  await cleanup(...ALL_VINTED_KEYS);
  const warmClaim = await claimCampaignSendLock("vinted:warm");
  assert.equal(warmClaim.success, true, "S1: should be able to claim vinted:warm");

  const allBlockedByWarm = await claimCampaignSendLock("vinted:all");
  assert.equal(allBlockedByWarm.success, false, "S1: vinted:all must be rejected when vinted:warm is locked");
  assert.ok(allBlockedByWarm.error?.includes("vinted:warm"), "S1: error must name the conflicting key");
  assert.ok(allBlockedByWarm.error?.includes("Překrývající se"), "S1: error must use CZ cross-segment text");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 1 — vinted:all blocked by vinted:warm: PASS");

  // ── Scenario 2: vinted:warm blocked by active vinted:all lock ─────────────
  await cleanup(...ALL_VINTED_KEYS);
  const allClaim = await claimCampaignSendLock("vinted:all");
  assert.equal(allClaim.success, true, "S2: should be able to claim vinted:all");

  const warmBlockedByAll = await claimCampaignSendLock("vinted:warm");
  assert.equal(warmBlockedByAll.success, false, "S2: vinted:warm must be rejected when vinted:all is locked");
  assert.ok(warmBlockedByAll.error?.includes("vinted:all"), "S2: error must name the conflicting key");

  const coldBlockedByAll = await claimCampaignSendLock("vinted:cold");
  assert.equal(coldBlockedByAll.success, false, "S2: vinted:cold must also be rejected when vinted:all is locked");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 2 — vinted:warm + vinted:cold blocked by vinted:all: PASS");

  // ── Scenario 3: vinted:cold + vinted:warm non-overlapping — both succeed ───
  await cleanup(...ALL_VINTED_KEYS);
  const coldFirst = await claimCampaignSendLock("vinted:cold");
  assert.equal(coldFirst.success, true, "S3: vinted:cold should succeed initially");

  const warmWhileColdLocked = await claimCampaignSendLock("vinted:warm");
  assert.equal(warmWhileColdLocked.success, true, "S3: vinted:warm must succeed even when vinted:cold is locked (disjoint segments)");

  // Both locks should now exist simultaneously.
  const db = await getDb();
  const locks = await db.campaignSendLock.findMany({ where: { campaignKey: { in: ALL_VINTED_KEYS } } });
  const lockKeys = locks.map((l) => l.campaignKey).sort();
  assert.deepEqual(lockKeys, ["vinted:cold", "vinted:warm"], "S3: both cold and warm locks must coexist");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 3 — vinted:cold + vinted:warm coexist (disjoint): PASS");

  // ── Scenario 4: exact same key is rejected (idempotency guard) ────────────
  await cleanup(...ALL_VINTED_KEYS);
  const firstClaim = await claimCampaignSendLock("vinted:all");
  assert.equal(firstClaim.success, true, "S4: first claim of vinted:all should succeed");

  const duplicateClaim = await claimCampaignSendLock("vinted:all");
  assert.equal(duplicateClaim.success, false, "S4: duplicate claim of same key must be rejected");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 4 — exact-key duplicate rejected: PASS");

  // ── Scenario 5: expired lock is swept — fresh claim succeeds ──────────────
  await cleanup(...ALL_VINTED_KEYS);
  // Insert an already-expired lock manually.
  await db.campaignSendLock.create({
    data: {
      campaignKey: "vinted:warm",
      claimedAt: new Date(Date.now() - 7200_000),
      expiresAt: new Date(Date.now() - 3600_000), // expired 1h ago
    },
  });
  const claimAfterExpiry = await claimCampaignSendLock("vinted:all");
  assert.equal(claimAfterExpiry.success, true, "S5: expired vinted:warm lock must not block vinted:all");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 5 — expired cross-segment lock swept, fresh claim succeeds: PASS");

  // ── Scenario 6: releaseCampaignSendLock unblocks the key ──────────────────
  await cleanup(...ALL_VINTED_KEYS);
  const lockedWarm = await claimCampaignSendLock("vinted:warm");
  assert.equal(lockedWarm.success, true, "S6 setup: warm should lock");
  const blockedBefore = await claimCampaignSendLock("vinted:all");
  assert.equal(blockedBefore.success, false, "S6: vinted:all blocked while warm locked");

  await releaseCampaignSendLock("vinted:warm");
  const unblockedAfter = await claimCampaignSendLock("vinted:all");
  assert.equal(unblockedAfter.success, true, "S6: vinted:all succeeds after warm lock released");
  await cleanup(...ALL_VINTED_KEYS);
  console.log("✓ Scenario 6 — releaseCampaignSendLock unblocks downstream: PASS");
}

// ─── Part 3: UI canSendAll logic (static audit) ───────────────────────────────
// Mirrors campaign-dry-run-dialog.tsx lines 189-193.
function simulateCanSendAll({
  testSentSuccess,
  confirmation,
  confirmationWord,
  resultType,
  activeLocksCount,
}: {
  testSentSuccess: boolean;
  confirmation: string;
  confirmationWord: string;
  resultType: "success" | "error" | null;
  activeLocksCount: number;
}): boolean {
  return (
    testSentSuccess &&
    confirmation === confirmationWord &&
    resultType !== "success" &&
    activeLocksCount === 0
  );
}

// canSendAll must be false when any lock is active.
assert.equal(
  simulateCanSendAll({ testSentSuccess: true, confirmation: "ODESLAT VINTED", confirmationWord: "ODESLAT VINTED", resultType: null, activeLocksCount: 1 }),
  false,
  "UI: canSendAll must be false with 1 active lock",
);
assert.equal(
  simulateCanSendAll({ testSentSuccess: true, confirmation: "ODESLAT VINTED", confirmationWord: "ODESLAT VINTED", resultType: null, activeLocksCount: 2 }),
  false,
  "UI: canSendAll must be false with 2 active locks (cross-segment)",
);
// canSendAll is true only when all conditions met + zero locks.
assert.equal(
  simulateCanSendAll({ testSentSuccess: true, confirmation: "ODESLAT VINTED", confirmationWord: "ODESLAT VINTED", resultType: null, activeLocksCount: 0 }),
  true,
  "UI: canSendAll must be true with all conditions met and zero locks",
);
// canSendAll must be false if test not sent.
assert.equal(
  simulateCanSendAll({ testSentSuccess: false, confirmation: "ODESLAT VINTED", confirmationWord: "ODESLAT VINTED", resultType: null, activeLocksCount: 0 }),
  false,
  "UI: canSendAll must be false without successful test send",
);
console.log("✓ Part 3 — UI canSendAll logic: OK");

// ─── Part 4: UI cross-segment ↔ lock labelling (static audit) ─────────────────
// Mirrors campaign-dry-run-dialog.tsx exactLocks/crossLocks classification.
function classifyLocks(
  activeLocks: { campaignKey: string }[],
  campaignFamily: string,
  segment: string,
): { exactLocks: { campaignKey: string }[]; crossLocks: { campaignKey: string }[] } {
  const exactLocks = activeLocks.filter(
    (l) => !segment || !campaignFamily || l.campaignKey === `${campaignFamily}:${segment}`,
  );
  const crossLocks = activeLocks.filter((l) => !exactLocks.includes(l));
  return { exactLocks, crossLocks };
}

// When sending vinted:warm and vinted:all is locked → vinted:all shown as cross-segment (↔).
{
  const { exactLocks, crossLocks } = classifyLocks(
    [{ campaignKey: "vinted:all" }],
    "vinted",
    "warm",
  );
  assert.equal(exactLocks.length, 0, "UI classify: vinted:all is NOT exact when sending warm");
  assert.equal(crossLocks.length, 1, "UI classify: vinted:all IS a cross lock when sending warm");
  assert.equal(crossLocks[0].campaignKey, "vinted:all", "UI classify: correct cross lock key");
}

// When sending vinted:all and vinted:warm is locked → vinted:warm shown as cross-segment.
{
  const { exactLocks, crossLocks } = classifyLocks(
    [{ campaignKey: "vinted:warm" }],
    "vinted",
    "all",
  );
  assert.equal(exactLocks.length, 0, "UI classify: vinted:warm is NOT exact when sending all");
  assert.equal(crossLocks.length, 1, "UI classify: vinted:warm IS a cross lock when sending all");
}

// When sending vinted:warm and vinted:warm is locked (exact same key).
{
  const { exactLocks, crossLocks } = classifyLocks(
    [{ campaignKey: "vinted:warm" }],
    "vinted",
    "warm",
  );
  assert.equal(exactLocks.length, 1, "UI classify: same key is exact lock");
  assert.equal(crossLocks.length, 0, "UI classify: no cross locks for same key");
}

console.log("✓ Part 4 — UI ↔ cross-segment lock classification: OK");

// ─── Run DB tests ─────────────────────────────────────────────────────────────
runDbTests()
  .then(() => {
    console.log("\n✅ All scenarios PASS — Vinted cross-segment lock isolation verified");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ FAIL:", err.message ?? err);
    process.exit(1);
  });
