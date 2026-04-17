import { strict as assert } from "node:assert";
import { getConflictingCampaignKeys } from "./campaign-lock";

// Overlap matrix — run with: npx tsx src/lib/campaign-lock.test.ts
// Vinted segments: warm ⊂ all, cold ⊂ all, warm ∩ cold = ∅.
// Each row: holding the key on the left blocks the keys on the right.

assert.deepEqual(getConflictingCampaignKeys("vinted:all").sort(), ["vinted:cold", "vinted:warm"]);
assert.deepEqual(getConflictingCampaignKeys("vinted:warm"), ["vinted:all"]);
assert.deepEqual(getConflictingCampaignKeys("vinted:cold"), ["vinted:all"]);

// Non-overlapping keys: per-email-number campaigns never intersect.
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

console.log("campaign-lock overlap matrix: OK");
