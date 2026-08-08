import { describe, expect, it } from "vitest"
import { CREATURE_DATA, CREATURE_LIST, Creature, CreatureType, MUSTER_DATA } from "./creature"
import { Terrain } from "./masterboard"

// Attributes below are transcribed from the Character Chart, rulebook section 28
// (assets/reference/titan-rules.md lines 411-450). Titan's Value is left blank there
// ("??") because a Titan's Power-factor is score-based (see 19.1), so it's omitted here.
const CHARACTER_CHART: Array<{
  type: CreatureType
  strength: number
  skill: number
  canFly: boolean
  canRangestrike: boolean
  lord: boolean
  value: number | null
}> = [
  // Lords (3.1: "Lords are divided into three types: Titans, Angels, and Archangels")
  { type: CreatureType.TITAN, strength: 6, skill: 4, canFly: false, canRangestrike: false, lord: true, value: null },
  { type: CreatureType.ANGEL, strength: 6, skill: 4, canFly: true, canRangestrike: false, lord: true, value: 24 },
  { type: CreatureType.ARCHANGEL, strength: 9, skill: 4, canFly: true, canRangestrike: false, lord: true, value: 36 },
  // Demi-Lords: Guardian and Warlock are not Lords per 3.1
  { type: CreatureType.GUARDIAN, strength: 12, skill: 2, canFly: true, canRangestrike: false, lord: false, value: 24 },
  { type: CreatureType.WARLOCK, strength: 5, skill: 4, canFly: false, canRangestrike: true, lord: false, value: 20 },
  // Creatures
  { type: CreatureType.BEHEMOTH, strength: 8, skill: 3, canFly: false, canRangestrike: false, lord: false, value: 24 },
  { type: CreatureType.CENTAUR, strength: 3, skill: 4, canFly: false, canRangestrike: false, lord: false, value: 12 },
  { type: CreatureType.COLOSSUS, strength: 10, skill: 4, canFly: false, canRangestrike: false, lord: false, value: 40 },
  { type: CreatureType.CYCLOPS, strength: 9, skill: 2, canFly: false, canRangestrike: false, lord: false, value: 18 },
  { type: CreatureType.DRAGON, strength: 9, skill: 3, canFly: true, canRangestrike: true, lord: false, value: 27 },
  { type: CreatureType.GARGOYLE, strength: 4, skill: 3, canFly: true, canRangestrike: false, lord: false, value: 12 },
  { type: CreatureType.GIANT, strength: 7, skill: 4, canFly: false, canRangestrike: true, lord: false, value: 28 },
  { type: CreatureType.GORGON, strength: 6, skill: 3, canFly: true, canRangestrike: true, lord: false, value: 18 },
  { type: CreatureType.GRIFFON, strength: 5, skill: 4, canFly: true, canRangestrike: false, lord: false, value: 20 },
  { type: CreatureType.HYDRA, strength: 10, skill: 3, canFly: false, canRangestrike: true, lord: false, value: 30 },
  { type: CreatureType.LION, strength: 5, skill: 3, canFly: false, canRangestrike: false, lord: false, value: 15 },
  { type: CreatureType.MINOTAUR, strength: 4, skill: 4, canFly: false, canRangestrike: true, lord: false, value: 16 },
  { type: CreatureType.OGRE, strength: 6, skill: 2, canFly: false, canRangestrike: false, lord: false, value: 12 },
  { type: CreatureType.RANGER, strength: 4, skill: 4, canFly: true, canRangestrike: true, lord: false, value: 16 },
  { type: CreatureType.SERPENT, strength: 18, skill: 2, canFly: false, canRangestrike: false, lord: false, value: 36 },
  { type: CreatureType.TROLL, strength: 8, skill: 2, canFly: false, canRangestrike: false, lord: false, value: 16 },
  { type: CreatureType.UNICORN, strength: 6, skill: 4, canFly: false, canRangestrike: false, lord: false, value: 24 },
  { type: CreatureType.WARBEAR, strength: 6, skill: 3, canFly: false, canRangestrike: false, lord: false, value: 18 },
  { type: CreatureType.WYVERN, strength: 7, skill: 3, canFly: true, canRangestrike: false, lord: false, value: 21 }
].map(row => ({ ...row, label: CreatureType[row.type] }))

describe("CREATURE_DATA", () => {
  it("has exactly one entry per CreatureType", () => {
    const enumTypes = Object.values(CreatureType).filter((v): v is number => typeof v === "number")
    expect(CREATURE_LIST.map(c => c.type).sort()).toEqual(enumTypes.sort())
    expect(CHARACTER_CHART.map(c => c.type).sort()).toEqual(enumTypes.sort())
  })

  it.each(CHARACTER_CHART)(
    "$label matches the rulebook's Battle-factors, abilities, and value",
    ({ type, strength, skill, canFly, canRangestrike, lord, value }) => {
      const creature = CREATURE_DATA[type]
      expect(creature.strength).toBe(strength)
      expect(creature.skill).toBe(skill)
      expect(creature.canFly).toBe(canFly)
      expect(creature.canRangestrike).toBe(canRangestrike)
      expect(creature.lord).toBe(lord)
      if (value !== null) {
        expect(creature.getValue()).toBe(value)
      }
    }
  )
})

describe("Creature constructor validation", () => {
  it("rejects a strength outside the chart's 3-18 range", () => {
    expect(() => new Creature(CreatureType.LION, 2, 3)).toThrow()
    expect(() => new Creature(CreatureType.LION, 19, 3)).toThrow()
  })

  it("rejects a skill outside the chart's 2-4 range", () => {
    expect(() => new Creature(CreatureType.LION, 5, 1)).toThrow()
    expect(() => new Creature(CreatureType.LION, 5, 5)).toThrow()
  })
})

describe("Creature.getStrength", () => {
  it("is fixed for non-Titan creatures regardless of score", () => {
    const lion = CREATURE_DATA[CreatureType.LION]
    expect(lion.getStrength(0)).toBe(5)
    expect(lion.getStrength(999)).toBe(5)
  })

  // 19.1: Titans begin with a Power-factor of 6, and it rises by 1 for each 100 points
  // scored (score divided by 100, rounded down). The 327->9 and 1,163->17 cases are the
  // rulebook's own worked examples; 400->10 doubles as the 19.2 Titan Teleportation
  // threshold ("a Titan reaches a Power-factor of 10... by scoring 400+ points").
  it.each([
    { score: 0, power: 6 },
    { score: 99, power: 6 },
    { score: 100, power: 7 },
    { score: 327, power: 9 },
    { score: 399, power: 9 },
    { score: 400, power: 10 },
    { score: 1163, power: 17 }
  ])("Titan Power-factor is $power at score $score", ({ score, power }) => {
    expect(CREATURE_DATA[CreatureType.TITAN].getStrength(score)).toBe(power)
  })
})

describe("MUSTER_DATA", () => {
  it("lists each terrain's creatures in ascending value order (18.2: lesser Creatures listed first)", () => {
    for (const chain of Object.values(MUSTER_DATA)) {
      const values = chain.map(([, type]) => CREATURE_DATA[type].getValue())
      expect(values).toEqual([...values].sort((a, b) => a - b))
    }
  })

  it("Tower legions may muster any Tower creature regardless of Legion contents (18.5)", () => {
    expect(MUSTER_DATA[Terrain.TOWER]).toEqual([
      [0, CreatureType.CENTAUR],
      [0, CreatureType.OGRE],
      [0, CreatureType.GARGOYLE]
    ])
  })

  it("Marsh: base Ogre, 2 Ogres qualify for a Troll (18.3 worked example)", () => {
    const chain = MUSTER_DATA[Terrain.MARSH]
    expect(chain[0]).toEqual([null, CreatureType.OGRE])
    expect(chain[1]).toEqual([2, CreatureType.TROLL])
  })

  it("Mountains: base Lion, 2 Lions qualify for a Minotaur, 2 Minotaurs qualify for a Dragon (18.3 worked example)", () => {
    const chain = MUSTER_DATA[Terrain.MOUNTAINS]
    expect(chain[0]).toEqual([null, CreatureType.LION])
    expect(chain[1]).toEqual([2, CreatureType.MINOTAUR])
    expect(chain[2]).toEqual([2, CreatureType.DRAGON])
  })

  // The Muster Progression Diagram (18.0) notes Colossus sits at the apex, connected
  // down to both Giant (the Tundra chain) and Dragon (the Mountains chain).
  it("Colossus is the apex creature reachable via both the Mountains and Tundra chains", () => {
    expect(MUSTER_DATA[Terrain.MOUNTAINS].at(-1)![1]).toBe(CreatureType.COLOSSUS)
    expect(MUSTER_DATA[Terrain.TUNDRA].at(-1)![1]).toBe(CreatureType.COLOSSUS)
  })

  // The Hazard Chart (27.) lists each hazard's "native characters". Those sets should
  // match the creatures recruitable in the terrain(s) featuring that hazard.
  it.each([
    {
      hazard: "Bramble",
      terrains: [Terrain.BRUSH, Terrain.JUNGLE],
      natives: [CreatureType.GARGOYLE, CreatureType.CYCLOPS, CreatureType.GORGON, CreatureType.BEHEMOTH,
        CreatureType.SERPENT]
    },
    {
      hazard: "Drift",
      terrains: [Terrain.TUNDRA],
      natives: [CreatureType.TROLL, CreatureType.WARBEAR, CreatureType.GIANT, CreatureType.COLOSSUS]
    },
    {
      hazard: "Bog",
      terrains: [Terrain.MARSH, Terrain.SWAMP],
      natives: [CreatureType.OGRE, CreatureType.TROLL, CreatureType.RANGER, CreatureType.WYVERN, CreatureType.HYDRA]
    },
    {
      hazard: "Sand/Dune",
      terrains: [Terrain.DESERT],
      natives: [CreatureType.LION, CreatureType.GRIFFON, CreatureType.HYDRA]
    },
    {
      hazard: "Slope",
      terrains: [Terrain.MOUNTAINS, Terrain.HILLS],
      natives: [CreatureType.OGRE, CreatureType.LION, CreatureType.MINOTAUR, CreatureType.UNICORN,
        CreatureType.DRAGON, CreatureType.COLOSSUS]
    }
  ])("$hazard-native creatures match the recruit chains for their terrain(s)", ({ terrains, natives }) => {
    const recruitable = new Set(terrains.flatMap(t => MUSTER_DATA[t].map(([, type]) => type)))
    expect(recruitable).toEqual(new Set(natives))
  })
})
