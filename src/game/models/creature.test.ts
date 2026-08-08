import { describe, expect, it } from "vitest"
import { CREATURE_DATA, CREATURE_LIST, Creature, CreatureType, MUSTER_DATA } from "./creature"
import { Terrain } from "./masterboard"

const ALL_CREATURE_TYPES = Object.values(CreatureType).filter((v): v is number => typeof v === "number")

describe("CREATURE_DATA", () => {
  it("has exactly one entry per CreatureType", () => {
    expect(CREATURE_LIST.map(c => c.type).sort()).toEqual([...ALL_CREATURE_TYPES].sort())
  })

  // 3.1: "Lords are divided into three types: Titans, Angels, and Archangels."
  it("lords are exactly Titan, Angel, and Archangel", () => {
    const lords = new Set(CREATURE_LIST.filter(c => c.lord).map(c => c.type))
    expect(lords).toEqual(new Set([CreatureType.TITAN, CreatureType.ANGEL, CreatureType.ARCHANGEL]))
  })

  // 3.2: "Guardians and Warlocks are the two types of Demi-Lords." They're recruited only
  // in Tower Lands (18.4/18.5), a mechanism MUSTER_DATA's terrain chains don't model, so
  // they never appear in any chain. 3.3: the remaining 19 types are the terrain-musterable
  // Creatures. Deriving the demi-lord set as "non-Lord, non-musterable" (rather than typing
  // its two members against a chart) also catches a demi-lord type wrongly added to a chain.
  it("demi-lords are exactly the non-Lord types absent from every terrain muster chain, leaving 19 musterable Creature types", () => {
    const lords = new Set(CREATURE_LIST.filter(c => c.lord).map(c => c.type))
    const musterable = new Set(Object.values(MUSTER_DATA).flatMap(chain => chain.map(([, type]) => type)))
    const demiLords = ALL_CREATURE_TYPES.filter(t => !lords.has(t) && !musterable.has(t))
    expect(new Set(demiLords)).toEqual(new Set([CreatureType.GUARDIAN, CreatureType.WARLOCK]))
    expect(musterable.size).toBe(19)
    expect(lords.size + demiLords.length + musterable.size).toBe(ALL_CREATURE_TYPES.length)
  })

  // 28's Character Chart bounds every Power-factor 3-18 and every Skill-factor 2-4; the
  // constructor enforces the same bounds, but this checks the assembled data set directly.
  it("every creature's Power-factor and Skill-factor fall within the chart's ranges", () => {
    for (const creature of CREATURE_LIST) {
      expect(creature.strength).toBeGreaterThanOrEqual(3)
      expect(creature.strength).toBeLessThanOrEqual(18)
      expect(creature.skill).toBeGreaterThanOrEqual(2)
      expect(creature.skill).toBeLessThanOrEqual(4)
    }
  })
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

  // 18.2: "The numbers to the left of the character's name indicate how many of that type
  // a Legion must already contain to be qualified to muster a Creature of the next larger
  // size." Only the base Creature of a chain needs no prior count. Stack.musterable() reads
  // each non-base entry's requirement against the immediately preceding chain entry
  // (src/game/models/stack.ts's terrainData[i - 1] lookup), so a requirement anywhere but
  // the front, or a missing one past the front, would desync from how it's consumed.
  it("in each non-Tower terrain, only the base creature omits a muster-count requirement", () => {
    for (const [terrainKey, chain] of Object.entries(MUSTER_DATA)) {
      if (Number(terrainKey) === Terrain.TOWER) continue
      expect(chain[0][0]).toBeNull()
      for (const [threshold] of chain.slice(1)) {
        expect(threshold).not.toBeNull()
        expect(threshold!).toBeGreaterThan(0)
      }
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
})
