import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Battle, BattleSide } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { TitanGame } from "@/models/game"
import { noShuffleRandom } from "@/models/game.testUtils"
import { HexEdge, Terrain } from "@/models/masterboard"
import { Player, PlayerId } from "@/models/player"
import { Stack } from "@/models/stack"
import { GAME_PERSISTENCE_KEY } from "./persistence"

// Mutates a range of fields so a round trip can't accidentally pass by comparing
// only default-constructed values.
function buildGame(): TitanGame {
  const game = new TitanGame(2, noShuffleRandom)
  game.round = 2
  game.activePlayer = 1
  game.mulliganTaken = true
  game.players[0].addPoints(37)
  game.stacks.push(new Stack(game.players[1].id, 9, 1, [CreatureType.CENTAUR, CreatureType.OGRE]))
  game.creaturePool[CreatureType.CENTAUR] -= 3
  return game
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe("gamePersistence persist/doRestore round trip", () => {
  it("restores a persisted game to an equivalent state", async () => {
    const original = buildGame()

    const encoded = await original.persist()
    const restored = new TitanGame(2, noShuffleRandom)
    await restored.doRestore(encoded!)

    expect(restored.round).toBe(original.round)
    expect(restored.activePlayer).toBe(original.activePlayer)
    expect(restored.mulliganTaken).toBe(original.mulliganTaken)
    expect(restored.creaturePool).toEqual(original.creaturePool)
    expect(restored.players).toEqual(original.players)
    expect(restored.stacks).toEqual(original.stacks)
  })

  it("reconstructs players and stacks as class instances rather than plain data", async () => {
    const original = buildGame()

    const encoded = await original.persist()
    const restored = new TitanGame(2, noShuffleRandom)
    await restored.doRestore(encoded!)

    expect(restored.players.every(player => player instanceof Player)).toBe(true)
    expect(restored.stacks.every(stack => stack instanceof Stack)).toBe(true)
    // Instance methods live only on the prototype, so a restored object that was left as
    // plain JSON data (rather than reconstructed via the class constructors) would throw here.
    expect(restored.stacks[0].hasMoved()).toBe(false)
  })

  it("hydrates an in-progress battle back into a real Battle instance", async () => {
    const original = buildGame()
    const attacking: BattleSide = { player: PlayerId.BLUE, score: 0, creatures: [CreatureType.CENTAUR] }
    const defending: BattleSide = { player: PlayerId.GREEN, score: 0, creatures: [CreatureType.CENTAUR] }
    original.activeBattle = new Battle(Terrain.PLAINS, HexEdge.FIRST, attacking, defending)

    const encoded = await original.persist()
    const restored = new TitanGame(2, noShuffleRandom)
    await restored.doRestore(encoded!)

    expect(restored.activeBattle).toBeInstanceOf(Battle)
    expect(restored.activeBattle?.attacker).toBe(PlayerId.BLUE)
    expect(restored.activeBattle?.defender).toBe(PlayerId.GREEN)
  })

  it("leaves activeBattle undefined when no battle was in progress", async () => {
    const original = buildGame()

    const encoded = await original.persist()
    const restored = new TitanGame(2, noShuffleRandom)
    await restored.doRestore(encoded!)

    expect(restored.activeBattle).toBeUndefined()
  })
})

describe("gamePersistence.persist", () => {
  it("still writes the uncompressed state to localStorage when the Compression Streams API is unavailable", async () => {
    const game = buildGame()
    vi.stubGlobal("CompressionStream", undefined)

    const encoded = await game.persist()

    expect(encoded).toBeUndefined()
    expect(JSON.parse(localStorage[GAME_PERSISTENCE_KEY])).toEqual(JSON.parse(JSON.stringify(game)))
  })
})

describe("gamePersistence.doRestore", () => {
  it("rejects rather than silently restoring when given data that isn't a valid compressed payload", async () => {
    const game = new TitanGame(2, noShuffleRandom)

    await expect(game.doRestore("not-a-valid-compressed-payload")).rejects.toThrow()
  })
})
