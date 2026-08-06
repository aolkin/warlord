import { describe, expect, it } from "vitest"
import { CreatureType } from "~/models/creature"
import { HexEdge, Terrain } from "~/models/masterboard"
import { PlayerId } from "~/models/player"
import { UNATTAINABLE_MOVEMENT_COST } from "./board"
import { Battle, BattleSide } from "./engine"
import { BattlePhase } from "./strike"

const PLAINS_TERRAIN = Terrain.PLAINS

describe("Battle engagement", () => {
  it("starts with no engagements or pending strikes before anyone has moved", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(PLAINS_TERRAIN, HexEdge.FIRST, attacking, defending)

    expect(battle.phase).toBe(BattlePhase.DEFENDER_MOVE)
    expect(battle.getPendingStrikes()).toEqual([])
    expect(battle.engagedWith(battle.getDefense()[0])).toEqual([])
  })

  it("moves into contact, resolves a strike, and inflicts casualties", () => {
    const attacking: BattleSide = { player: PlayerId.RED, score: 0, creatures: [CreatureType.LION] }
    const defending: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = new Battle(PLAINS_TERRAIN, HexEdge.FIRST, attacking, defending)
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
    const battle = new Battle(PLAINS_TERRAIN, HexEdge.FIRST, attacking, defending)
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
    const battle = new Battle(PLAINS_TERRAIN, HexEdge.FIRST, attacking, defending)
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
    const battle = new Battle(PLAINS_TERRAIN, HexEdge.FIRST, attacking, defending)
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
})
