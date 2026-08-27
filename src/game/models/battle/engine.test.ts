import { describe, expect, it } from "vitest"
import { CREATURE_DATA, CreatureType } from "@/models/creature"
import { HexEdge, Terrain } from "@/models/masterboard"
import { PlayerId } from "@/models/player"
import { UNATTAINABLE_MOVEMENT_COST } from "./board"
import { BattleCreature } from "./combatant"
import { Battle, BattleSide } from "./engine"
import { BattlePhase } from "./phase"
import { ActiveStrike } from "./strike"

function getOffense(battle: Battle): BattleCreature[] {
  return battle.creatures.filter(creature => creature.player === battle.attacker)
}

function getDefense(battle: Battle): BattleCreature[] {
  return battle.creatures.filter(creature => creature.player === battle.defender)
}

function setupBattle(
  terrain: Terrain,
  attackerTypes: CreatureType[],
  defenderTypes: CreatureType[],
): {
  battle: Battle
  offense: BattleCreature[]
  defense: BattleCreature[]
} {
  const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: attackerTypes }
  const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: defenderTypes }
  const battle = Battle.create({ terrain, edge: HexEdge.FIRST, attacking, defending })
  return { battle, offense: getOffense(battle), defense: getDefense(battle) }
}

describe("Battle engagement", () => {
  it("moves into contact, resolves a strike, and inflicts casualties", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense

    // Defender moves first each round; hex 7 is within the Centaur's reach from its
    // entrance and adjacent to hex 8, which the Lion can reach on its own move.
    expect(Battle.movementFor(battle, centaur).has(7)).toBe(true)
    // Nothing is on the board to engage yet, so strike/strikeback for both sides
    // are auto-skipped straight through to the attacker's move.
    Battle.finalizeMoves(battle, new Map([[centaur.id, 7]]))
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)

    expect(Battle.movementFor(battle, lion).has(8)).toBe(true)
    Battle.finalizeMoves(battle, new Map([[lion.id, 8]]))
    expect(battle.phase).toBe(BattlePhase.ATTACKER_STRIKE)
    expect(Battle.engagedWith(battle, lion)).toEqual([centaur])
    expect(Battle.getPendingStrikes(battle)).toEqual([lion])

    const toHit = Battle.toHitAdjusted(battle, lion, centaur)
    expect(toHit).toBe(5) // 4 - (lion skill 3 - centaur skill 4), no terrain adjustment
    Battle.attackCreature(battle, { attacker: lion.id, target: centaur.id, rolls: [6, 6, 6, 6, 6] })

    expect(lion.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(3) // Centaur's full strength (3); capped, not overkill
    expect(centaur.hex).toBe(7) // corpses stay on the board until phaseExitStrikeback
  })
})

describe("Rangestrike targets", () => {
  // Ranger (skill 4, strength 4) placed at battle-hex 8 on the plains board, with no
  // other creature adjacent so it is never itself engaged.
  function setupRanger(
    attackerType: CreatureType,
    targetHex: number,
  ): {
    battle: Battle
    attacker: BattleCreature
    target: BattleCreature
  } {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [attackerType], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const [attacker] = offense
    const [target] = defense
    attacker.hex = 8
    target.hex = targetHex
    return { battle, attacker, target }
  }

  it.each([
    {
      label: "near-range, no adjustment",
      creatureType: CreatureType.RANGER,
      targetHex: 20,
      length: 1,
      longDistance: false,
      adjustment: { toHit: 0, dice: 0 },
      rangestrike: { toHit: 4, dice: 2 },
    },
    {
      label: "extended range (skill 4), long-distance to-hit penalty",
      creatureType: CreatureType.RANGER,
      targetHex: 26,
      length: 1,
      longDistance: true,
      adjustment: undefined,
      rangestrike: { toHit: 5, dice: 2 },
    },
    // Same targetHex 26 is reachable at long range by a skill-4 Ranger (above) but not by a
    // skill-3 Hydra, which only gets near-range paths.
    {
      label: "extended range unreachable by a skill-3 rangestriker (Hydra)",
      creatureType: CreatureType.HYDRA,
      targetHex: 26,
      length: 0,
      longDistance: undefined,
      adjustment: undefined,
      rangestrike: undefined,
    },
    {
      label: "nothing within rangestrike distance",
      creatureType: CreatureType.RANGER,
      targetHex: 32,
      length: 0,
      longDistance: undefined,
      adjustment: undefined,
      rangestrike: undefined,
    },
  ])(
    "finds rangestrike targets by distance: $label",
    ({ creatureType, targetHex, length, longDistance, adjustment, rangestrike }) => {
      const { battle, attacker, target } = setupRanger(creatureType, targetHex)

      const targets = Battle.rangestrikeTargets(battle, attacker)
      expect(targets).toHaveLength(length)
      if (length > 0) {
        expect(targets[0].creature).toBe(target)
        expect(targets[0].longDistance).toBe(longDistance)
        if (adjustment !== undefined) expect(targets[0].adjustment).toEqual(adjustment)
        expect(Battle.getRangestrike(attacker, targets[0])).toEqual(rangestrike)
      }
    },
  )

  it("cannot rangestrike while already engaged in melee", () => {
    // Hex 7 is adjacent to the Ranger's hex 8, so this is melee range, not rangestrike
    // range - rangestrike is unavailable regardless of what else is in range.
    const { battle, attacker } = setupRanger(CreatureType.RANGER, 7)
    expect(Battle.rangestrikeTargets(battle, attacker)).toEqual([])
  })

  it("gives a Dragon bonus dice when rangestriking out of its native volcano hazard", () => {
    // Terrain.MOUNTAINS' battle board has a volcano hazard at battle-hex 15 (Dragons are volcano-native).
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.DRAGON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.MOUNTAINS, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const dragon = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]
    dragon.hex = 15
    centaur.hex = 4

    const targets = Battle.rangestrikeTargets(battle, dragon)
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
    const battle = Battle.create({ terrain: Terrain.BRUSH, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const ranger = getOffense(battle)[0]
    const gargoyle = getDefense(battle)[0]
    ranger.hex = 8
    gargoyle.hex = 16

    const targets = Battle.rangestrikeTargets(battle, ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].adjustment).toEqual({ toHit: 1, dice: 0 })
  })

  // A Dragon defending in a volcano is harder to hit: the strike number needed to hit
  // it is raised by one, per the in-code comment on this case.
  it("raises the to-hit for a Dragon defending in its native volcano", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.DRAGON] }
    const battle = Battle.create({ terrain: Terrain.MOUNTAINS, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const ranger = getOffense(battle)[0]
    const dragon = getDefense(battle)[0]
    ranger.hex = 2
    dragon.hex = 15

    const targets = Battle.rangestrikeTargets(battle, ranger)
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
    const battle = Battle.create({ terrain: Terrain.JUNGLE, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const ranger = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]
    ranger.hex = 8
    centaur.hex = 27

    const targets = Battle.rangestrikeTargets(battle, ranger)
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
    const battle = Battle.create({ terrain: Terrain.TOWER, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const ranger = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]
    ranger.hex = 13
    centaur.hex = 8

    const targets = Battle.rangestrikeTargets(battle, ranger)
    expect(targets).toHaveLength(1)
    expect(targets[0].longDistance).toBe(false)
    expect(targets[0].adjustment).toEqual({ toHit: 1, dice: 0 })
  })
})

describe("Carryover", () => {
  function setupTripleEngagement(): {
    battle: Battle
    lion: BattleCreature
    centaur1: BattleCreature
    centaur2: BattleCreature
  } {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = {
      player: PlayerId.BLUE,
      score: 0,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    }
    const battle = Battle.create({ terrain: Terrain.PLAINS, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const lion = getOffense(battle)[0]
    const [centaur1, centaur2] = getDefense(battle)
    lion.hex = 8
    // Both 7 and 9 are adjacent to hex 8 (see BATTLE_BOARD_ADJACENCIES).
    centaur1.hex = 7
    centaur2.hex = 9
    return { battle, lion, centaur1, centaur2 }
  }

  it("assigns overflow hits from an overkill strike to another engaged target", () => {
    const { battle, lion, centaur1, centaur2 } = setupTripleEngagement()

    Battle.attackCreature(battle, { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })
    expect(centaur1.strength - centaur1.wounds).toBe(0)
    // getCarryoverHits = 5 total hits - 3 assigned to centaur1
    expect(battle.activeStrike && ActiveStrike.getCarryoverHits(battle.activeStrike)).toBe(2)
    expect(Battle.carryoverTargets(battle)).toEqual([centaur2])

    Battle.assignCarryover(battle, centaur2.id)
    expect(centaur2.wounds).toBe(2)
    // no hits left to carry over
    expect(battle.activeStrike && ActiveStrike.getCarryoverHits(battle.activeStrike) > 0).toBe(false)
  })

  it("stops carryover once skipCarryover is called", () => {
    const { battle, lion, centaur1 } = setupTripleEngagement()

    Battle.attackCreature(battle, { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })
    expect(battle.activeStrike && ActiveStrike.getCarryoverHits(battle.activeStrike) > 0).toBe(true)

    Battle.skipCarryover(battle)

    expect(battle.activeStrike && ActiveStrike.getCarryoverHits(battle.activeStrike) > 0).toBe(false)
    expect(Battle.carryoverTargets(battle)).toBeUndefined()
  })
})

describe("Battle board movement cost", () => {
  it("makes a bog hazard impassable for non-native, non-flying creatures but not for natives", () => {
    // Terrain.MARSH's battle board has a bog hazard at battle-hex 8 (Trolls are bog-native, Centaurs are not).
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.TROLL] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.MARSH, edge: HexEdge.FIRST, attacking, defending })
    const troll = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]

    expect(Battle.creatureMovementCost(battle, 8, 2, troll)).toBe(1)
    expect(Battle.creatureMovementCost(battle, 8, 2, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("blocks a volcano hazard for non-native creatures even if they can fly", () => {
    // Terrain.MOUNTAINS' battle board has a volcano hazard at battle-hex 15 (only
    // Dragons are volcano-native). Unlike bog and tree, the volcano case in
    // creatureMovementCost has no `|| canFly` escape hatch.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.GRIFFON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.MOUNTAINS, edge: HexEdge.FIRST, attacking, defending })
    const griffon = getOffense(battle)[0]

    expect(CREATURE_DATA[CreatureType.GRIFFON].canFly).toBe(true)
    expect(Battle.creatureMovementCost(battle, 15, 9, griffon)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("lets a flying creature cross a tree hex without stopping, but never land in it", () => {
    // Terrain.WOODS' battle board has a tree hazard at battle-hex 3. Trees have no
    // native creatures, but the movement-cost switch still waives the block for flyers
    // (`native || canFly`); creatureCanLand blocks trees unconditionally regardless of flight.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.GRIFFON] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.WOODS, edge: HexEdge.FIRST, attacking, defending })
    const griffon = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]

    expect(Battle.creatureMovementCost(battle, 3, 2, griffon)).toBe(1)
    expect(Battle.creatureCanLand(battle, 3, griffon)).toBe(false)
    expect(Battle.creatureMovementCost(battle, 3, 2, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })

  it("charges an extra movement point to cross a slope uphill unless edge-native, but never downhill", () => {
    // Terrain.HILLS' battle board has battle-hex 2 elevated above (and slope-edged
    // with) battle-hex 3. Ogres are slope-native, Centaurs are not.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.OGRE] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.HILLS, edge: HexEdge.FIRST, attacking, defending })
    const ogre = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]

    expect(Battle.creatureMovementCost(battle, 2, 3, ogre)).toBe(1) // uphill, native: no penalty
    expect(Battle.creatureMovementCost(battle, 2, 3, centaur)).toBe(2) // uphill, non-native: +1
    expect(Battle.creatureMovementCost(battle, 3, 2, centaur)).toBe(1) // downhill: no penalty regardless
  })

  it("charges an extra movement point to cross a wall in one direction only, regardless of native status", () => {
    // Terrain.TOWER's battle board has a wall edge between battle-hexes 2 (elevation 0)
    // and 8 (elevation 1). EDGE_HAZARD_NATIVES has no wall entries, so the penalty
    // applies to every creature type crossing upward.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.OGRE] }
    const battle = Battle.create({ terrain: Terrain.TOWER, edge: HexEdge.FIRST, attacking, defending })
    const centaur = getOffense(battle)[0]

    expect(Battle.creatureMovementCost(battle, 8, 2, centaur)).toBe(2) // upward, across the wall
    expect(Battle.creatureMovementCost(battle, 2, 8, centaur)).toBe(1) // downward: no penalty
  })

  it("makes a cliff edge impassable in both directions, unlike walls and slopes", () => {
    // Terrain.DESERT's battle board has a cliff edge between battle-hexes 15 and 20.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.OGRE] }
    const battle = Battle.create({ terrain: Terrain.DESERT, edge: HexEdge.FIRST, attacking, defending })
    const centaur = getOffense(battle)[0]

    expect(Battle.creatureMovementCost(battle, 15, 20, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
    expect(Battle.creatureMovementCost(battle, 20, 15, centaur)).toBe(UNATTAINABLE_MOVEMENT_COST)
  })
})

describe("Movement legality (movementFor)", () => {
  it("returns an empty set for a creature that is not on the board", () => {
    const { battle, offense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    lion.hex = 0

    expect(Battle.movementFor(battle, lion)).toEqual(new Set())
  })

  it("reaches exactly the hexes affordable within a creature's skill, on hazard-free terrain", () => {
    // Ogre (skill 2) entering from battle-hex 37 (the attacker's entrance zone on
    // HexEdge.FIRST), on hazard-free Plains: every hex within 2 movement points.
    const { battle, offense } = setupBattle(Terrain.PLAINS, [CreatureType.OGRE], [CreatureType.CENTAUR])
    Battle.finalizeMoves(battle, new Map()) // nobody engaged yet, so this auto-skips straight to ATTACKER_MOVE
    const [ogre] = offense
    expect(ogre.hex).toBe(37)

    expect(Battle.movementFor(battle, ogre)).toEqual(new Set([3, 4, 9, 10, 16, 17, 22, 23, 29]))
  })

  it("cannot land a stack on a hex already occupied by another creature (friend or foe)", () => {
    const { battle, offense } = setupBattle(
      Terrain.PLAINS,
      [CreatureType.LION, CreatureType.CENTAUR],
      [CreatureType.OGRE],
    )
    Battle.finalizeMoves(battle, new Map()) // nobody engaged yet, so this auto-skips straight to ATTACKER_MOVE
    const [lion, centaur] = offense
    centaur.hex = 4

    expect(Battle.movementFor(battle, lion).has(4)).toBe(false)

    // A staged move frees the hex it leaves and blocks the one it enters, so a later move
    // in the same phase must be judged against it.
    const moves = new Map([[centaur.id, 10]])
    expect(Battle.movementFor(battle, lion, moves).has(4)).toBe(true)
    expect(Battle.movementFor(battle, lion, moves).has(10)).toBe(false)
  })

  it("lets a flying creature path through hexes blocked for grounded creatures, reaching further", () => {
    // Battle-hex 2 has only three neighbors (3, 7, 8); occupying both 7 and 8 seals off
    // everything past them for a grounded mover, since creatureMovementCost treats an
    // occupied hex as UNATTAINABLE for pathing (not just landing) unless flying - regardless
    // of which player occupies it. The blockers are on the SAME side as the movers (rather
    // than the enemy) so the movers aren't in contact with an enemy at phase start; movementFor
    // doesn't enforce rule 11.3 (in-contact creatures may not move - see the TODO on
    // movementFor in engine.ts), but this test isn't about that gap.
    const { battle, offense } = setupBattle(
      Terrain.PLAINS,
      [CreatureType.CENTAUR, CreatureType.GRIFFON, CreatureType.LION, CreatureType.LION],
      [CreatureType.CENTAUR],
    )
    Battle.finalizeMoves(battle, new Map()) // nobody engaged yet, so this auto-skips straight to ATTACKER_MOVE
    const [centaur, griffon, blocker1, blocker2] = offense
    centaur.hex = 2
    griffon.hex = 2
    blocker1.hex = 7
    blocker2.hex = 8

    const centaurReach = Battle.movementFor(battle, centaur)
    const griffonReach = Battle.movementFor(battle, griffon)
    expect(centaurReach).toEqual(new Set([3, 4, 9, 10, 14, 15, 16, 17, 20, 21, 22]))
    expect(griffonReach).toEqual(new Set([3, 4, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28]))
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
    battle.activePlayer = battle.attacker
    const [centaur] = offense
    const [lion] = defense
    centaur.hex = 15 // atop the cliff
    lion.hex = 20 // below the cliff

    expect(Battle.engagedWith(battle, lion)).toEqual([])
  })

  // TODO: engagedWith's cliff check is direction-asymmetric (see the TODO at engine.ts's
  // engagedWith). Per the Hazard Chart and rule 13.5, a cliff blocks engagement symmetrically -
  // neither creature should be engaged with the other. This documents the correct behavior and
  // is expected to fail (via it.fails) until that asymmetry is fixed.
  it("does not engage a creature atop a cliff with the creature below it", () => {
    const { battle, offense, defense } = setupBattle(Terrain.DESERT, [CreatureType.CENTAUR], [CreatureType.LION])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const [centaur] = offense
    const [lion] = defense
    centaur.hex = 15 // atop the cliff
    lion.hex = 20 // below the cliff

    expect(Battle.engagedWith(battle, centaur)).toEqual([])
  })

  it("excludes an engaged creature from carryover if the attacker cannot hit it at the toHit it just rolled", () => {
    // Terrain.TOWER's battle board has battle-hex 8 atop a wall edge from battle-hex 2,
    // which raises toHit by 1 for an attacker striking up through it.
    const { battle, offense, defense } = setupBattle(
      Terrain.TOWER,
      [CreatureType.LION],
      [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR],
    )
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const [lion] = offense
    const [primary, included, excluded] = defense
    lion.hex = 2
    primary.hex = 7 // toHit 5, no hazard - struck directly, overkilled
    included.hex = 3 // toHit 5, no hazard - matches the rolled toHit, so carryover-eligible
    excluded.hex = 8 // toHit 6, raised by the wall - harder than the rolled toHit

    Battle.attackCreature(battle, { attacker: lion.id, target: primary.id, rolls: [6, 6, 6, 6, 6] })
    expect(primary.strength - primary.wounds).toBe(0) // overkilled, so it drops out of engagedWith too
    expect(Battle.carryoverTargets(battle)).toEqual([included])
  })

  it("lets a strike choose a higher toHit than computed, but rejects a lower one", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const [lion] = offense
    const [centaur] = defense
    lion.hex = 8
    centaur.hex = 7

    const computedToHit = Battle.toHitAdjusted(battle, lion, centaur)
    expect(computedToHit).toBe(5)
    expect(() =>
      Battle.attackCreature(battle, {
        attacker: lion.id,
        target: centaur.id,
        rolls: [6, 6, 6, 6, 6],
        optionalToHit: computedToHit - 1,
      }),
    ).toThrow("Cannot choose a lower to-hit")

    Battle.attackCreature(battle, {
      attacker: lion.id,
      target: centaur.id,
      rolls: [6, 6, 6, 6, 6],
      optionalToHit: computedToHit + 1,
    })
    expect(battle.activeStrike?.toHit).toBe(computedToHit + 1)
    // A roll of 6 still clears the raised toHit of 6, so all 5 dice hit (capped at HP 3).
    expect(centaur.wounds).toBe(3)
  })

  it("resolves a rangestrike attack the same way as a melee strike, but never allows carryover", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.RANGER], [CreatureType.CENTAUR])
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const [ranger] = offense
    const [centaur] = defense
    ranger.hex = 8
    centaur.hex = 20

    const targets = Battle.rangestrikeTargets(battle, ranger)
    expect(targets).toHaveLength(1)
    // Ranger has strength 4, so per rule 12.2 (dice = floor(power / 2)) a rangestrike rolls
    // exactly 2 dice.
    expect(Battle.getRangestrike(ranger, targets[0]).dice).toBe(2)
    Battle.rangestrikeCreature(battle, {
      attacker: ranger.id,
      target: { ...targets[0], creature: targets[0].creature.id },
      rolls: [6, 6],
    })

    expect(ranger.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(2)
    expect(battle.activeStrike && ActiveStrike.isRangestrike(battle.activeStrike)).toBe(true)
    // overkilled, but rangestrikes never carry over
    expect(battle.activeStrike && ActiveStrike.getCarryoverHits(battle.activeStrike) > 0).toBe(false)
  })
})

describe("Battle phase transitions", () => {
  it("cycles through all six phases in order for a continuously-engaged pair, incrementing round only after defender strikeback", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.PLAINS, edge: HexEdge.FIRST, attacking, defending })
    const lion = getOffense(battle)[0]
    const centaur = getDefense(battle)[0]
    centaur.hex = 7
    lion.hex = 8

    const expectPhase = (phase: BattlePhase, round: number): void => {
      expect(battle.phase).toBe(phase)
      expect(battle.round).toBe(round)
    }
    expectPhase(BattlePhase.DEFENDER_MOVE, 0)

    Battle.finalizeMoves(battle, new Map())
    expectPhase(BattlePhase.DEFENDER_STRIKE, 0)
    centaur.hasStruck = true // stand in for an actual strike() call - only hasStruck matters here

    Battle.nextPhase(battle)
    expectPhase(BattlePhase.ATTACKER_STRIKEBACK, 0)
    lion.hasStruck = true

    Battle.nextPhase(battle)
    expectPhase(BattlePhase.ATTACKER_MOVE, 0)

    Battle.finalizeMoves(battle, new Map())
    expectPhase(BattlePhase.ATTACKER_STRIKE, 0)
    lion.hasStruck = true

    Battle.nextPhase(battle)
    expectPhase(BattlePhase.DEFENDER_STRIKEBACK, 0)
    centaur.hasStruck = true

    Battle.nextPhase(battle)
    expectPhase(BattlePhase.DEFENDER_MOVE, 1)
  })

  it("skips straight past strike and strikeback phases when nobody is engaged", () => {
    const { battle } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    Battle.finalizeMoves(battle, new Map()) // no engagement -> DEFENDER_STRIKE, ATTACKER_STRIKEBACK both skipped
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)
    Battle.finalizeMoves(battle, new Map()) // -> ATTACKER_STRIKE, DEFENDER_STRIKEBACK both skipped, round increments
    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    expect(battle.round).toBe(1)
  })

  it("throws if a phase is exited while an engaged, unstruck creature was never given a strike", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense
    centaur.hex = 7
    lion.hex = 8

    Battle.finalizeMoves(battle, new Map()) // -> DEFENDER_STRIKE, Centaur is now pending and never strikes
    expect(Battle.getPendingStrikes(battle)).toEqual([centaur])
    expect(() => Battle.nextPhase(battle)).toThrow("All eligible creatures must strike")
  })

  it("resets hasStruck for creatures on both sides whenever a strike phase is entered", () => {
    const { battle, offense, defense } = setupBattle(Terrain.PLAINS, [CreatureType.LION], [CreatureType.CENTAUR])
    const [lion] = offense
    const [centaur] = defense
    lion.hasStruck = true
    centaur.hasStruck = true

    Battle.phaseEnterStrike(battle)

    expect(lion.hasStruck).toBe(false)
    expect(centaur.hasStruck).toBe(false)
  })

  it("removes a creature still in its entrance zone when its move phase ends, but not one that has moved onto the board", () => {
    const { battle, defense } = setupBattle(
      Terrain.PLAINS,
      [CreatureType.LION],
      [CreatureType.CENTAUR, CreatureType.CENTAUR],
    )
    const [unmoved, moved] = defense
    expect(unmoved.hex).toBe(36) // the defender's entrance zone for HexEdge.FIRST

    Battle.finalizeMoves(battle, new Map([[moved.id, 7]]))

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
    centaur.hex = 7

    expect(centaur.wounds).toBe(0)
    battle.phase = BattlePhase.DEFENDER_STRIKE
    battle.activePlayer = battle.defender
    Battle.phaseEnterStrike(battle)
    expect(centaur.wounds).toBe(1)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    Battle.phaseEnterStrike(battle)
    expect(centaur.wounds).toBe(2)
  })
})
