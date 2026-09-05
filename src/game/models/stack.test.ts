import { describe, it, expect } from "vitest"
import { MusterBasis, Stack } from "./stack"
import { CreatureType } from "./creature"
import { Terrain } from "./masterboard"
import { PlayerId } from "./player"

describe("Stack splitting", () => {
  // Default 8 creatures: [TITAN, ANGEL, CENTAUR, CENTAUR, OGRE, OGRE, GARGOYLE, GARGOYLE]
  const newStack = (): Stack => Stack.create({ owner: PlayerId.RED, hex: 5, marker: 0, createdRound: 0 })

  it("rejects a first-round split unless exactly 4 creatures split off with exactly one lord", () => {
    const stack = newStack()
    expect(Stack.isValidSplit(stack, [], true)).toBe(false) // nothing selected yet
    expect(Stack.isValidSplit(stack, [0, 2, 4], true)).toBe(false) // only 3 selected
    expect(Stack.isValidSplit(stack, [0, 1, 2, 4], true)).toBe(false) // 4 selected but 2 lords (TITAN + ANGEL)
    expect(Stack.isValidSplit(stack, [0, 2, 4, 6], true)).toBe(true) // 4 selected, 1 lord (TITAN)
  })

  it("allows splitting off zero, or two-or-more leaving at least two behind, in later rounds", () => {
    const stack = newStack()
    expect(Stack.isValidSplit(stack, [])).toBe(true) // selecting nothing is always valid outside round 1
    expect(Stack.isValidSplit(stack, [0])).toBe(false) // splitting exactly 1 creature is never valid
    expect(Stack.isValidSplit(stack, [0, 1])).toBe(true) // 2 splitting, 6 remaining
    // Splitting off 6 of 8 leaves 2 behind, which is still valid...
    expect(Stack.isValidSplit(stack, [0, 1, 2, 3, 4, 5])).toBe(true)
    // ...but leaving fewer than 2 behind is not.
    expect(Stack.isValidSplit(stack, [0, 1, 2, 3, 4, 5, 6])).toBe(false)
  })

  it("finalizes a split into a new stack sharing the same hex but a new marker", () => {
    const stack = newStack()
    const splitting = [0, 2, 4, 6]
    const splitOff = Stack.getSplittingCreatures(stack, splitting)
    const staying = Stack.getStayingCreatures(stack, splitting)

    const splitStack = Stack.finalizeSplit(stack, splitting, 1, 0)

    expect(splitStack.owner).toBe(PlayerId.RED)
    expect(splitStack.hex).toBe(5)
    expect(splitStack.initialHex).toBe(5)
    expect(splitStack.marker).toBe(1)
    expect(splitStack.creatures).toEqual(splitOff)
    expect(stack.creatures).toEqual(staying)
  })

  it("refuses to finalize an invalid split", () => {
    expect(() => Stack.finalizeSplit(newStack(), [0], 1, 0)).toThrow()
  })

  it("recombines a split-off stack's creatures back into the original", () => {
    const stack = newStack()
    const originalCreatures = [...stack.creatures]
    const splitStack = Stack.finalizeSplit(stack, [0, 2, 4, 6], 1, 0)

    Stack.recombine(stack, splitStack)

    expect(stack.creatures).toHaveLength(originalCreatures.length)
    expect(stack.creatures).toEqual(expect.arrayContaining(originalCreatures))
  })
})

describe("Stack mustering eligibility", () => {
  it.each([
    { label: "before moving", moved: false, creatureCount: 1, expected: false },
    { label: "at the 7-creature cap", moved: true, creatureCount: 7, expected: false },
    { label: "moved and under the cap", moved: true, creatureCount: 1, expected: true },
  ])("canMuster() is $expected when $label", ({ moved, creatureCount, expected }) => {
    const stack = Stack.create({
      owner: PlayerId.RED,
      hex: 5,
      marker: 0,
      createdRound: 0,
      creatures: new Array(creatureCount).fill(CreatureType.CENTAUR),
    })
    stack.hasMoved = moved

    expect(Stack.canMuster(stack)).toBe(expected)
  })
  // Adding a mustered creature to the stack is exercised end-to-end by
  // "applies the pending muster to the stack and pool when the muster phase ends" in game.test.ts.
})

describe("Stack musterable (recruit-tier constraints)", () => {
  it.each([
    { centaurCount: 1, lionBases: [] as MusterBasis[] }, // needs 2 Centaurs, only have 1
    { centaurCount: 2, lionBases: [{ creature: CreatureType.CENTAUR, count: 2 }] as MusterBasis[] },
  ])(
    "unlocks the Lion muster tier only once 2 Centaurs are present ($centaurCount Centaur(s))",
    ({ centaurCount, lionBases }) => {
      const stack = Stack.create({
        owner: PlayerId.RED,
        hex: 5,
        marker: 0,
        createdRound: 0,
        creatures: new Array(centaurCount).fill(CreatureType.CENTAUR),
      })
      const possibilities = Stack.musterable(stack, Terrain.PLAINS)

      const { bases: centaurBases } = possibilities.find(({ creature }) => creature === CreatureType.CENTAUR)!
      expect(centaurBases).toEqual([{ creature: CreatureType.CENTAUR, count: 1 }])

      const { bases: actualLionBases } = possibilities.find(({ creature }) => creature === CreatureType.LION)!
      expect(actualLionBases).toEqual(lionBases)
    },
  )

  it("still locks the Ranger tier behind Lions specifically, even once Centaurs unlock the Lion tier", () => {
    // Ranger requires 2 Lions specifically, not 2 Centaurs, so it stays locked even with
    // enough Centaurs to unlock Lion.
    const stack = Stack.create({
      owner: PlayerId.RED,
      hex: 5,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    const { bases: rangerBases } = Stack.musterable(stack, Terrain.PLAINS).find(
      ({ creature }) => creature === CreatureType.RANGER,
    )!
    expect(rangerBases).toEqual([])
  })

  it("always offers the tower's basic recruits regardless of stack contents", () => {
    const stack = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR],
    })
    const possibilities = Stack.musterable(stack, Terrain.TOWER)

    for (const type of [CreatureType.CENTAUR, CreatureType.OGRE, CreatureType.GARGOYLE]) {
      const { bases } = possibilities.find(({ creature }) => creature === type)!
      expect(bases).toEqual([{ creature: type, count: 0 }])
    }
  })

  it("only offers a Guardian once 3 of any one creature type are present", () => {
    const shortOfThree = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    const { bases: noGuardian } = Stack.musterable(shortOfThree, Terrain.TOWER).find(
      ({ creature }) => creature === CreatureType.GUARDIAN,
    )!
    expect(noGuardian).toEqual([])

    const threeOfAKind = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    const { bases: guardianBases } = Stack.musterable(threeOfAKind, Terrain.TOWER).find(
      ({ creature }) => creature === CreatureType.GUARDIAN,
    )!
    expect(guardianBases).toEqual([{ creature: CreatureType.CENTAUR, count: 3 }])
  })

  it("only offers a Warlock when a Titan is present", () => {
    const noTitan = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR],
    })
    const { bases: noWarlock } = Stack.musterable(noTitan, Terrain.TOWER).find(
      ({ creature }) => creature === CreatureType.WARLOCK,
    )!
    expect(noWarlock).toEqual([])

    const withTitan = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.TITAN],
    })
    const { bases: warlockBases } = Stack.musterable(withTitan, Terrain.TOWER).find(
      ({ creature }) => creature === CreatureType.WARLOCK,
    )!
    expect(warlockBases).toEqual([{ creature: CreatureType.TITAN, count: 1 }])
  })
})
