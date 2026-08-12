import { describe, expect, it } from "vitest"
import { CREATURE_DATA, CreatureType } from "@/models/creature"
import { HexEdge, Terrain } from "@/models/masterboard"
import { PlayerId } from "@/models/player"
import { UNATTAINABLE_MOVEMENT_COST } from "./board"
import { BattleCreature } from "./combatant"
import { Battle, BattleSide, nextPhase, phaseEnterStrike } from "./engine"
import { BattlePhase } from "./strike"

function setupBattle(terrain: Terrain, attackerTypes: CreatureType[], defenderTypes: CreatureType[]): {
  battle: Battle
  offense: BattleCreature[]
  defense: BattleCreature[]
} {
  const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: attackerTypes }
  const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: defenderTypes }
  const battle = new Battle(terrain, HexEdge.FIRST, attacking, defending)
  return { battle, offense: battle.getOffense(), defense: battle.getDefense() }
}

function place(creature: BattleCreature, hex: number): void {
  creature.hex = hex
  creature.initialHex = hex
}

describe("Battle engagement", () => {
  it("moves into contact, resolves a strike, and inflicts casualties", async () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense

    // Defender moves first each round; hex 7 is within the Centaur's reach from its
    // entrance and adjacent to hex 8, which the Lion can reach on its own move.
    expect(battle.movementFor(centaur).has(7)).toBe(true)
    centaur.hex = 7
    // Nothing is on the board to engage yet, so strike/strikeback for both sides
    // are auto-skipped straight through to the attacker's move.
    nextPhase(battle)
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)

    expect(battle.movementFor(lion).has(8)).toBe(true)
    lion.hex = 8
    nextPhase(battle)
    expect(battle.phase).toBe(BattlePhase.ATTACKER_STRIKE)
    expect(battle.engagedWith(lion)).toEqual([centaur])
    expect(battle.getPendingStrikes()).toEqual([lion])

    const toHit = battle.toHitAdjusted(lion, centaur)
    expect(toHit).toBe(5) // 4 - (lion skill 3 - centaur skill 4), no terrain adjustment
    await battle.attackCreature({ attacker: lion.id, target: centaur.id, rolls: [6, 6, 6, 6, 6] })

    expect(lion.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(3) // Centaur's full strength (3); capped, not overkill
    expect(centaur.strength - centaur.wounds).toBe(0)
    expect(centaur.hex).toBe(7) // corpses stay on the board until phaseExitStrikeback
  })
})

describe("Rangestrike targets", () => {
  // Ranger (skill 4, strength 4) placed at battle-hex 8 on the plains board, with no
  // other creature adjacent so it is never itself engaged.
  function setupRanger(attackerType: CreatureType, targetHex: number): {
    battle: Battle
    attacker: BattleCreature
    target: BattleCreature
  } {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [attackerType], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [attacker] = offense
    const [target] = defense
    place(attacker, 8)
    place(target, targetHex)
    return { battle, attacker, target }
  }

  it.each([
    {
      label: "near-range, no adjustment",
      creatureType: CreatureType.RANGER, targetHex: 20, length: 1, longDistance: false,
      adjustment: { toHit: 0, dice: 0 }, rangestrike: { toHit: 4, dice: 2 }
    },
    {
      label: "extended range (skill 4), long-distance to-hit penalty",
      creatureType: CreatureType.RANGER, targetHex: 26, length: 1, longDistance: true,
      adjustment: undefined, rangestrike: { toHit: 5, dice: 2 }
    },
    // Same targetHex 26 is reachable at long range by a skill-4 Ranger (above) but not by a
    // skill-3 Hydra, which only gets near-range paths.
    {
      label: "extended range unreachable by a skill-3 rangestriker (Hydra)",
      creatureType: CreatureType.HYDRA, targetHex: 26, length: 0, longDistance: undefined,
      adjustment: undefined, rangestrike: undefined
    },
    {
      label: "nothing within rangestrike distance",
      creatureType: CreatureType.RANGER, targetHex: 32, length: 0, longDistance: undefined,
      adjustment: undefined, rangestrike: undefined
    }
  ])("finds rangestrike targets by distance: $label", ({
    creatureType, targetHex, length, longDistance, adjustment, rangestrike
  }) => {
    const { battle, attacker, target } = setupRanger(creatureType, targetHex)

    const targets = battle.rangestrikeTargets(attacker)
    expect(targets).toHaveLength(length)
    if (length > 0) {
      expect(targets[0].creature).toBe(target)
      expect(targets[0].longDistance).toBe(longDistance)
      if (adjustment !== undefined) expect(targets[0].adjustment).toEqual(adjustment)
      expect(battle.getRangestrike(attacker, targets[0])).toEqual(rangestrike)
    }
  })

  it("cannot rangestrike while already engaged in melee", () => {
    // Hex 7 is adjacent to the Ranger's hex 8, so this is melee range, not rangestrike
    // range - rangestrike is unavailable regardless of what else is in range.
    const { battle, attacker } = setupRanger(CreatureType.RANGER, 7)
    expect(battle.rangestrikeTargets(attacker)).toEqual([])
  })

  it("gives a Dragon bonus dice when rangestriking out of its native volcano hazard", () => {
    // Terrain.MOUNTAINS' battle board has a volcano hazard at battle-hex 15 (Dragons are volcano-native).
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.DRAGON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.MOUNTAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const dragon = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    dragon.hex = 15
    dragon.initialHex = 15
    centaur.hex = 4
    centaur.initialHex = 4

    const targets = battle.rangestrikeTargets(dragon)
    expect(targets).toHaveLength(1)
    expect(targets[0].adjustment).toEqual({ toHit: 0, dice: 2 })
  })

  // A bramble-native defender rangestruck by a non-native attacker is harder to hit:
  // the rulebook (Hazard Chart, Bramble/Rangestriking) raises the Strike-number by 1,
  // matching the melee equivalent (strikeAdjustment adds +1 toHit for the same case).
  it("raises the to-hit for a bramble-native defender rangestruck by a non-native", () => {
    // Terrain.BRUSH's battle board has bramble hazard hexes including battle-hex 16; Gargoyles are bramble-native.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.GARGOYLE] }
    const battle = new Battle(Terrain.BRUSH, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const ranger = battle.getOffense()[0]
    const gargoyle = battle.getDefense()[0]
    ranger.hex = 8
    ranger.initialHex = 8
    gargoyle.hex = 16
    gargoyle.initialHex = 16

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].adjustment).toEqual({ toHit: 1, dice: 0 })
  })

  // A Dragon defending in a volcano is harder to hit: the strike number needed to hit
  // it is raised by one, per the in-code comment on this case.
  it("raises the to-hit for a Dragon defending in its native volcano", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.DRAGON] }
    const battle = new Battle(Terrain.MOUNTAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const ranger = battle.getOffense()[0]
    const dragon = battle.getDefense()[0]
    ranger.hex = 2
    ranger.initialHex = 2
    dragon.hex = 15
    dragon.initialHex = 15

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].adjustment).toEqual({ toHit: 1, dice: 0 })
  })

  // A non-native rangestriker loses a skill factor for each intervening hex containing
  // bramble, which - like every other hazard adjustment here - raises toHit (harder to
  // hit) rather than lowering it.
  it("raises the to-hit by one per intervening bramble hex crossed", () => {
    // Terrain.JUNGLE's battle board has bramble hazards at battle-hexes 15 and 20, both crossed here.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.JUNGLE, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const ranger = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    ranger.hex = 8
    ranger.initialHex = 8
    centaur.hex = 27
    centaur.initialHex = 27

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].longDistance).toBe(true)
    expect(targets[0].adjustment).toEqual({ toHit: 2, dice: 0 })
  })

  // Crossing a wall upwards costs a skill factor, raising toHit the same way as the
  // other hazard adjustments above.
  it("raises the to-hit for a rangestrike that crosses a wall upwards", () => {
    // Terrain.TOWER's battle board has a wall edge between battle-hexes 7 (elevation 0) and 8 (elevation 1).
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.TOWER, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const ranger = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    ranger.hex = 13
    ranger.initialHex = 13
    centaur.hex = 8
    centaur.initialHex = 8

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].longDistance).toBe(false)
    expect(targets[0].adjustment).toEqual({ toHit: 1, dice: 0 })
  })
})

describe("Carryover", () => {
  function setupTripleEngagement(): {
    battle: Battle
    lion: ReturnType<Battle["getOffense"]>[number]
    centaur1: ReturnType<Battle["getDefense"]>[number]
    centaur2: ReturnType<Battle["getDefense"]>[number]
  } {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const lion = battle.getOffense()[0]
    const [centaur1, centaur2] = battle.getDefense()
    lion.hex = 8
    lion.initialHex = 8
    // Both 7 and 9 are adjacent to hex 8 (see BATTLE_BOARD_ADJACENCIES).
    centaur1.hex = 7
    centaur1.initialHex = 7
    centaur2.hex = 9
    centaur2.initialHex = 9
    return { battle, lion, centaur1, centaur2 }
  }

  it("assigns overflow hits from an overkill strike to another engaged target", async () => {
    const { battle, lion, centaur1, centaur2 } = setupTripleEngagement()

    await battle.attackCreature({ attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })
    expect(centaur1.strength - centaur1.wounds).toBe(0)
    expect(battle.activeStrike?.canCarryover).toBe(true)
    // getCarryoverHits = 5 total hits - 3 assigned to centaur1
    expect(battle.activeStrike?.getCarryoverHits()).toBe(2)
    expect(battle.carryoverTargets()).toEqual([centaur2])

    await battle.assignCarryover(centaur2.id)
    expect(centaur2.wounds).toBe(2)
    expect(battle.activeStrike?.canCarryover).toBe(false) // no hits left to carry over
  })

  it("stops carryover once skipCarryover is called", async () => {
    const { battle, lion, centaur1 } = setupTripleEngagement()

    await battle.attackCreature({ attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })
    expect(battle.activeStrike?.canCarryover).toBe(true)

    await battle.skipCarryover()

    expect(battle.activeStrike?.canCarryover).toBe(false)
    expect(battle.carryoverTargets()).toBeUndefined()
  })
})

describe("Battle board movement cost", () => {
  it("makes a bog hazard impassable for non-native, non-flying creatures but not for natives", () => {
    // Terrain.MARSH's battle board has a bog hazard at battle-hex 8 (Trolls are bog-native, Centaurs are not).
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.TROLL] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.MARSH, HexEdge.FIRST, attacking, defending)
    const troll = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]

    expect(battle.creatureMovementCost(8, 2, troll)).toBe(1)
    expect(battle.creatureMovementCost(8, 2, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("blocks a volcano hazard for non-native creatures even if they can fly", () => {
    // Terrain.MOUNTAINS' battle board has a volcano hazard at battle-hex 15 (only
    // Dragons are volcano-native). Unlike bog and tree, the volcano case in
    // creatureMovementCost has no `|| canFly` escape hatch.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.GRIFFON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.MOUNTAINS, HexEdge.FIRST, attacking, defending)
    const griffon = battle.getOffense()[0]

    expect(CREATURE_DATA[CreatureType.GRIFFON].canFly).toBe(true)
    expect(battle.creatureMovementCost(15, 9, griffon)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("lets a flying creature cross a tree hex without stopping, but never land in it", () => {
    // Terrain.WOODS' battle board has a tree hazard at battle-hex 3. Trees have no
    // native creatures, but the movement-cost switch still waives the block for flyers
    // (`native || canFly`); creatureCanLand blocks trees unconditionally regardless of flight.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.GRIFFON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.WOODS, HexEdge.FIRST, attacking, defending)
    const griffon = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]

    expect(battle.creatureMovementCost(3, 2, griffon)).toBe(1)
    expect(battle.creatureCanLand(3, griffon)).toBe(false)
    expect(battle.creatureMovementCost(3, 2, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("charges an extra movement point to cross a slope uphill unless edge-native, but never downhill", () => {
    // Terrain.HILLS' battle board has battle-hex 2 elevated above (and slope-edged
    // with) battle-hex 3. Ogres are slope-native, Centaurs are not.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.OGRE] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.HILLS, HexEdge.FIRST, attacking, defending)
    const ogre = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]

    expect(battle.creatureMovementCost(2, 3, ogre)).toBe(1) // uphill, native: no penalty
    expect(battle.creatureMovementCost(2, 3, centaur)).toBe(2) // uphill, non-native: +1
    expect(battle.creatureMovementCost(3, 2, centaur)).toBe(1) // downhill: no penalty regardless
  })

  it("charges an extra movement point to cross a wall in one direction only, regardless of native status", () => {
    // Terrain.TOWER's battle board has a wall edge between battle-hexes 2 (elevation 0)
    // and 8 (elevation 1). EDGE_HAZARD_NATIVES has no wall entries, so the penalty
    // applies to every creature type crossing upward.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.OGRE] }
    const battle = new Battle(Terrain.TOWER, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getOffense()[0]

    expect(battle.creatureMovementCost(8, 2, centaur)).toBe(2) // upward, across the wall
    expect(battle.creatureMovementCost(2, 8, centaur)).toBe(1) // downward: no penalty
  })

  it("makes a cliff edge impassable in both directions, unlike walls and slopes", () => {
    // Terrain.DESERT's battle board has a cliff edge between battle-hexes 15 and 20.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.OGRE] }
    const battle = new Battle(Terrain.DESERT, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getOffense()[0]

    expect(battle.creatureMovementCost(15, 20, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
    expect(battle.creatureMovementCost(20, 15, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })
})

describe("Movement legality (movementFor)", () => {
  it("returns an empty set for a creature that is not on the board", () => {
    const { battle, offense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    lion.initialHex = 0

    expect(battle.movementFor(lion)).toEqual(new Set())
  })

  it("reaches exactly the hexes affordable within a creature's skill, on hazard-free terrain", () => {
    // Ogre (skill 2) entering from battle-hex 37 (the attacker's entrance zone on
    // HexEdge.FIRST), on hazard-free Plains: every hex within 2 movement points.
    const { battle, offense } = setupBattle(Terrain.PLAINS, [CreatureType.OGRE], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_MOVE
    const [ogre] = offense
    expect(ogre.initialHex).toBe(37)

    expect(battle.movementFor(ogre)).toEqual(new Set([3, 4, 9, 10, 16, 17, 22, 23, 29]))
  })

  it("cannot land a stack on a hex already occupied by another creature (friend or foe)", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_MOVE
    const [lion] = offense
    const [centaur] = defense
    place(centaur, 4)

    expect(battle.movementFor(lion).has(4)).toBe(false)

    // moveCreature mutates hex directly and doesn't call nextPhase(), so a recomputed
    // movementFor within the same move phase must use the centaur's new position, not
    // whatever occupancy applied to the earlier call.
    centaur.hex = 10
    expect(battle.movementFor(lion).has(4)).toBe(true)
    expect(battle.movementFor(lion).has(10)).toBe(false)
  })

  it("lets a flying creature path through hexes blocked for grounded creatures, reaching further", () => {
    // Battle-hex 2 has only three neighbors (3, 7, 8); occupying both 7 and 8 seals off
    // everything past them for a grounded mover, since creatureMovementCost treats an
    // occupied hex as UNATTAINABLE for pathing (not just landing) unless flying - regardless
    // of which player occupies it. The blockers are on the SAME side as the movers (rather
    // than the enemy) so the movers aren't in contact with an enemy at phase start; movementFor
    // doesn't enforce rule 11.3 (in-contact creatures may not move - see the TODO on
    // movementFor in engine.ts), but this test isn't about that gap.
    const { battle, offense } = setupBattle(Terrain.PLAINS,
      [CreatureType.CENTAUR, CreatureType.GRIFFON, CreatureType.LION, CreatureType.LION], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_MOVE
    const [centaur, griffon, blocker1, blocker2] = offense
    place(centaur, 2)
    place(griffon, 2)
    place(blocker1, 7)
    place(blocker2, 8)

    const centaurReach = battle.movementFor(centaur)
    const griffonReach = battle.movementFor(griffon)
    expect(centaurReach).toEqual(new Set([3, 4, 9, 10, 14, 15, 16, 17, 20, 21, 22]))
    expect(griffonReach).toEqual(new Set([
      3, 4, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28
    ]))
  })
})

describe("Engagement edge cases", () => {
  it("does not engage a creature below a cliff with the creature above it", () => {
    // Terrain.DESERT's battle board has a cliff edge between battle-hexes 15 and 20.
    // This direction of the check (queried from the creature below, looking up) happens
    // to work correctly - see the TODO on engagedWith's cliff check in engine.ts for the
    // direction that doesn't.
    const { battle, offense, defense } = setupBattle(Terrain.DESERT, [CreatureType.CENTAUR], [CreatureType.LION])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [centaur] = offense
    const [lion] = defense
    place(centaur, 15) // atop the cliff
    place(lion, 20) // below the cliff

    expect(battle.engagedWith(lion)).toEqual([])
  })

  // TODO: engagedWith's cliff check is direction-asymmetric (see the TODO at engine.ts's
  // engagedWith). Per the Hazard Chart and rule 13.5, a cliff blocks engagement symmetrically -
  // neither creature should be engaged with the other. This documents the correct behavior and
  // is expected to fail (via it.fails) until that asymmetry is fixed.
  it.fails("does not engage a creature atop a cliff with the creature below it", () => {
    const { battle, offense, defense } = setupBattle(Terrain.DESERT, [CreatureType.CENTAUR], [CreatureType.LION])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [centaur] = offense
    const [lion] = defense
    place(centaur, 15) // atop the cliff
    place(lion, 20) // below the cliff

    expect(battle.engagedWith(centaur)).toEqual([])
  })

  it("checks engagement using the pre-move position while still in a move phase", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    centaur.hex = 7 // now adjacent to where the Lion will eventually stand (hex 8)
    lion.hex = 8 // adjacent to centaur.hex (7), but not to centaur.initialHex (36)
    // Still using centaur.initialHex (the entrance zone) for the engagement check, since we
    // haven't left the move phase - if it used centaur.hex instead, the Lion at hex 8 (adjacent
    // to hex 7) would show up as engaged here.
    expect(battle.engagedWith(centaur)).toEqual([])
  })

  it("excludes an engaged creature from carryover if the attacker cannot hit it at the toHit it just rolled", async () => {
    // Terrain.TOWER's battle board has battle-hex 8 atop a wall edge from battle-hex 2,
    // which raises toHit by 1 for an attacker striking up through it.
    const { battle, offense, defense } = setupBattle(Terrain.TOWER,
      [CreatureType.LION], [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [lion] = offense
    const [primary, included, excluded] = defense
    place(lion, 2)
    place(primary, 7) // toHit 5, no hazard - struck directly, overkilled
    place(included, 3) // toHit 5, no hazard - matches the rolled toHit, so carryover-eligible
    place(excluded, 8) // toHit 6, raised by the wall - harder than the rolled toHit

    await battle.attackCreature({ attacker: lion.id, target: primary.id, rolls: [6, 6, 6, 6, 6] })
    expect(primary.strength - primary.wounds).toBe(0) // overkilled, so it drops out of engagedWith too
    expect(battle.carryoverTargets()).toEqual([included])
  })

  it("lets a strike choose a higher toHit than computed, but rejects a lower one", async () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [lion] = offense
    const [centaur] = defense
    place(lion, 8)
    place(centaur, 7)

    const computedToHit = battle.toHitAdjusted(lion, centaur)
    expect(computedToHit).toBe(5)
    await expect(battle.attackCreature({
      attacker: lion.id, target: centaur.id, rolls: [6, 6, 6, 6, 6], optionalToHit: computedToHit - 1
    })).rejects.toThrow("Cannot choose a lower to-hit")

    await battle.attackCreature({
      attacker: lion.id, target: centaur.id, rolls: [6, 6, 6, 6, 6], optionalToHit: computedToHit + 1
    })
    expect(battle.activeStrike?.toHit).toBe(computedToHit + 1)
    // A roll of 6 still clears the raised toHit of 6, so all 5 dice hit (capped at HP 3).
    expect(centaur.wounds).toBe(3)
  })

  it("resolves a rangestrike attack the same way as a melee strike, but never allows carryover", async () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.RANGER], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const [ranger] = offense
    const [centaur] = defense
    place(ranger, 8)
    place(centaur, 20)

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    // Ranger has strength 4, so per rule 12.2 (dice = floor(power / 2)) a rangestrike rolls
    // exactly 2 dice.
    expect(battle.getRangestrike(ranger, targets[0]).dice).toBe(2)
    await battle.rangestrikeCreature({
      attacker: ranger.id, target: { ...targets[0], creature: targets[0].creature.id }, rolls: [6, 6]
    })

    expect(ranger.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(2)
    expect(battle.activeStrike?.rangestrike).toBe(true)
    expect(battle.activeStrike?.canCarryover).toBe(false) // overkilled, but rangestrikes never carry over
  })
})

describe("Battle phase transitions", () => {
  it("cycles through all six phases in order for a continuously-engaged pair, incrementing round only after defender strikeback", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const lion = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    centaur.hex = 7
    centaur.initialHex = 7
    lion.hex = 8
    lion.initialHex = 8

    const expectPhase = (phase: BattlePhase, round: number): void => {
      expect(battle.phase).toBe(phase)
      expect(battle.round).toBe(round)
    }
    expectPhase(BattlePhase.DEFENDER_MOVE, 0)

    nextPhase(battle)
    expectPhase(BattlePhase.DEFENDER_STRIKE, 0)
    BattleCreature.performStrike(centaur) // stand in for an actual strike() call - only hasStruck matters here

    nextPhase(battle)
    expectPhase(BattlePhase.ATTACKER_STRIKEBACK, 0)
    BattleCreature.performStrike(lion)

    nextPhase(battle)
    expectPhase(BattlePhase.ATTACKER_MOVE, 0)

    nextPhase(battle)
    expectPhase(BattlePhase.ATTACKER_STRIKE, 0)
    BattleCreature.performStrike(lion)

    nextPhase(battle)
    expectPhase(BattlePhase.DEFENDER_STRIKEBACK, 0)
    BattleCreature.performStrike(centaur)

    nextPhase(battle)
    expectPhase(BattlePhase.DEFENDER_MOVE, 1)
  })

  it("skips straight past strike and strikeback phases when nobody is engaged", () => {
    const { battle } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    nextPhase(battle) // no engagement -> DEFENDER_STRIKE, ATTACKER_STRIKEBACK both skipped
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)
    nextPhase(battle) // -> ATTACKER_STRIKE, DEFENDER_STRIKEBACK both skipped, round increments
    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    expect(battle.round).toBe(1)
  })

  it("throws if a phase is exited while an engaged, unstruck creature was never given a strike", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense
    place(centaur, 7)
    place(lion, 8)

    nextPhase(battle) // -> DEFENDER_STRIKE, Centaur is now pending and never strikes
    expect(battle.getPendingStrikes()).toEqual([centaur])
    expect(() => nextPhase(battle)).toThrow("All eligible creatures must strike")
  })

  it("resets hasStruck for creatures on both sides whenever a strike phase is entered", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense
    lion.hasStruck = true
    centaur.hasStruck = true

    phaseEnterStrike(battle)

    expect(lion.hasStruck).toBe(false)
    expect(centaur.hasStruck).toBe(false)
  })

  it("removes a creature still in its entrance zone when its move phase ends, but not one that has moved onto the board", () => {
    const { battle, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION],
      [CreatureType.CENTAUR, CreatureType.CENTAUR])
    const [unmoved, moved] = defense
    expect(unmoved.hex).toBe(36) // the defender's entrance zone for HexEdge.FIRST
    moved.hex = 7

    nextPhase(battle)

    expect(unmoved.hex).toBe(0)
    expect(moved.hex).toBe(7)
  })

  it("wounds creatures on drift terrain again on every strike-phase entry, not just once per round", () => {
    // Terrain.TUNDRA's battle board has a drift hazard at battle-hex 7. phaseEnterStrike
    // applies the drift wound unconditionally on every entry into a STRIKE-type phase,
    // so a creature that survives both the defender's and attacker's strike phases in
    // the same round is wounded twice.
    const { battle, defense } = setupBattle(Terrain.TUNDRA, [CreatureType.LION], [CreatureType.CENTAUR])
    const [centaur] = defense
    place(centaur, 7)

    expect(centaur.wounds).toBe(0)
    battle.phase = BattlePhase.DEFENDER_STRIKE
    phaseEnterStrike(battle)
    expect(centaur.wounds).toBe(1)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    phaseEnterStrike(battle)
    expect(centaur.wounds).toBe(2)
  })
})

describe("Battle hydration", () => {
  it("preserves creature ids across a persist/restore round trip", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const idsBeforeHydration = battle.creatures.map(creature => creature.id)

    const hydrated = Battle.hydrate(JSON.parse(JSON.stringify(battle)) as Battle)

    expect(hydrated.creatures.map(creature => creature.id)).toEqual(idsBeforeHydration)
  })
})
