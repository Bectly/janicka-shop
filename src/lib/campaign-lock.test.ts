import { describe, it, expect } from "vitest";
import { getConflictingCampaignKeys } from "./campaign-lock";

// Pure overlap matrix — no DB.
// Vinted segments: warm ⊂ all, cold ⊂ all, warm ∩ cold = ∅.
describe("getConflictingCampaignKeys — Vinted cross-segment overlap", () => {
  it("vinted:all conflicts with both warm and cold", () => {
    expect(getConflictingCampaignKeys("vinted:all").sort()).toEqual([
      "vinted:cold",
      "vinted:warm",
    ]);
  });

  it("vinted:warm conflicts with vinted:all only", () => {
    expect(getConflictingCampaignKeys("vinted:warm")).toEqual(["vinted:all"]);
  });

  it("vinted:cold conflicts with vinted:all only", () => {
    expect(getConflictingCampaignKeys("vinted:cold")).toEqual(["vinted:all"]);
  });

  it("non-overlapping keys never conflict", () => {
    expect(getConflictingCampaignKeys("mothers-day:1")).toEqual([]);
    expect(getConflictingCampaignKeys("mothers-day:2")).toEqual([]);
    expect(getConflictingCampaignKeys("customs:1")).toEqual([]);
    expect(getConflictingCampaignKeys("customs:2")).toEqual([]);
    expect(getConflictingCampaignKeys("unknown")).toEqual([]);
  });

  it("is symmetric: if A conflicts with B, B conflicts with A", () => {
    const keys = ["vinted:all", "vinted:warm", "vinted:cold", "mothers-day:1", "customs:1"];
    for (const a of keys) {
      for (const b of getConflictingCampaignKeys(a)) {
        expect(getConflictingCampaignKeys(b)).toContain(a);
      }
    }
  });

  it("warm and cold are disjoint (never conflict with each other)", () => {
    expect(getConflictingCampaignKeys("vinted:warm")).not.toContain("vinted:cold");
    expect(getConflictingCampaignKeys("vinted:cold")).not.toContain("vinted:warm");
  });
});

// Mirrors campaign-dry-run-dialog.tsx canSendAll gate (lines 189-193).
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

describe("UI canSendAll gate — campaign dry-run dialog", () => {
  const base = {
    testSentSuccess: true,
    confirmation: "ODESLAT VINTED",
    confirmationWord: "ODESLAT VINTED",
    resultType: null as "success" | "error" | null,
  };

  it("is false when any lock is active", () => {
    expect(simulateCanSendAll({ ...base, activeLocksCount: 1 })).toBe(false);
    expect(simulateCanSendAll({ ...base, activeLocksCount: 2 })).toBe(false);
  });

  it("is true only when all conditions met and zero locks", () => {
    expect(simulateCanSendAll({ ...base, activeLocksCount: 0 })).toBe(true);
  });

  it("is false when test send failed", () => {
    expect(
      simulateCanSendAll({ ...base, testSentSuccess: false, activeLocksCount: 0 }),
    ).toBe(false);
  });
});

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

describe("UI lock classification — exact vs cross-segment", () => {
  it("when sending vinted:warm and vinted:all is locked, vinted:all is a cross lock", () => {
    const { exactLocks, crossLocks } = classifyLocks(
      [{ campaignKey: "vinted:all" }],
      "vinted",
      "warm",
    );
    expect(exactLocks).toHaveLength(0);
    expect(crossLocks).toHaveLength(1);
    expect(crossLocks[0].campaignKey).toBe("vinted:all");
  });

  it("when sending vinted:all and vinted:warm is locked, vinted:warm is a cross lock", () => {
    const { exactLocks, crossLocks } = classifyLocks(
      [{ campaignKey: "vinted:warm" }],
      "vinted",
      "all",
    );
    expect(exactLocks).toHaveLength(0);
    expect(crossLocks).toHaveLength(1);
  });

  it("same key is an exact lock, not a cross lock", () => {
    const { exactLocks, crossLocks } = classifyLocks(
      [{ campaignKey: "vinted:warm" }],
      "vinted",
      "warm",
    );
    expect(exactLocks).toHaveLength(1);
    expect(crossLocks).toHaveLength(0);
  });
});
