import { describe, it, expect } from "vitest"
import { finalizeSplit, muster, Stack, MusterBasis, setPendingSplit } from "./stack"
import { CreatureType } from "./creature"
import { Terrain } from "./masterboard"
import { PlayerId } from "./player"

describe("Stack splitting", () => {
  it("rejects a first-round split unless exactly 4 creatures split off with exactly one lord", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    // Default 8: [TITAN, ANGEL, CENTAUR, CENTAUR, OGRE, OGRE, GARGOYLE, GARGOYLE]
    expect(stack.isValidSplit(true)).toBe(false) // nothing marked yet

    setPendingSplit(stack, 0, true) // TITAN
    setPendingSplit(stack, 2, true) // CENTAUR
    setPendingSplit(stack, 4, true) // OGRE
    expect(stack.isValidSplit(true)).toBe(false) // only 3 marked

    setPendingSplit(stack, 1, true) // ANGEL - now 4 marked but 2 lords (TITAN + ANGEL)
    expect(stack.isValidSplit(true)).toBe(false)

    setPendingSplit(stack, 1, false)
    setPendingSplit(stack, 6, true) // GARGOYLE - back to 4 marked, 1 lord (TITAN)
    expect(stack.isValidSplit(true)).toBe(true)
  })

  it("allows splitting off zero, or two-or-more leaving at least two behind, in later rounds", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    expect(stack.isValidSplit()).toBe(true) // no pending split is always valid outside round 1

    setPendingSplit(stack, 0, true)
    expect(stack.isValidSplit()).toBe(false) // splitting exactly 1 creature is never valid

    setPendingSplit(stack, 1, true)
    expect(stack.isValidSplit()).toBe(true) // 2 splitting, 6 remaining

    // Splitting off 6 of 8 would leave only 2 behind, which is still valid...
    for (let i = 2; i < 6; i++) setPendingSplit(stack, i, true)
    expect(stack.numSplitting()).toBe(6)
    expect(stack.isValidSplit()).toBe(true)

    // ...but leaving fewer than 2 behind is not.
    setPendingSplit(stack, 6, true)
    expect(stack.numSplitting()).toBe(7)
    expect(stack.isValidSplit()).toBe(false)
  })

  it("finalizes a split into a new stack sharing the same hex but a new marker", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    setPendingSplit(stack, 0, true)
    setPendingSplit(stack, 2, true)
    setPendingSplit(stack, 4, true)
    setPendingSplit(stack, 6, true)
    const splitOff = stack.getCreaturesSplit(true)

    const newStack = finalizeSplit(stack, 1)

    expect(newStack.owner).toBe(PlayerId.RED)
    expect(newStack.hex).toBe(5)
    expect(newStack.origin).toBe(5)
    expect(newStack.marker).toBe(1)
    expect(newStack.creatures).toEqual(splitOff)
    expect(stack.creatures.length).toBe(4)
    expect(stack.creatures).toEqual(stack.getCreaturesSplit(false))
    // The pending split markers are cleared after finalizing.
    expect(stack.numSplitting()).toBe(0)
  })

  it("refuses to finalize an invalid split", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    setPendingSplit(stack, 0, true) // only 1 marked, never valid
    expect(() => finalizeSplit(stack, 1)).toThrow()
  })
})

describe("Stack mustering eligibility", () => {
  it.each([
    { label: "before moving", moved: false, creatureCount: 1, expected: false },
    { label: "at the 7-creature cap", moved: true, creatureCount: 7, expected: false },
    { label: "moved and under the cap", moved: true, creatureCount: 1, expected: true }
  ])("canMuster() is $expected when $label", ({ moved, creatureCount, expected }) => {
    const stack = new Stack(PlayerId.RED, 5, 0, new Array(creatureCount).fill(CreatureType.CENTAUR))
    if (moved) stack.hex = 6

    expect(stack.canMuster()).toBe(expected)
  })

  it("adds a mustered creature to the stack", () => {
    const stack = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR])
    muster(stack, CreatureType.LION)
    expect(stack.creatures).toEqual([CreatureType.CENTAUR, CreatureType.LION])
  })
})

describe("Stack musterable (recruit-tier constraints)", () => {
  it.each([
    { centaurCount: 1, lionBases: [] as MusterBasis[] }, // needs 2 Centaurs, only have 1
    { centaurCount: 2, lionBases: [[CreatureType.CENTAUR, 2]] as MusterBasis[] }
  ])("unlocks the Lion muster tier only once 2 Centaurs are present ($centaurCount Centaur(s))", ({
    centaurCount, lionBases
  }) => {
    const stack = new Stack(PlayerId.RED, 5, 0, new Array(centaurCount).fill(CreatureType.CENTAUR))
    const possibilities = stack.musterable(Terrain.PLAINS)

    const [, centaurBases] = possibilities.find(([type]) => type === CreatureType.CENTAUR)!
    expect(centaurBases).toEqual([[CreatureType.CENTAUR, 1]])

    const [, actualLionBases] = possibilities.find(([type]) => type === CreatureType.LION)!
    expect(actualLionBases).toEqual(lionBases)
  })

  it("still locks the Ranger tier behind Lions specifically, even once Centaurs unlock the Lion tier", () => {
    // Ranger requires 2 Lions specifically, not 2 Centaurs, so it stays locked even with
    // enough Centaurs to unlock Lion.
    const stack = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR, CreatureType.CENTAUR])
    const [, rangerBases] = stack.musterable(Terrain.PLAINS).find(([type]) => type === CreatureType.RANGER)!
    expect(rangerBases).toEqual([])
  })

  it("always offers the tower's basic recruits regardless of stack contents", () => {
    const stack = new Stack(PlayerId.RED, 100, 0, [CreatureType.CENTAUR])
    const possibilities = stack.musterable(Terrain.TOWER)

    for (const type of [CreatureType.CENTAUR, CreatureType.OGRE, CreatureType.GARGOYLE]) {
      const [, bases] = possibilities.find(([t]) => t === type)!
      expect(bases).toEqual([[type, 0]])
    }
  })

  it("only offers a Guardian once 3 of any one creature type are present", () => {
    const shortOfThree = new Stack(PlayerId.RED, 100, 0, [CreatureType.CENTAUR, CreatureType.CENTAUR])
    const [, noGuardian] = shortOfThree.musterable(Terrain.TOWER).find(([t]) => t === CreatureType.GUARDIAN)!
    expect(noGuardian).toEqual([])

    const threeOfAKind = new Stack(PlayerId.RED, 100, 0,
      [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR])
    const [, guardianBases] = threeOfAKind.musterable(Terrain.TOWER).find(([t]) => t === CreatureType.GUARDIAN)!
    expect(guardianBases).toEqual([[CreatureType.CENTAUR, 3]])
  })

  it("only offers a Warlock when a Titan is present", () => {
    const noTitan = new Stack(PlayerId.RED, 100, 0, [CreatureType.CENTAUR])
    const [, noWarlock] = noTitan.musterable(Terrain.TOWER).find(([t]) => t === CreatureType.WARLOCK)!
    expect(noWarlock).toEqual([])

    const withTitan = new Stack(PlayerId.RED, 100, 0, [CreatureType.TITAN])
    const [, warlockBases] = withTitan.musterable(Terrain.TOWER).find(([t]) => t === CreatureType.WARLOCK)!
    expect(warlockBases).toEqual([[CreatureType.TITAN, 1]])
  })
})
