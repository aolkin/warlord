import { describe, it, expect } from "vitest"
import { Stack } from "./stack"
import { CreatureType } from "./creature"
import { Terrain } from "./masterboard"
import { PlayerId } from "./player"

describe("Stack", () => {
  it("initializes with default creatures", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    expect(stack.creatures.length).toBe(8)
    expect(stack.creatures[0]).toBe(CreatureType.TITAN)
  })

  it("starts with origin equal to hex", () => {
    const stack = new Stack(PlayerId.BLUE, 10, 0)
    expect(stack.origin).toBe(10)
    expect(stack.hex).toBe(10)
    expect(stack.hasMoved()).toBe(false)
  })

  it("detects movement", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    stack.hex = 6
    expect(stack.hasMoved()).toBe(true)
  })
})

describe("Stack splitting", () => {
  it("rejects a first-round split unless exactly 4 creatures split off with exactly one lord", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    // Default 8: [TITAN, ANGEL, CENTAUR, CENTAUR, OGRE, OGRE, GARGOYLE, GARGOYLE]
    expect(stack.isValidSplit(true)).toBe(false) // nothing marked yet

    stack.setPendingSplit(0, true) // TITAN
    stack.setPendingSplit(2, true) // CENTAUR
    stack.setPendingSplit(4, true) // OGRE
    expect(stack.isValidSplit(true)).toBe(false) // only 3 marked

    stack.setPendingSplit(1, true) // ANGEL - now 4 marked but 2 lords (TITAN + ANGEL)
    expect(stack.isValidSplit(true)).toBe(false)

    stack.setPendingSplit(1, false)
    stack.setPendingSplit(6, true) // GARGOYLE - back to 4 marked, 1 lord (TITAN)
    expect(stack.isValidSplit(true)).toBe(true)
  })

  it("allows splitting off zero, or two-or-more leaving at least two behind, in later rounds", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    expect(stack.isValidSplit()).toBe(true) // no pending split is always valid outside round 1

    stack.setPendingSplit(0, true)
    expect(stack.isValidSplit()).toBe(false) // splitting exactly 1 creature is never valid

    stack.setPendingSplit(1, true)
    expect(stack.isValidSplit()).toBe(true) // 2 splitting, 6 remaining

    // Splitting off 6 of 8 would leave only 2 behind, which is still valid...
    for (let i = 2; i < 6; i++) stack.setPendingSplit(i, true)
    expect(stack.numSplitting()).toBe(6)
    expect(stack.isValidSplit()).toBe(true)

    // ...but leaving fewer than 2 behind is not.
    stack.setPendingSplit(6, true)
    expect(stack.numSplitting()).toBe(7)
    expect(stack.isValidSplit()).toBe(false)
  })

  it("finalizes a split into a new stack sharing the same hex but a new marker", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    stack.setPendingSplit(0, true)
    stack.setPendingSplit(2, true)
    stack.setPendingSplit(4, true)
    stack.setPendingSplit(6, true)
    const splitOff = stack.getCreaturesSplit(true)

    const newStack = stack.finalizeSplit(1)

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
    stack.setPendingSplit(0, true) // only 1 marked, never valid
    expect(() => stack.finalizeSplit(1)).toThrow()
  })
})

describe("Stack mustering eligibility", () => {
  it("cannot muster before moving", () => {
    const stack = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR])
    expect(stack.hasMoved()).toBe(false)
    expect(stack.canMuster()).toBe(false)
  })

  it("cannot muster once the stack is at its 7-creature cap", () => {
    const stack = new Stack(PlayerId.RED, 5, 0) // 8 creatures, over the cap
    stack.hex = 6
    expect(stack.hasMoved()).toBe(true)
    expect(stack.creatures.length).toBe(8)
    expect(stack.canMuster()).toBe(false)
  })

  it("can muster once moved and under the cap", () => {
    const stack = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR])
    stack.hex = 6
    expect(stack.canMuster()).toBe(true)
  })

  it("adds a mustered creature to the stack", () => {
    const stack = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR])
    stack.muster(CreatureType.LION)
    expect(stack.creatures).toEqual([CreatureType.CENTAUR, CreatureType.LION])
  })
})

describe("Stack musterable (recruit-tier constraints)", () => {
  it("only offers the base recruit until enough of it are present to advance a tier", () => {
    const oneCentaur = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR])
    const possibilities = oneCentaur.musterable(Terrain.PLAINS)

    const [, centaurBases] = possibilities.find(([type]) => type === CreatureType.CENTAUR)!
    expect(centaurBases).toEqual([[CreatureType.CENTAUR, 1]])

    const [, lionBases] = possibilities.find(([type]) => type === CreatureType.LION)!
    expect(lionBases).toEqual([]) // needs 2 Centaurs, only have 1

    const [, rangerBases] = possibilities.find(([type]) => type === CreatureType.RANGER)!
    expect(rangerBases).toEqual([]) // needs 2 Lions, have none
  })

  it("unlocks the next tier once enough of the prior tier's creature is present", () => {
    const twoCentaurs = new Stack(PlayerId.RED, 5, 0, [CreatureType.CENTAUR, CreatureType.CENTAUR])
    const possibilities = twoCentaurs.musterable(Terrain.PLAINS)

    const [, lionBases] = possibilities.find(([type]) => type === CreatureType.LION)!
    expect(lionBases).toEqual([[CreatureType.CENTAUR, 2]])

    // Ranger requires 2 Lions specifically, not 2 Centaurs, so it's still locked.
    const [, rangerBases] = possibilities.find(([type]) => type === CreatureType.RANGER)!
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
