import { describe, expect, it } from "vitest"
import { ActiveStrike, Strike } from "./strike"

describe("Strike.combine", () => {
  it("sums dice and toHit across two strike adjustments", () => {
    expect(Strike.combine({ toHit: 3, dice: 2 }, { toHit: 0, dice: 2 })).toEqual({ toHit: 3, dice: 4 })
  })

  it("clamps a combined toHit above 6 down to 6, since no die roll could ever hit a higher number", () => {
    // Strike-number 6 is the highest value on the rulebook's Strike Chart (29.) for the
    // skill factors creatures actually have (2-4); a raw Strike-number of 6 (e.g. attacker
    // skill 2 vs defender skill 4) combined with the Bramble non-native striking-out penalty
    // (+1, Hazard Chart 27.) would need a 7 to hit, which a d6 can never roll.
    expect(Strike.combine({ toHit: 6, dice: 0 }, { toHit: 1, dice: 0 })).toEqual({ toHit: 6, dice: 0 })
  })

  it("skips clamping when clampVal is explicitly false", () => {
    // engine.ts's strikeAdjustment() passes false here to combine two hazard deltas before
    // either is added to the base toHit, so an intermediate delta outside [2, 6] must survive
    // uncapped rather than being clamped twice.
    expect(Strike.combine({ toHit: -3, dice: 0 }, { toHit: 0, dice: 0 }, false)).toEqual({ toHit: -3, dice: 0 })
    expect(Strike.combine({ toHit: -3, dice: 0 }, { toHit: 0, dice: 0 })).toEqual({ toHit: 2, dice: 0 })
  })
})

describe("ActiveStrike", () => {
  it("creates a melee strike with the primary target and no carryover yet", () => {
    const strike = ActiveStrike.create({
      attacker: 8,
      rolls: [6, 6, 6, 6, 6],
      toHit: 4,
      rangestrike: false,
      target: 7,
      defenderRemainingHp: 3,
    })
    expect(strike.target).toBe(7)
    expect(strike.targetHits).toEqual([3])
    expect(ActiveStrike.isRangestrike(strike)).toBe(false)
    expect(strike).toMatchObject({ carryoverTargets: [], carryoverSkipped: false })
  })

  it("creates a rangestrike strike with no carryover-related fields", () => {
    const strike = ActiveStrike.create({
      attacker: 8,
      rolls: [6, 6],
      toHit: 4,
      rangestrike: true,
      target: 7,
      defenderRemainingHp: 2,
    })
    expect(strike.target).toBe(7)
    expect(strike.targetHits).toEqual([2])
    expect(ActiveStrike.isRangestrike(strike)).toBe(true)
  })

  it("sums hits across the primary target and carryover targets when computing leftover carryover hits", () => {
    const strike: ActiveStrike = {
      attacker: 8,
      target: 7,
      targetHits: [3, 1],
      carryoverTargets: [9],
      rolls: [6, 6, 6, 6, 6],
      toHit: 4,
      totalHits: 5,
      carryoverSkipped: false,
    }
    expect(ActiveStrike.getCarryoverHits(strike)).toBe(1) // 5 total hits - (3 + 1) already assigned
  })

  describe("targets", () => {
    it("returns the primary target and each carryover target with its hits for a melee strike", () => {
      const strike: ActiveStrike = {
        attacker: 8,
        target: 7,
        targetHits: [3, 1, 1],
        carryoverTargets: [9, 11],
        rolls: [6, 6, 6, 6, 6],
        toHit: 4,
        totalHits: 5,
        carryoverSkipped: false,
      }
      expect(ActiveStrike.targets(strike)).toEqual([
        [7, 3],
        [9, 1],
        [11, 1],
      ])
    })

    it("returns only the primary target for a rangestrike, since it can never carry over", () => {
      const strike = ActiveStrike.create({
        attacker: 8,
        rolls: [6, 6],
        toHit: 4,
        rangestrike: true,
        target: 7,
        defenderRemainingHp: 2,
      })
      expect(ActiveStrike.targets(strike)).toEqual([[7, 2]])
    })
  })

  describe("getCarryoverHits eligibility", () => {
    // Rule 12.4: a strike that overkills its target may carry the extra hits to another
    // engaged target. A Rangestrike can never carry over, regardless of overkill (rulebook
    // section 13, Rangestriking).
    const base = { attacker: 8, target: 7, rolls: [6, 6, 6, 6, 6], toHit: 4 }

    it("is positive once a strike overkills its target and carryover hasn't been declined", () => {
      expect(
        ActiveStrike.getCarryoverHits(ActiveStrike.create({ ...base, defenderRemainingHp: 3, rangestrike: false })),
      ).toBe(2)
    })

    it("is zero for a rangestrike even with leftover hits", () => {
      expect(
        ActiveStrike.getCarryoverHits(ActiveStrike.create({ ...base, defenderRemainingHp: 3, rangestrike: true })),
      ).toBe(0)
    })

    it("is zero once carryover has been explicitly declined", () => {
      // Rule 12.4: "Carrying over points of damage is optional."
      const strike = ActiveStrike.create({ ...base, defenderRemainingHp: 3, rangestrike: false })
      if (ActiveStrike.isRangestrike(strike)) {
        throw new Error("expected a melee strike")
      }
      strike.carryoverSkipped = true
      expect(ActiveStrike.getCarryoverHits(strike)).toBe(0)
    })

    it("is zero when the strike didn't overkill its target, leaving nothing to carry", () => {
      expect(
        ActiveStrike.getCarryoverHits(ActiveStrike.create({ ...base, defenderRemainingHp: 5, rangestrike: false })),
      ).toBe(0)
    })
  })
})
