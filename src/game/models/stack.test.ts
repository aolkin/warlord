import { describe, it, expect } from "vitest"
import { MusterBasis, Stack } from "./stack"
import { CreatureType } from "./creature"
import { Terrain } from "./masterboard"
import { PlayerId } from "./player"

describe("Stack splitting", () => {
  it("rejects a first-round split unless exactly 4 creatures split off with exactly one lord", () => {
    const stack = Stack.create({ owner: PlayerId.RED, hex: 5, marker: 0, createdRound: 0 })
    // Default 8: [TITAN, ANGEL, CENTAUR, CENTAUR, OGRE, OGRE, GARGOYLE, GARGOYLE]
    expect(Stack.isValidSplit(stack, true)).toBe(false) // nothing marked yet

    stack.split[0] = true // TITAN
    stack.split[2] = true // CENTAUR
    stack.split[4] = true // OGRE
    expect(Stack.isValidSplit(stack, true)).toBe(false) // only 3 marked

    stack.split[1] = true // ANGEL - now 4 marked but 2 lords (TITAN + ANGEL)
    expect(Stack.isValidSplit(stack, true)).toBe(false)

    stack.split[1] = false
    stack.split[6] = true // GARGOYLE - back to 4 marked, 1 lord (TITAN)
    expect(Stack.isValidSplit(stack, true)).toBe(true)
  })

  it("allows splitting off zero, or two-or-more leaving at least two behind, in later rounds", () => {
    const stack = Stack.create({ owner: PlayerId.RED, hex: 5, marker: 0, createdRound: 0 })
    expect(Stack.isValidSplit(stack)).toBe(true) // no pending split is always valid outside round 1

    stack.split[0] = true
    expect(Stack.isValidSplit(stack)).toBe(false) // splitting exactly 1 creature is never valid

    stack.split[1] = true
    expect(Stack.isValidSplit(stack)).toBe(true) // 2 splitting, 6 remaining

    // Splitting off 6 of 8 would leave only 2 behind, which is still valid...
    for (let i = 2; i < 6; i++) stack.split[i] = true
    expect(Stack.getSplittingCreatures(stack).length).toBe(6)
    expect(Stack.isValidSplit(stack)).toBe(true)

    // ...but leaving fewer than 2 behind is not.
    stack.split[6] = true
    expect(Stack.getSplittingCreatures(stack).length).toBe(7)
    expect(Stack.isValidSplit(stack)).toBe(false)
  })

  it("finalizes a split into a new stack sharing the same hex but a new marker", () => {
    const stack = Stack.create({ owner: PlayerId.RED, hex: 5, marker: 0, createdRound: 0 })
    stack.split[0] = true
    stack.split[2] = true
    stack.split[4] = true
    stack.split[6] = true
    const splitOff = Stack.getSplittingCreatures(stack)

    const newStack = Stack.finalizeSplit(stack, 1, 0)

    expect(newStack.owner).toBe(PlayerId.RED)
    expect(newStack.hex).toBe(5)
    expect(newStack.initialHex).toBe(5)
    expect(newStack.marker).toBe(1)
    expect(newStack.creatures).toEqual(splitOff)
    expect(stack.creatures.length).toBe(4)
    expect(stack.creatures).toEqual(Stack.getStayingCreatures(stack))
    // The pending split markers are cleared after finalizing.
    expect(Stack.getSplittingCreatures(stack).length).toBe(0)
  })

  it("refuses to finalize an invalid split", () => {
    const stack = Stack.create({ owner: PlayerId.RED, hex: 5, marker: 0, createdRound: 0 })
    stack.split[0] = true // only 1 marked, never valid
    expect(() => Stack.finalizeSplit(stack, 1, 0)).toThrow()
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
    if (moved) stack.hex = 6

    expect(Stack.canMuster(stack)).toBe(expected)
  })
  // Adding a mustered creature to the stack is exercised end-to-end by
  // "applies the pending muster to the stack and pool when the muster phase ends" in game.test.ts.
})

describe("Stack musterable (recruit-tier constraints)", () => {
  it.each([
    { centaurCount: 1, lionBases: [] as MusterBasis[] }, // needs 2 Centaurs, only have 1
    { centaurCount: 2, lionBases: [[CreatureType.CENTAUR, 2]] as MusterBasis[] },
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

      const [, centaurBases] = possibilities.find(([type]) => type === CreatureType.CENTAUR)!
      expect(centaurBases).toEqual([[CreatureType.CENTAUR, 1]])

      const [, actualLionBases] = possibilities.find(([type]) => type === CreatureType.LION)!
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
    const [, rangerBases] = Stack.musterable(stack, Terrain.PLAINS).find(([type]) => type === CreatureType.RANGER)!
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
      const [, bases] = possibilities.find(([t]) => t === type)!
      expect(bases).toEqual([[type, 0]])
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
    const [, noGuardian] = Stack.musterable(shortOfThree, Terrain.TOWER).find(([t]) => t === CreatureType.GUARDIAN)!
    expect(noGuardian).toEqual([])

    const threeOfAKind = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    const [, guardianBases] = Stack.musterable(threeOfAKind, Terrain.TOWER).find(([t]) => t === CreatureType.GUARDIAN)!
    expect(guardianBases).toEqual([[CreatureType.CENTAUR, 3]])
  })

  it("only offers a Warlock when a Titan is present", () => {
    const noTitan = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.CENTAUR],
    })
    const [, noWarlock] = Stack.musterable(noTitan, Terrain.TOWER).find(([t]) => t === CreatureType.WARLOCK)!
    expect(noWarlock).toEqual([])

    const withTitan = Stack.create({
      owner: PlayerId.RED,
      hex: 100,
      marker: 0,
      createdRound: 0,
      creatures: [CreatureType.TITAN],
    })
    const [, warlockBases] = Stack.musterable(withTitan, Terrain.TOWER).find(([t]) => t === CreatureType.WARLOCK)!
    expect(warlockBases).toEqual([[CreatureType.TITAN, 1]])
  })
})
