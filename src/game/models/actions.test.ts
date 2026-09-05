import { describe, expect, it } from "vitest"
import { assert } from "@/utils/assert"
import { ActiveStrike, Battle, BattleCreature, BattlePhase, BattleSide } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { HexEdge, Terrain } from "@/models/masterboard"
import { Random } from "@/models/random"
import { Stack } from "@/models/stack"
import { dispatch } from "./actions"
import { MasterboardPhase, TitanGame } from "./game"

function seededRandom(...rolls: number[]): Random {
  const remaining = [...rolls]
  return {
    shuffle: collection => [...collection],
    die: () => {
      const roll = remaining.shift()
      if (roll === undefined) {
        throw new Error("Rolled more dice than the test seeded")
      }
      return roll
    },
  }
}

function newGame(numPlayers = 2): TitanGame {
  return TitanGame.create(numPlayers, seededRandom())
}

function newEngagedBattleGame(): {
  game: TitanGame
  lion: BattleCreature
  centaur1: BattleCreature
  centaur2: BattleCreature
} {
  const game = newGame()
  const attacking: BattleSide = { player: game.players[0].id, score: 0, creatures: [CreatureType.LION] }
  const defending: BattleSide = {
    player: game.players[1].id,
    score: 0,
    creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
  }
  const battle = Battle.create({ terrain: Terrain.PLAINS, edge: HexEdge.FIRST, attacking, defending })
  battle.phase = BattlePhase.ATTACKER_STRIKE
  battle.activePlayer = battle.attacker
  const lion = battle.creatures.find(c => c.type === CreatureType.LION)!
  const [centaur1, centaur2] = battle.creatures.filter(c => c.type === CreatureType.CENTAUR)
  lion.hex = 8
  centaur1.hex = 7
  centaur2.hex = 9
  game.activeBattle = battle
  game.activePhase = MasterboardPhase.BATTLE
  return { game, lion, centaur1, centaur2 }
}

describe("dispatch", () => {
  it("masterboard/finalizeSplits: rolls movement from the injected Random, not the default", () => {
    const game = newGame()
    const payload = [{ stack: game.stacks[0].id, creatures: [0, 2, 4, 6] }]

    dispatch(game, { type: "masterboard/finalizeSplits", payload }, seededRandom(4))

    expect(game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(game.activeRoll).toBe(4)
  })

  it("masterboard/finalizeSplits: propagates TitanGame.finalizeSplits' validation errors", () => {
    const game = newGame()
    const payload = [
      { stack: game.stacks[0].id, creatures: [0, 2, 4, 6] },
      { stack: game.stacks[1].id, creatures: [0, 2, 4, 6] },
    ]

    expect(() => dispatch(game, { type: "masterboard/finalizeSplits", payload }, seededRandom(4))).toThrow(
      "does not own",
    )
  })

  it("masterboard/takeMulligan: rolls from the injected Random, not the default", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 3

    dispatch(game, { type: "masterboard/takeMulligan" }, seededRandom(5))

    expect(game.activeRoll).toBe(5)
    expect(game.mulliganTaken).toBe(true)
  })

  it("masterboard/finalizeMoves: converts the payload array into the Map TitanGame.finalizeMoves expects", () => {
    const game = newGame()
    const attacker = game.stacks[0]
    const defender = game.stacks[1]
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    dispatch(game, {
      type: "masterboard/finalizeMoves",
      payload: [{ stack: attacker.id, hex: defender.hex, edge: HexEdge.FIRST }],
    })

    expect(attacker.hex).toBe(defender.hex)
    expect(attacker.attackEdge).toBe(HexEdge.FIRST)
    expect(game.activePhase).toBe(MasterboardPhase.BATTLE)
  })

  it("masterboard/initiateBattle: refuses outside the battle phase", () => {
    const game = newGame()

    expect(() => dispatch(game, { type: "masterboard/initiateBattle", payload: game.stacks[0].id })).toThrow(
      "Action requires the BATTLE phase",
    )
  })

  it("masterboard/initiateBattle: delegates to TitanGame.initiateBattle in the battle phase", () => {
    const game = newGame()
    const attacker = game.stacks[0]
    const defender = game.stacks[1]
    attacker.hex = defender.hex
    attacker.attackEdge = HexEdge.FIRST
    game.activePhase = MasterboardPhase.BATTLE

    dispatch(game, { type: "masterboard/initiateBattle", payload: attacker.id })

    expect(game.activeBattleHex).toBe(defender.hex)
    expect(game.activeBattle?.defender).toBe(defender.owner)
  })

  it("masterboard/finalizeMusters: delegates to TitanGame.finalizeMusters", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.activePlayerId,
      hex: 100,
      marker: 1,
      createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    stack.hasMoved = true
    game.stacks.push(stack)
    game.activePhase = MasterboardPhase.MUSTER

    dispatch(game, {
      type: "masterboard/finalizeMusters",
      payload: [
        {
          stack: stack.id,
          recruit: { creature: CreatureType.LION, basis: { creature: CreatureType.CENTAUR, count: 2 } },
        },
      ],
    })

    expect(stack.creatures).toContain(CreatureType.LION)
  })

  it("battle/finalizeMoves: converts the payload array into the Map Battle.finalizeMoves expects", () => {
    const { game, lion } = newEngagedBattleGame()
    game.activeBattle!.phase = BattlePhase.ATTACKER_MOVE

    dispatch(game, { type: "battle/finalizeMoves", payload: [{ creature: lion.id, hex: 9 }] })

    expect(lion.hex).toBe(9)
  })

  it("battle/endStrikes: delegates to Battle.nextPhase", () => {
    const { game, lion, centaur1 } = newEngagedBattleGame()
    dispatch(
      game,
      { type: "battle/attackCreature", payload: { attacker: lion.id, target: centaur1.id } },
      seededRandom(1, 1, 1, 1, 1),
    )

    dispatch(game, { type: "battle/endStrikes" })

    expect(game.activeBattle!.phase).not.toBe(BattlePhase.ATTACKER_STRIKE)
  })

  it.each([
    { label: "at the to-hit terrain and skill give", optionalToHit: undefined, expectedToHit: 5 },
    { label: "at a to-hit the attacker raised", optionalToHit: 6, expectedToHit: 6 },
  ])("battle/attackCreature: rolls the attacker's dice $label", ({ optionalToHit, expectedToHit }) => {
    const { game, lion, centaur1 } = newEngagedBattleGame()

    dispatch(
      game,
      { type: "battle/attackCreature", payload: { attacker: lion.id, target: centaur1.id, optionalToHit } },
      seededRandom(6, 5, 4, 3, 2),
    )

    expect(game.activeBattle!.activeStrike?.rolls).toEqual([6, 5, 4, 3, 2])
    expect(game.activeBattle!.activeStrike?.toHit).toBe(expectedToHit)
  })

  it("battle/rangestrikeCreature: rolls the rangestriker's dice", () => {
    const game = newGame()
    const attacking: BattleSide = { player: game.players[0].id, score: 0, creatures: [CreatureType.RANGER] }
    const defending: BattleSide = { player: game.players[1].id, score: 0, creatures: [CreatureType.CENTAUR] }
    const battle = Battle.create({ terrain: Terrain.PLAINS, edge: HexEdge.FIRST, attacking, defending })
    battle.phase = BattlePhase.ATTACKER_STRIKE
    battle.activePlayer = battle.attacker
    const ranger = battle.creatures.find(c => c.type === CreatureType.RANGER)!
    const target = battle.creatures.find(c => c.type === CreatureType.CENTAUR)!
    ranger.hex = 8
    target.hex = 20
    game.activeBattle = battle
    game.activePhase = MasterboardPhase.BATTLE
    const [rangestrikeTarget] = Battle.rangestrikeTargets(battle, ranger)

    dispatch(
      game,
      {
        type: "battle/rangestrikeCreature",
        payload: { attacker: ranger.id, target: { ...rangestrikeTarget, creature: target.id } },
      },
      seededRandom(6, 3),
    )

    expect(game.activeBattle!.activeStrike?.rolls).toEqual([6, 3])
    expect(game.activeBattle!.activeStrike?.toHit).toBe(4)
  })

  it("battle/commitCarryover: assigns hits to the listed targets in order, then forfeits the rest", () => {
    const { game, lion, centaur1, centaur2 } = newEngagedBattleGame()
    centaur1.wounds = 2
    centaur2.wounds = 2

    dispatch(
      game,
      { type: "battle/attackCreature", payload: { attacker: lion.id, target: centaur1.id } },
      seededRandom(6, 6, 6, 1, 1),
    )

    dispatch(game, { type: "battle/commitCarryover", payload: [centaur2.id] })

    const activeStrike = game.activeBattle!.activeStrike
    assert(activeStrike !== undefined && !ActiveStrike.isRangestrike(activeStrike), "Expected a melee strike")
    expect(centaur2.wounds).toBe(3)
    expect(activeStrike.carryoverSkipped).toBe(true)
  })

  it("throws when a battle action is dispatched with no active battle", () => {
    const game = newGame()

    expect(() => dispatch(game, { type: "battle/endStrikes" })).toThrow("No active battle")
  })
})
