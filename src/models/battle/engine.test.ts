import { describe, expect, it } from "vitest"
import { CREATURE_DATA, CreatureType } from "~/models/creature"
import { HexEdge, Terrain } from "~/models/masterboard"
import { PlayerId } from "~/models/player"
import { UNATTAINABLE_MOVEMENT_COST } from "./board"
import { Battle, BattleSide } from "./engine"
import { BattlePhase } from "./strike"

describe("Battle engagement", () => {
  it("starts with no engagements or pending strikes before anyone has moved", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    expect(battle.getPendingStrikes()).toEqual([])
    expect(battle.engagedWith(battle.getDefense()[0])).toEqual([])
  })

  it("moves into contact, resolves a strike, and inflicts casualties", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const lion = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]

    // Defender moves first each round; hex 7 is within the Centaur's reach from its
    // entrance and adjacent to hex 8, which the Lion can reach on its own move.
    expect(battle.movementFor(centaur).has(7)).toBe(true)
    centaur.hex = 7
    // Nothing is on the board to engage yet, so strike/strikeback for both sides
    // are auto-skipped straight through to the attacker's move.
    battle.nextPhase()
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)

    expect(battle.movementFor(lion).has(8)).toBe(true)
    lion.hex = 8
    battle.nextPhase()
    expect(battle.phase).toBe(BattlePhase.ATTACKER_STRIKE)
    expect(battle.engagedWith(lion)).toEqual([centaur])
    expect(battle.getPendingStrikes()).toEqual([lion])

    const toHit = battle.toHitAdjusted(lion, centaur)
    expect(toHit).toBe(5) // 4 - (lion skill 3 - centaur skill 4), no terrain adjustment
    battle.strike(lion, centaur, [6, 6, 6, 6, 6])

    expect(lion.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(3) // Centaur's full strength (3); capped, not overkill
    expect(centaur.getRemainingHp()).toBe(0)
    expect(centaur.hex).toBe(7) // corpses stay on the board until phaseExitStrikeback
  })

  it("computes to-hit purely from the skill difference on hazard-free terrain", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.OGRE] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.TROLL] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const ogre = battle.getOffense()[0]
    const troll = battle.getDefense()[0]

    // Ogre skill 2, Troll skill 2 -> even matchup
    expect(battle.toHitRaw(ogre, troll)).toBe(4)
    expect(battle.toHitAdjusted(ogre, troll)).toBe(4)
  })
})

describe("Rangestrike targets", () => {
  // Ranger (skill 4, strength 4) placed at battle-hex 8 on the plains board, with no
  // other creature adjacent so it is never itself engaged.
  function setupRanger(attackerType: CreatureType, targetHex: number): {
    battle: Battle
    attacker: ReturnType<Battle["getOffense"]>[number]
    target: ReturnType<Battle["getDefense"]>[number]
  } {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [attackerType] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const attacker = battle.getOffense()[0]
    const target = battle.getDefense()[0]
    attacker.hex = 8
    attacker.initialHex = 8
    target.hex = targetHex
    target.initialHex = targetHex
    return { battle, attacker, target }
  }

  it("finds a near-range target with no adjustment", () => {
    const { battle, attacker, target } = setupRanger(CreatureType.RANGER, 20)

    const targets = battle.rangestrikeTargets(attacker)
    expect(targets).toHaveLength(1)
    expect(targets[0].creature).toBe(target)
    expect(targets[0].longDistance).toBe(false)
    expect(targets[0].adjustment).toEqual({ toHit: 0, dice: 0 })
    expect(battle.getRangestrike(attacker, targets[0])).toEqual({ toHit: 4, dice: 2 })
  })

  it("reaches an extended-range target (skill 4) with a long-distance to-hit penalty", () => {
    const { battle, attacker } = setupRanger(CreatureType.RANGER, 26)

    const targets = battle.rangestrikeTargets(attacker)
    expect(targets).toHaveLength(1)
    expect(targets[0].longDistance).toBe(true)
    expect(battle.getRangestrike(attacker, targets[0])).toEqual({ toHit: 5, dice: 2 })
  })

  it("cannot reach the extended range with a skill-3 rangestriker (Hydra)", () => {
    // Same targetHex 26 is reachable at long range by a skill-4 Ranger (above) but not
    // by a skill-3 Hydra, which only gets near-range paths.
    const { battle: nearBattle, attacker: hydraNear } = setupRanger(CreatureType.HYDRA, 20)
    expect(nearBattle.rangestrikeTargets(hydraNear)).toHaveLength(1)

    const { battle: farBattle, attacker: hydraFar } = setupRanger(CreatureType.HYDRA, 26)
    expect(farBattle.rangestrikeTargets(hydraFar)).toEqual([])
  })

  it("finds no targets when nothing is within rangestrike distance", () => {
    const { battle, attacker } = setupRanger(CreatureType.RANGER, 32)
    expect(battle.rangestrikeTargets(attacker)).toEqual([])
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

  it("assigns overflow hits from an overkill strike to another engaged target", () => {
    const { battle, lion, centaur1, centaur2 } = setupTripleEngagement()

    battle.strike(lion, centaur1, [6, 6, 6, 6, 6])
    expect(centaur1.getRemainingHp()).toBe(0)
    expect(battle.activeStrike?.canCarryover).toBe(true)
    // getCarryoverHits = 5 total hits - 3 assigned to centaur1
    expect(battle.activeStrike?.getCarryoverHits()).toBe(2)
    expect(battle.carryoverTargets()).toEqual([centaur2])

    battle.carryover(centaur2)
    expect(centaur2.wounds).toBe(2)
    expect(battle.activeStrike?.canCarryover).toBe(false) // no hits left to carry over
  })

  it("stops carryover once skipCarryover is called", () => {
    const { battle, lion, centaur1 } = setupTripleEngagement()

    battle.strike(lion, centaur1, [6, 6, 6, 6, 6])
    expect(battle.activeStrike?.canCarryover).toBe(true)

    battle.activeStrike?.skipCarryover()

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
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const lion = battle.getOffense()[0]
    lion.initialHex = 0

    expect(battle.movementFor(lion)).toEqual(new Set())
  })

  it("reaches exactly the hexes affordable within a creature's skill, on hazard-free terrain", () => {
    // Ogre (skill 2) entering from battle-hex 37 (the attacker's entrance zone on
    // HexEdge.FIRST), on hazard-free Plains: every hex within 2 movement points.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.OGRE] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_MOVE
    const ogre = battle.getOffense()[0]
    expect(ogre.initialHex).toBe(37)

    expect(battle.movementFor(ogre)).toEqual(new Set([3, 4, 9, 10, 16, 17, 22, 23, 29]))
  })

  it("cannot land a stack on a hex already occupied by another creature (friend or foe)", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_MOVE
    const lion = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    centaur.hex = 4
    centaur.initialHex = 4

    expect(battle.movementFor(lion).has(4)).toBe(false)
  })

  it("lets a flying creature path through hexes blocked for grounded creatures, reaching further", () => {
    // Battle-hex 2 has only three neighbors (3, 7, 8); occupying both 7 and 8 seals off
    // everything past them for a grounded mover, since creatureMovementCost treats an
    // occupied non-own hex as UNATTAINABLE for pathing (not just landing) unless flying.
    const attacking: BattleSide = {
      player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR, CreatureType.GRIFFON]
    }
    const defending: BattleSide = {
      player: PlayerId.BLUE, score: 0, creatures: [CreatureType.LION, CreatureType.LION]
    }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_MOVE
    const [centaur, griffon] = battle.getOffense()
    const [blocker1, blocker2] = battle.getDefense()
    centaur.hex = 2
    centaur.initialHex = 2
    griffon.hex = 2
    griffon.initialHex = 2
    blocker1.hex = 7
    blocker1.initialHex = 7
    blocker2.hex = 8
    blocker2.initialHex = 8

    const centaurReach = battle.movementFor(centaur)
    const griffonReach = battle.movementFor(griffon)
    expect(centaurReach).toEqual(new Set([3, 4, 9, 10, 14, 15, 16, 17, 20, 21, 22]))
    expect(griffonReach).toEqual(new Set([
      3, 4, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28
    ]))
    // Every hex the grounded Centaur can still reach (via hex 3), the flying Griffon can too.
    centaurReach.forEach(hex => expect(griffonReach.has(hex)).toBe(true))
  })
})

describe("Engagement edge cases", () => {
  it("makes engagement across a cliff direction-dependent: the creature atop it is engaged, the one below is not", () => {
    // Terrain.DESERT's battle board has a cliff edge between battle-hexes 15 and 20.
    // engagedWith checks getEdgeHazard(whom.hex, candidate.hex), which is keyed by
    // (lower, upper) - so the check only fires from one side.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.LION] }
    const battle = new Battle(Terrain.DESERT, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const centaur = battle.getOffense()[0]
    const lion = battle.getDefense()[0]
    centaur.hex = 15 // atop the cliff
    centaur.initialHex = 15
    lion.hex = 20 // below the cliff
    lion.initialHex = 20

    expect(battle.engagedWith(centaur)).toEqual([lion])
    expect(battle.engagedWith(lion)).toEqual([])
  })

  it("checks engagement using the pre-move position while still in a move phase", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getDefense()[0]

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    centaur.hex = 7 // now adjacent to where the Lion will eventually stand (hex 8)
    // Still using centaur.initialHex (the entrance zone) for the engagement check, since
    // we haven't left the move phase - the newly-occupied hex 7 has no bearing yet.
    expect(battle.engagedWith(centaur)).toEqual([])
  })

  it("excludes an engaged creature from carryover if the attacker cannot hit it at the toHit it just rolled", () => {
    // Terrain.TOWER's battle board has battle-hex 8 atop a wall edge from battle-hex 2,
    // which raises toHit by 1 for an attacker striking up through it.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = {
      player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR, CreatureType.CENTAUR]
    }
    const battle = new Battle(Terrain.TOWER, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const lion = battle.getOffense()[0]
    const [primary, included, excluded] = battle.getDefense()
    lion.hex = 2
    lion.initialHex = 2
    primary.hex = 7 // toHit 5, no hazard - struck directly, overkilled
    primary.initialHex = 7
    included.hex = 3 // toHit 5, no hazard - matches the rolled toHit, so carryover-eligible
    included.initialHex = 3
    excluded.hex = 8 // toHit 6, raised by the wall - harder than the rolled toHit
    excluded.initialHex = 8

    expect(battle.toHitAdjusted(lion, primary)).toBe(5)
    expect(battle.toHitAdjusted(lion, included)).toBe(5)
    expect(battle.toHitAdjusted(lion, excluded)).toBe(6)

    battle.strike(lion, primary, [6, 6, 6, 6, 6])
    expect(primary.getRemainingHp()).toBe(0) // overkilled, so it drops out of engagedWith too
    expect(battle.carryoverTargets()).toEqual([included])
  })

  it("lets a strike choose a higher toHit than computed, but rejects a lower one", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const lion = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    lion.hex = 8
    lion.initialHex = 8
    centaur.hex = 7
    centaur.initialHex = 7

    const computedToHit = battle.toHitAdjusted(lion, centaur)
    expect(computedToHit).toBe(5)
    expect(() => battle.strike(lion, centaur, [6, 6, 6, 6, 6], computedToHit - 1))
      .toThrow("Cannot choose a lower to-hit")

    battle.strike(lion, centaur, [6, 6, 6, 6, 6], computedToHit + 1)
    expect(battle.activeStrike?.toHit).toBe(computedToHit + 1)
    // A roll of 6 still clears the raised toHit of 6, so all 5 dice hit (capped at HP 3).
    expect(centaur.wounds).toBe(3)
  })

  it("resolves a rangestrike attack the same way as a melee strike, but never allows carryover", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    const ranger = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    ranger.hex = 8
    ranger.initialHex = 8
    centaur.hex = 20
    centaur.initialHex = 20

    const targets = battle.rangestrikeTargets(ranger)
    expect(targets).toHaveLength(1)
    battle.rangestrike(ranger, targets[0], [6, 6, 6, 6])

    expect(ranger.hasStruck).toBe(true)
    expect(centaur.wounds).toBe(3) // capped at Centaur's full strength
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

    battle.nextPhase()
    expectPhase(BattlePhase.DEFENDER_STRIKE, 0)
    centaur.performStrike() // stand in for an actual strike() call - only hasStruck matters here

    battle.nextPhase()
    expectPhase(BattlePhase.ATTACKER_STRIKEBACK, 0)
    lion.performStrike()

    battle.nextPhase()
    expectPhase(BattlePhase.ATTACKER_MOVE, 0)

    battle.nextPhase()
    expectPhase(BattlePhase.ATTACKER_STRIKE, 0)
    lion.performStrike()

    battle.nextPhase()
    expectPhase(BattlePhase.DEFENDER_STRIKEBACK, 0)
    centaur.performStrike()

    battle.nextPhase()
    expectPhase(BattlePhase.DEFENDER_MOVE, 1)
  })

  it("skips straight past strike and strikeback phases when nobody is engaged", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    battle.nextPhase() // no engagement -> DEFENDER_STRIKE, ATTACKER_STRIKEBACK both skipped
    expect(battle.phase).toBe(BattlePhase.ATTACKER_MOVE)
    battle.nextPhase() // -> ATTACKER_STRIKE, DEFENDER_STRIKEBACK both skipped, round increments
    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    expect(battle.round).toBe(1)
  })

  it("throws if a phase is exited while an engaged, unstruck creature was never given a strike", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getDefense()[0]
    centaur.hex = 7
    centaur.initialHex = 7
    battle.getOffense()[0].hex = 8
    battle.getOffense()[0].initialHex = 8

    battle.nextPhase() // -> DEFENDER_STRIKE, Centaur is now pending and never strikes
    expect(battle.getPendingStrikes()).toEqual([centaur])
    expect(() => battle.nextPhase()).toThrow("All eligible creatures must strike")
  })

  it("resets hasStruck for creatures on both sides whenever a strike phase is entered", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const lion = battle.getOffense()[0]
    const centaur = battle.getDefense()[0]
    lion.hasStruck = true
    centaur.hasStruck = true

    battle.phaseEnterStrike()

    expect(lion.hasStruck).toBe(false)
    expect(centaur.hasStruck).toBe(false)
  })

  it("removes a creature from the battle if it is still in its entrance zone when its move phase ends", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getDefense()[0]

    expect(centaur.hex).toBe(36) // the defender's entrance zone for HexEdge.FIRST
    battle.phaseExitMove()
    expect(centaur.hex).toBe(0)
  })

  it("does not remove a creature that has moved onto the battle board proper", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getDefense()[0]
    centaur.hex = 7

    battle.phaseExitMove()
    expect(centaur.hex).toBe(7)
  })

  it("wounds creatures on drift terrain again on every strike-phase entry, not just once per round", () => {
    // Terrain.TUNDRA's battle board has a drift hazard at battle-hex 7. phaseEnterStrike
    // applies the drift wound unconditionally on every entry into a STRIKE-type phase,
    // so a creature that survives both the defender's and attacker's strike phases in
    // the same round is wounded twice.
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(Terrain.TUNDRA, HexEdge.FIRST, attacking, defending)
    const centaur = battle.getDefense()[0]
    centaur.hex = 7
    centaur.initialHex = 7

    expect(centaur.wounds).toBe(0)
    battle.phase = BattlePhase.DEFENDER_STRIKE
    battle.phaseEnterStrike()
    expect(centaur.wounds).toBe(1)
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.phaseEnterStrike()
    expect(centaur.wounds).toBe(2)
  })
})
