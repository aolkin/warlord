import { omit } from "lodash-es"
import { describe, expect, it } from "vitest"
import { Battle, BattleCreature, BattlePhase, BattleSide } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { HexEdge, Terrain } from "@/models/masterboard"
import { Random } from "@/models/random"
import { MusterChoice, Stack } from "@/models/stack"
import { dispatch, GameAction } from "./actions"
import { MasterboardPhase, TitanGame } from "./game"

// Hands out the listed rolls in order, so a test knows what dispatch will roll.
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

// Both branches start from a clone of the same game, so ids already present in it line
// up. Neither branch may mint new ids (Stack.create/BattleCreature.create) itself, or
// the two clones would diverge purely from allocation order.
function expectDispatchMatchesDirectCall(
  game: TitanGame,
  action: GameAction,
  direct: (game: TitanGame) => void,
  random: Random = seededRandom(),
): void {
  const viaDirect = structuredClone(game)
  direct(viaDirect)

  const viaDispatch = structuredClone(game)
  dispatch(viaDispatch, action, random)

  expect(viaDispatch).toEqual(viaDirect)
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
  lion.initialHex = 8
  centaur1.hex = 7
  centaur1.initialHex = 7
  centaur2.hex = 9
  centaur2.initialHex = 9
  game.activeBattle = battle
  game.activePhase = MasterboardPhase.BATTLE
  return { game, lion, centaur1, centaur2 }
}

describe("dispatch", () => {
  it("masterboard/finalizeSplits: splits off the submitted creatures and rolls for movement", () => {
    const game = newGame()
    const original = game.stacks[0]

    const viaDirect = structuredClone(game)
    ;[0, 2, 4, 6].forEach(index => {
      viaDirect.stacks[0].split[index] = true
    })
    TitanGame.nextPhase(viaDirect)
    TitanGame.setRoll(viaDirect, 4)

    const viaDispatch = structuredClone(game)
    dispatch(
      viaDispatch,
      { type: "masterboard/finalizeSplits", payload: [{ stack: original.id, creatures: [0, 2, 4, 6] }] },
      seededRandom(4),
    )

    // Each branch mints its own id for the stack it splits off, from a counter they share.
    expect(withoutStackIds(viaDispatch)).toEqual(withoutStackIds(viaDirect))
    expect(viaDispatch.activePhase).toBe(MasterboardPhase.MOVE)
    expect(viaDispatch.activeRoll).toBe(4)
  })

  it("masterboard/finalizeSplits: leaves a stack out of the submission unsplit", () => {
    const game = newGame()
    // Flags a client set while staging, which the submission overrides.
    ;[0, 2, 4, 6].forEach(index => {
      game.stacks[0].split[index] = true
    })

    dispatch(game, { type: "masterboard/finalizeSplits", payload: [] }, seededRandom(4))

    expect(game.stacks).toHaveLength(2)
    expect(game.stacks[0].creatures).toHaveLength(8)
  })

  it("masterboard/finalizeSplits: refuses a split submitted for a stack the active player does not own", () => {
    const game = newGame()
    const payload = [{ stack: game.stacks[1].id, creatures: [0, 2, 4, 6] }]

    expect(() => dispatch(game, { type: "masterboard/finalizeSplits", payload }, seededRandom(4))).toThrow(
      "does not own",
    )
  })

  it("masterboard/rerollMove: takes the mulligan and rolls again", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 3

    expectDispatchMatchesDirectCall(
      game,
      { type: "masterboard/rerollMove" },
      g => {
        TitanGame.setRoll(g, undefined)
        TitanGame.setRoll(g, 5)
      },
      seededRandom(5),
    )
  })

  it("masterboard/rerollMove: refuses a second mulligan", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 3
    game.mulliganTaken = true

    expect(() => dispatch(game, { type: "masterboard/rerollMove" }, seededRandom(5))).toThrow("Mulligan unavailable")
  })

  it("masterboard/finalizeMoves: applies the submitted moves and musters when nobody is engaged", () => {
    const game = newGame() // BLUE at 100, GREEN at 400: never in contact
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    dispatch(game, { type: "masterboard/finalizeMoves", payload: [{ stack: game.stacks[0].id, hex: 3 }] })

    expect(game.stacks[0].hex).toBe(3)
    expect(game.activeRoll).toBeUndefined()
    expect(game.activePhase).toBe(MasterboardPhase.MUSTER)
  })

  it("masterboard/finalizeMoves: enters the battle phase with no battle open", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const move = { stack: game.stacks[0].id, hex: game.stacks[1].hex, edge: HexEdge.FIRST }

    dispatch(game, { type: "masterboard/finalizeMoves", payload: [move] })

    expect(game.activePhase).toBe(MasterboardPhase.BATTLE)
    expect(game.activeBattle).toBeUndefined()
  })

  it("masterboard/initiateBattle: opens each engagement in the order it is dispatched", () => {
    const game = newGame(3) // BLUE @ 100, GREEN @ 300, RED @ 500
    const sibling = Stack.create({
      owner: game.players[0].id,
      hex: game.stacks[0].hex,
      marker: 1,
      createdRound: game.round,
    })
    game.stacks.push(sibling)
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    dispatch(game, {
      type: "masterboard/finalizeMoves",
      payload: [
        { stack: game.stacks[0].id, hex: game.stacks[1].hex, edge: HexEdge.FIRST },
        { stack: sibling.id, hex: game.stacks[2].hex, edge: HexEdge.SECOND },
      ],
    })

    dispatch(game, { type: "masterboard/initiateBattle", payload: sibling.id })
    expect(game.activeBattleHex).toBe(game.stacks[2].hex)
    expect(game.activeBattle?.defender).toBe(game.players[2].id)

    dispatch(game, { type: "masterboard/initiateBattle", payload: game.stacks[0].id })
    expect(game.activeBattleHex).toBe(game.stacks[1].hex)
    expect(game.activeBattle?.defender).toBe(game.players[1].id)
  })

  it("masterboard/finalizeMusters: matches recruiting each stack and ending the phase", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id,
      hex: 100,
      marker: 1,
      createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    stack.hex = 101 // moved, so eligible to muster
    game.stacks.push(stack)
    game.activePhase = MasterboardPhase.MUSTER
    const recruit: MusterChoice = [CreatureType.LION, [CreatureType.CENTAUR, 2]]

    expectDispatchMatchesDirectCall(
      game,
      { type: "masterboard/finalizeMusters", payload: [{ stack: stack.id, recruit }] },
      g => {
        TitanGame.setRecruit(g, { stack: stack.id, recruit })
        TitanGame.nextPhase(g)
      },
    )
  })

  it("masterboard/finalizeMusters: leaves a stack out of the submission unmustered", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id,
      hex: 100,
      marker: 1,
      createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR],
    })
    stack.hex = 101
    // A choice a client made while staging, which the submission overrides.
    stack.currentMuster = [CreatureType.LION, [CreatureType.CENTAUR, 2]]
    game.stacks.push(stack)
    game.activePhase = MasterboardPhase.MUSTER

    dispatch(game, { type: "masterboard/finalizeMusters", payload: [] })

    expect(stack.creatures).toEqual([CreatureType.CENTAUR, CreatureType.CENTAUR])
  })

  it("battle/finalizeMoves: matches moving each creature and ending the phase", () => {
    const { game, centaur1 } = newEngagedBattleGame()
    game.activeBattle!.phase = BattlePhase.DEFENDER_MOVE
    game.activeBattle!.activePlayer = game.activeBattle!.defender
    const move = { creature: centaur1.id, hex: 21 } // reachable from centaur1's entrance hex

    expectDispatchMatchesDirectCall(game, { type: "battle/finalizeMoves", payload: [move] }, g => {
      Battle.moveCreature(g.activeBattle!, move)
      Battle.nextPhase(g.activeBattle!)
    })
  })

  it("battle/endStrikes: matches ending the strike phase", () => {
    const { game, lion, centaur1 } = newEngagedBattleGame()
    Battle.attackCreature(game.activeBattle!, { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })

    expectDispatchMatchesDirectCall(game, { type: "battle/endStrikes" }, g => {
      Battle.nextPhase(g.activeBattle!)
    })
  })

  it("battle/endStrikes: refuses to end a movement phase", () => {
    const { game } = newEngagedBattleGame()
    game.activeBattle!.phase = BattlePhase.DEFENDER_MOVE

    expect(() => dispatch(game, { type: "battle/endStrikes" })).toThrow("Not in a strike phase")
  })

  it.each([
    { label: "at the to-hit terrain and skill give", optionalToHit: undefined },
    { label: "at a to-hit the attacker raised", optionalToHit: 6 },
  ])("battle/attackCreature: rolls the attacker's dice $label", ({ optionalToHit }) => {
    const { game, lion, centaur1 } = newEngagedBattleGame()
    const request = { attacker: lion.id, target: centaur1.id, optionalToHit }

    expectDispatchMatchesDirectCall(
      game,
      { type: "battle/attackCreature", payload: request },
      g => {
        // The lion's strength is its dice count, unadjusted on plains.
        Battle.attackCreature(g.activeBattle!, { ...request, rolls: [6, 5, 4, 3, 2] })
      },
      seededRandom(6, 5, 4, 3, 2),
    )
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
    ranger.initialHex = 8
    target.hex = 20 // near-range rangestrike target, per Battle.rangestrikeTargets
    target.initialHex = 20
    game.activeBattle = battle
    game.activePhase = MasterboardPhase.BATTLE
    const [rangestrikeTarget] = Battle.rangestrikeTargets(battle, ranger)
    const request = { attacker: ranger.id, target: { ...rangestrikeTarget, creature: target.id } }

    expectDispatchMatchesDirectCall(
      game,
      { type: "battle/rangestrikeCreature", payload: request },
      g => {
        // Half the ranger's strength, rounded down, is its rangestrike dice count.
        Battle.rangestrikeCreature(g.activeBattle!, { ...request, rolls: [6, 3] })
      },
      seededRandom(6, 3),
    )
  })

  it.each([
    { label: "wounds the listed targets in order", targets: true, expectedWounds: 2 },
    { label: "forfeits the excess hits when nothing is listed", targets: false, expectedWounds: 0 },
  ])("battle/commitCarryover: $label", ({ targets, expectedWounds }) => {
    const { game, lion, centaur1, centaur2 } = newEngagedBattleGame()
    // Five hits on a three-wound centaur leave two to carry over.
    dispatch(
      game,
      { type: "battle/attackCreature", payload: { attacker: lion.id, target: centaur1.id } },
      seededRandom(6, 6, 6, 6, 6),
    )

    dispatch(game, { type: "battle/commitCarryover", payload: targets ? [centaur2.id] : [] })

    expect(game.activeBattle!.creatures.find(c => c.id === centaur2.id)!.wounds).toBe(expectedWounds)
    expect(Battle.carryoverTargets(game.activeBattle!)).toBeUndefined()
  })

  it("rejects an action naming a phase the game has left", () => {
    const game = newGame()

    expect(() => dispatch(game, { type: "masterboard/finalizeMusters", payload: [] })).toThrow(
      "Action requires the MUSTER phase",
    )
  })

  it("throws when a battle action is dispatched with no active battle", () => {
    const game = newGame()

    expect(() => dispatch(game, { type: "battle/finalizeMoves", payload: [] })).toThrow("No active battle")
  })
})

function withoutStackIds(game: TitanGame): unknown {
  return { ...game, stacks: game.stacks.map(stack => omit(stack, "id")) }
}
