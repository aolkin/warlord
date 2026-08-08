import { describe, expect, it } from "vitest"
import { ActiveStrike, combineStrikes } from "./strike"

describe("combineStrikes", () => {
  it("sums dice and toHit across two strike adjustments", () => {
    expect(combineStrikes({ toHit: 3, dice: 2 }, { toHit: 0, dice: 2 })).toEqual({ toHit: 3, dice: 4 })
  })

  it("clamps a combined toHit above 6 down to 6, since no die roll could ever hit a higher number", () => {
    // Strike-number 6 is the highest value on the rulebook's Strike Chart (29.) for the
    // skill factors creatures actually have (2-4); a raw Strike-number of 6 (e.g. attacker
    // skill 2 vs defender skill 4) combined with the Bramble non-native striking-out penalty
    // (+1, Hazard Chart 27.) would need a 7 to hit, which a d6 can never roll.
    expect(combineStrikes({ toHit: 6, dice: 0 }, { toHit: 1, dice: 0 })).toEqual({ toHit: 6, dice: 0 })
  })

  it("skips clamping when clampVal is explicitly false", () => {
    // engine.ts's strikeAdjustment() passes false here to combine two hazard deltas before
    // either is added to the base toHit, so an intermediate delta outside [2, 6] must survive
    // uncapped rather than being clamped twice.
    expect(combineStrikes({ toHit: -3, dice: 0 }, { toHit: 0, dice: 0 }, false)).toEqual({ toHit: -3, dice: 0 })
    expect(combineStrikes({ toHit: -3, dice: 0 }, { toHit: 0, dice: 0 })).toEqual({ toHit: 2, dice: 0 })
  })
})

describe("ActiveStrike", () => {
  it("normalizes a single-target strike into the targets/targetHits array shape", () => {
    const strike = new ActiveStrike({
      attacker: 8, rolls: [6, 6, 6, 6, 6], toHit: 4, totalHits: 5, rangestrike: false,
      target: 7, hits: 3
    })
    expect(strike.targets).toEqual([7])
    expect(strike.targetHits).toEqual([3])
    expect(strike.target).toBe(7)
    expect(strike.carryoverSkipped).toBe(false)
  })

  it("sums hits across all assigned targets when computing leftover carryover hits", () => {
    const strike = new ActiveStrike({
      attacker: 8, targets: [7, 9], targetHits: [3, 1], rolls: [6, 6, 6, 6, 6],
      toHit: 4, totalHits: 5, carryoverSkipped: false, rangestrike: false
    })
    expect(strike.getCarryoverHits()).toBe(1) // 5 total hits - (3 + 1) already assigned
  })

  describe("canCarryover", () => {
    // Rule 12.4: a strike that overkills its target may carry the extra hits to another
    // engaged target. Rule 13.0: a Rangestrike may never carry over, regardless of overkill.
    const base = { attacker: 8, target: 7, rolls: [6, 6, 6, 6, 6], toHit: 4, totalHits: 5 }

    it("is true once a strike overkills its target and carryover hasn't been declined", () => {
      expect(new ActiveStrike({ ...base, hits: 3, rangestrike: false }).canCarryover).toBe(true)
    })

    it("is false for a rangestrike even with leftover hits", () => {
      expect(new ActiveStrike({ ...base, hits: 3, rangestrike: true }).canCarryover).toBe(false)
    })

    it("is false once carryover has been explicitly declined", () => {
      // Rule 12.4: "Carrying over points of damage is optional."
      const strike = new ActiveStrike({ ...base, hits: 3, rangestrike: false })
      strike.carryoverSkipped = true
      expect(strike.canCarryover).toBe(false)
    })

    it("is false when the strike didn't overkill its target, leaving nothing to carry", () => {
      expect(new ActiveStrike({ ...base, hits: 5, rangestrike: false }).canCarryover).toBe(false)
    })
  })
})
