import { omit } from "lodash-es"
import { describe, expect, it } from "vitest"
import { Battle, BattleCreature, BattlePhase, BattleSide } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { HexEdge, Terrain } from "@/models/masterboard"
import { Random } from "@/models/random"
import { MusterChoice, Stack } from "@/models/stack"
import { GameAction, dispatch } from "./actions"
import { MasterboardPhase, TitanGame } from "./game"

const noShuffleRandom: Random = { shuffle: collection => [...collection] }

function newGame(numPlayers = 2): TitanGame {
  return TitanGame.create(numPlayers, noShuffleRandom)
}

// Both branches start from a clone of the same game, so ids already present in it line
// up. Neither branch may mint new ids (Stack.create/BattleCreature.create) itself, or
// the two clones would diverge purely from allocation order - see the dedicated
// initiateBattle test below for the one action that does mint ids.
function expectDispatchMatchesDirectCall(game: TitanGame, action: GameAction, direct: (game: TitanGame) => void): void {
  const viaDirect = structuredClone(game)
  direct(viaDirect)

  const viaDispatch = structuredClone(game)
  dispatch(viaDispatch, action)

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
    player: game.players[1].id, score: 0, creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR]
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
  it("move: matches TitanGame.move", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    const stack = game.stacks[0]
    const payload = { stack: stack.id, hex: 3, edge: HexEdge.FIRST }

    expectDispatchMatchesDirectCall(game, { type: "move", payload },
      g => { TitanGame.move(g, payload) })
  })

  it("setRecruit: matches TitanGame.setRecruit", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id, hex: 100, marker: 1, createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR]
    })
    stack.hex = 101 // moved, so eligible to muster
    game.stacks.push(stack)
    game.activePhase = MasterboardPhase.MUSTER
    const recruit: MusterChoice = [CreatureType.LION, [CreatureType.CENTAUR, 2]]
    const payload = { stack: stack.id, recruit }

    expectDispatchMatchesDirectCall(game, { type: "setRecruit", payload },
      g => { TitanGame.setRecruit(g, payload) })
  })

  it("nextPhase: matches TitanGame.nextPhase", () => {
    const game = newGame() // BLUE at 100, GREEN at 400: never in contact
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    expectDispatchMatchesDirectCall(game, { type: "nextPhase" },
      g => { TitanGame.nextPhase(g) })
  })

  it("setRoll: matches TitanGame.setRoll", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE

    expectDispatchMatchesDirectCall(game, { type: "setRoll", payload: 4 },
      g => { TitanGame.setRoll(g, 4) })
  })

  it("initiateBattle: matches TitanGame.initiateBattle, up to the battle-creature ids each independently mints", () => {
    const game = newGame()
    const attacker = game.stacks[0]
    attacker.hex = game.stacks[1].hex // engage the two starting stacks
    attacker.attackEdge = HexEdge.FIRST

    const viaDirect = structuredClone(game)
    TitanGame.initiateBattle(viaDirect, attacker.id)

    const viaDispatch = structuredClone(game)
    dispatch(viaDispatch, { type: "initiateBattle", payload: attacker.id })

    expect(viaDispatch.activeBattleHex).toEqual(viaDirect.activeBattleHex)
    expect(viaDispatch.activeBattle).toBeDefined()
    // battleCreatureIdCounter is a module-level counter, shared across both calls above,
    // so the two battles mint different absolute creature ids for the same creatures;
    // strip ids and compare everything else structurally instead.
    expect({
      ...viaDispatch.activeBattle,
      creatures: viaDispatch.activeBattle!.creatures.map(c => omit(c, "id"))
    }).toEqual({
      ...viaDirect.activeBattle,
      creatures: viaDirect.activeBattle!.creatures.map(c => omit(c, "id"))
    })
  })

  it("moveCreature: matches Battle.moveCreature", () => {
    const { game, centaur1 } = newEngagedBattleGame()
    game.activeBattle!.phase = BattlePhase.DEFENDER_MOVE
    game.activeBattle!.activePlayer = game.activeBattle!.defender
    const payload = { creature: centaur1.id, hex: 21 } // reachable from centaur1's entrance hex

    expectDispatchMatchesDirectCall(game, { type: "moveCreature", payload },
      g => { Battle.moveCreature(g.activeBattle!, payload) })
  })

  it("attackCreature: matches Battle.attackCreature", () => {
    const { game, lion, centaur1 } = newEngagedBattleGame()
    const payload = { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] }

    expectDispatchMatchesDirectCall(game, { type: "attackCreature", payload },
      g => { Battle.attackCreature(g.activeBattle!, payload) })
  })

  it("rangestrikeCreature: matches Battle.rangestrikeCreature", () => {
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
    const payload = {
      attacker: ranger.id,
      target: { ...rangestrikeTarget, creature: target.id },
      rolls: [6, 6]
    }

    expectDispatchMatchesDirectCall(game, { type: "rangestrikeCreature", payload },
      g => { Battle.rangestrikeCreature(g.activeBattle!, payload) })
  })

  it("assignCarryover: matches Battle.assignCarryover", () => {
    const { game, lion, centaur1, centaur2 } = newEngagedBattleGame()
    // Overkill strike leaves carryover hits to assign onto centaur2.
    Battle.attackCreature(game.activeBattle!, { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })

    expectDispatchMatchesDirectCall(game, { type: "assignCarryover", payload: centaur2.id },
      g => { Battle.assignCarryover(g.activeBattle!, centaur2.id) })
  })

  it("skipCarryover: matches Battle.skipCarryover", () => {
    const { game, lion, centaur1 } = newEngagedBattleGame()
    Battle.attackCreature(game.activeBattle!, { attacker: lion.id, target: centaur1.id, rolls: [6, 6, 6, 6, 6] })

    expectDispatchMatchesDirectCall(game, { type: "skipCarryover" },
      g => { Battle.skipCarryover(g.activeBattle!) })
  })

  it("togglePendingSplit: matches Stack.togglePendingSplit", () => {
    const game = newGame()
    const stack = game.stacks[0]

    expectDispatchMatchesDirectCall(game, { type: "togglePendingSplit", payload: { stack: stack.id, index: 2 } },
      g => { Stack.togglePendingSplit(g.stacks[0], 2) })
  })

  it("throws when a battle action is dispatched with no active battle", () => {
    const game = newGame()
    game.activeBattle = undefined

    expect(() => dispatch(game, { type: "moveCreature", payload: { creature: 0, hex: 8 } }))
      .toThrow("No active battle")
  })
})
