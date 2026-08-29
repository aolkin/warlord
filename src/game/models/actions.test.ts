import { describe, expect, it } from "vitest"
import { CreatureType } from "@/models/creature"
import { HexEdge } from "@/models/masterboard"
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
})
