import { describe, expect, it } from "vitest"
import { Battle } from "~/models/battle"
import { CreatureType } from "~/models/creature"
import { HexEdge } from "~/models/masterboard"
import { PlayerId } from "~/models/player"
import { Random } from "~/models/random"
import { Stack } from "~/models/stack"
import { ActionContext, Getters, MasterboardPhase, TitanGame } from "./game"

const noShuffleRandom: Random = { shuffle: collection => [...collection] }

function newGame(numPlayers = 2): TitanGame {
  return new TitanGame(numPlayers, noShuffleRandom)
}

/**
 * Vuex wires TitanGame's getXxx methods together by handing each one the same live
 * `getters` object, so a getter that depends on another (e.g. getActiveStacks needs
 * activePlayerId) reads it off that object instead of recomputing it itself. This
 * mirrors that wiring without a real store: each property recomputes from current game
 * state on every access, which behaves the same as Vuex's reactive getters for the
 * synchronous scenarios below.
 */
function createGetters(game: TitanGame): Getters {
  const getters = {} as Getters
  const lazy = <K extends keyof Getters>(key: K, compute: () => Getters[K]): void => {
    Object.defineProperty(getters, key, { get: compute, enumerable: true, configurable: true })
  }
  lazy("round", () => game.getRound())
  lazy("firstRound", () => game.getFirstRound())
  lazy("players", () => game.getPlayers())
  lazy("playerById", () => game.getPlayerById())
  lazy("stacksForPlayer", () => game.getStacksForPlayer())
  lazy("stacksForHex", () => game.getStacksForHex())
  lazy("activePlayer", () => game.getActivePlayer())
  lazy("activePlayerId", () => game.getActivePlayerId(getters))
  lazy("activeStacks", () => game.getActiveStacks(getters))
  lazy("nextMarker", () => game.getNextMarker(getters) as number)
  lazy("pathsForHex", () => game.getPathsForHex(getters))
  lazy("mandatoryMoves", () => game.getMandatoryMoves(getters))
  lazy("mayProceed", () => game.getMayProceed(getters))
  lazy("mulliganAvailable", () => game.getMulliganAvailable(getters))
  lazy("engagedStacks", () => game.getEngagedStacks(getters))
  return getters
}

/**
 * Builds an ActionContext whose commit/dispatch forward to TitanGame's own mFoo/doFoo
 * methods - the same mapping src/store/game/index.ts sets up for the real Vuex module
 * (mutation "fooBar" -> method "mFooBar", action "fooBar" -> method "doFooBar").
 * Root-namespaced mutations (e.g. "ui/selections/...") are no-ops here since they
 * belong to unrelated UI-selection state, not the turn logic under test.
 */
function createActionContext(
  game: TitanGame,
  dispatch: ActionContext["dispatch"] = () => {
    throw new Error("dispatch was not expected to be called")
  }
): ActionContext {
  const getters = createGetters(game)
  const commit: ActionContext["commit"] = (name, payload) => {
    if (name.includes("/")) return
    const method = `m${name.charAt(0).toUpperCase()}${name.slice(1)}`
    ;(game as unknown as Record<string, (payload?: unknown) => void>)[method](payload)
  }
  // Actions persist as a side effect; persistence itself is a separate concern (see
  // persistence.ts) and not under test here, so stub it out rather than exercising
  // the real localStorage/compression path for every turn/muster action.
  game.persist = async () => undefined
  return { state: game, getters, commit, dispatch }
}

describe("TitanGame", () => {
  it("assigns player colors via the injected Random instead of a fixed order", () => {
    const reverse: Random = {
      shuffle: collection => [...collection].reverse()
    }

    const game = new TitanGame(2, reverse)

    expect(game.players.map(player => player.id)).toEqual([PlayerId.BLACK, PlayerId.YELLOW])
  })
})

describe("TitanGame movement legality", () => {
  it("enumerates one path per exit on a single-pip roll", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const getters = createGetters(game)

    // Player 0 (BLUE) starts at tower hex 100, whose 3 exits are all plain arrows.
    const destinations = getters.pathsForHex(100).map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(destinations).toEqual([3, 41, 101])
    expect(getters.pathsForHex(100).every(p => p.foe === undefined)).toBe(true)
  })

  it("excludes a destination occupied by one of the mover's own stacks", () => {
    const game = newGame()
    game.stacks.push(new Stack(game.players[0].id, 3, 5))
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const getters = createGetters(game)

    const destinations = getters.pathsForHex(100).map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(destinations).toEqual([41, 101])
  })

  it("flags an enemy stack at the destination instead of excluding it", () => {
    const game = newGame()
    game.stacks.push(new Stack(game.players[1].id, 3, 5))
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const getters = createGetters(game)

    const toEnemyHex = getters.pathsForHex(100).find(p => p.path.at(-1)!.id === 3)
    expect(toEnemyHex?.foe?.owner).toBe(game.players[1].id)
  })

  it("replaces the arrow exits of a hex with a square edge on the first step", () => {
    const game = newGame()
    // Hex 4 has a square edge (to 103) alongside its arrow edge (to 5).
    game.stacks[0].hex = 4
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const getters = createGetters(game)

    const destinations = getters.pathsForHex(4).map(p => p.path.at(-1)!.id)
    expect(destinations).toEqual([103])
  })

  it("adds a circle edge to the arrow exits on the first step", () => {
    const game = newGame()
    // Hex 1 has a circle edge (to 1000) alongside its arrow edge (to 2), and no square edge.
    game.stacks[0].hex = 1
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const getters = createGetters(game)

    const destinations = getters.pathsForHex(1).map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(destinations).toEqual([2, 1000])
  })

  it("continues from the entry hex using normal arrow movement on later steps", () => {
    const game = newGame()
    game.stacks[0].hex = 4
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 2
    const getters = createGetters(game)

    const paths = getters.pathsForHex(4)
    expect(paths).toHaveLength(1)
    expect(paths[0].path.map(h => h.id)).toEqual([4, 103, 102])
  })
})

describe("TitanGame mandatory moves (stack splitting during movement)", () => {
  it("requires splitting apart two stacks sharing a hex until one of them moves away", () => {
    const game = newGame()
    const original = game.stacks[0]
    original.setPendingSplit(0, true) // TITAN
    original.setPendingSplit(2, true) // CENTAUR
    original.setPendingSplit(4, true) // OGRE
    original.setPendingSplit(6, true) // GARGOYLE
    const getters = createGetters(game)
    game.mPhaseExitSplit(getters)
    const sibling = game.stacks.at(-1)!
    game.mPhaseEnterMove(getters)
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    expect(getters.mandatoryMoves).toEqual(expect.arrayContaining([original, sibling]))
    expect(getters.mandatoryMoves).toHaveLength(2)
    expect(getters.mayProceed).toBe(false)

    game.mMove({ stack: original, hex: 3 })

    // Once split apart, the remaining stack alone on the origin hex is no longer mandatory.
    expect(getters.mandatoryMoves).toEqual([])
    expect(getters.mayProceed).toBe(true)
  })
})

describe("TitanGame mayProceed for the split phase", () => {
  it("blocks proceeding out of the split phase in round 1 until every active stack has a valid split", () => {
    const game = newGame()
    const getters = createGetters(game)
    expect(game.round).toBe(0)
    expect(getters.mayProceed).toBe(false)

    const stack = game.stacks[0]
    stack.setPendingSplit(0, true)
    stack.setPendingSplit(2, true)
    stack.setPendingSplit(4, true)
    stack.setPendingSplit(6, true)

    expect(getters.mayProceed).toBe(true)
  })
})

describe("TitanGame turn and phase transitions", () => {
  it("advances from split to move, finalizing pending splits and resetting per-turn movement state", async () => {
    const game = newGame()
    const original = game.stacks[0]
    // Stale state from a previous turn, all of which move entry clears.
    game.mulliganTaken = true
    original.attackEdge = HexEdge.FIRST
    original.origin = 3
    original.setPendingSplit(0, true) // TITAN
    original.setPendingSplit(2, true) // CENTAUR
    original.setPendingSplit(4, true) // OGRE
    original.setPendingSplit(6, true) // GARGOYLE
    const context = createActionContext(game)

    await game.doNextPhase(context)

    expect(game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(game.stacks).toHaveLength(3)
    const sibling = game.stacks.find(s => s !== original && s.owner === original.owner)!
    expect(sibling.hex).toBe(original.hex)
    expect(sibling.creatures).toEqual([CreatureType.TITAN, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.GARGOYLE])
    expect(original.creatures).toEqual([CreatureType.ANGEL, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.GARGOYLE])
    expect(original.origin).toBe(original.hex)
    expect(original.attackEdge).toBeUndefined()
    expect(game.mulliganTaken).toBe(false)
  })

  it("skips an empty battle phase and goes straight to muster when nobody is engaged", async () => {
    const game = newGame() // BLUE at 100, GREEN at 400: never in contact
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const context = createActionContext(game)

    await game.doNextPhase(context)

    expect(game.activePhase).toBe(MasterboardPhase.MUSTER)
    expect(game.activeRoll).toBeUndefined()
  })

  it("initiates a battle and stays in the battle phase when one stack ends on an enemy hex", async () => {
    const game = newGame()
    const attacker = game.stacks[0]
    attacker.hex = game.stacks[1].hex // stacks are engaged by sharing a hex
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    let dispatched: [string, unknown] | undefined
    const context = createActionContext(game, (action, payload) => { dispatched = [action, payload] })

    await game.doNextPhase(context)

    expect(dispatched).toEqual(["initiateBattle", attacker])
    expect(game.activePhase).toBe(MasterboardPhase.BATTLE)
  })

  // Real Titan rules allow multiple simultaneous engagements, resolved one battle at a time.
  // Until a player can choose the resolution order, doNextPhase refuses to leave the move
  // phase rather than advancing into a battle phase with no battle. See its TODO.
  it("refuses to leave the move phase with multiple simultaneous engagements", async () => {
    const game = newGame(3) // BLUE @ 100, GREEN @ 300, RED @ 500
    const original = game.stacks[0]
    original.setPendingSplit(0, true)
    original.setPendingSplit(2, true)
    original.setPendingSplit(4, true)
    original.setPendingSplit(6, true)
    const getters = createGetters(game)
    game.mPhaseExitSplit(getters)
    const sibling = game.stacks.at(-1)!
    original.hex = game.stacks[1].hex // engage GREEN
    sibling.hex = game.stacks[2].hex // engage RED
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const context = createActionContext(game)

    await expect(game.doNextPhase(context)).rejects.toThrow("Multiple simultaneous engagements")

    expect(game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(game.activeBattle).toBeUndefined()
  })

  it("advances from battle to muster once a battle is present", async () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.BATTLE
    // Battle mechanics themselves are exercised by the battle test suite; only the
    // phase-transition gating (an active battle must exist) is under test here.
    game.activeBattle = {} as unknown as Battle
    const context = createActionContext(game)

    await game.doNextPhase(context)

    expect(game.activePhase).toBe(MasterboardPhase.MUSTER)
  })

  it("rotates to the next player after musters without advancing the round", async () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MUSTER
    const context = createActionContext(game)

    await game.doNextPhase(context)

    expect(game.activePhase).toBe(MasterboardPhase.SPLIT)
    expect(game.activePlayer).toBe(1)
    expect(game.round).toBe(0)
  })

  it("wraps to the first player, advances the round, and clears any stale pending muster for the new active player", async () => {
    const game = newGame()
    game.activePlayer = 1
    game.activePhase = MasterboardPhase.MUSTER
    game.stacks[0].currentMuster = [CreatureType.CENTAUR, [CreatureType.CENTAUR, 0]]
    const context = createActionContext(game)

    await game.doNextPhase(context)

    expect(game.activePhase).toBe(MasterboardPhase.SPLIT)
    expect(game.activePlayer).toBe(0)
    expect(game.round).toBe(1)
    expect(game.stacks[0].currentMuster).toBeUndefined()
  })
})

describe("TitanGame mustering (doSetRecruit)", () => {
  it("refuses to record a recruit for a stack that isn't eligible to muster", async () => {
    const game = newGame()
    const stack = game.stacks[0] // hasn't moved this turn
    game.activePhase = MasterboardPhase.MUSTER
    const context = createActionContext(game)

    await expect(game.doSetRecruit(context, {
      stack, recruit: [CreatureType.CENTAUR, [CreatureType.CENTAUR, 0]]
    })).rejects.toThrow("not eligible to muster")
  })

  it("refuses to recruit a non-lord creature the pool has run out of", async () => {
    const game = newGame()
    const stack = new Stack(game.players[0].id, 100, 1, [CreatureType.CENTAUR, CreatureType.CENTAUR])
    stack.hex = 101 // moved
    game.stacks.push(stack)
    game.creaturePool[CreatureType.LION] = 0
    game.activePhase = MasterboardPhase.MUSTER
    const context = createActionContext(game)

    await expect(game.doSetRecruit(context, {
      stack, recruit: [CreatureType.LION, [CreatureType.CENTAUR, 2]]
    })).rejects.toThrow("No more of the requested creature remaining")
  })

  it("allows recruiting a lord type even if its pool were exhausted", async () => {
    const game = newGame()
    const stack = new Stack(game.players[0].id, 100, 1, [CreatureType.CENTAUR])
    stack.hex = 101
    game.stacks.push(stack)
    game.creaturePool[CreatureType.TITAN] = 0
    game.activePhase = MasterboardPhase.MUSTER
    const context = createActionContext(game)

    await game.doSetRecruit(context, { stack, recruit: [CreatureType.TITAN, [CreatureType.CENTAUR, 0]] })

    expect(stack.currentMuster).toEqual([CreatureType.TITAN, [CreatureType.CENTAUR, 0]])
  })

  it("applies the pending muster to the stack and pool when the muster phase ends", async () => {
    const game = newGame()
    const stack = new Stack(game.players[0].id, 100, 1, [CreatureType.CENTAUR, CreatureType.CENTAUR])
    stack.hex = 101
    game.stacks.push(stack)
    const poolBefore = game.creaturePool[CreatureType.LION]
    game.activePhase = MasterboardPhase.MUSTER
    const context = createActionContext(game)
    await game.doSetRecruit(context, { stack, recruit: [CreatureType.LION, [CreatureType.CENTAUR, 2]] })

    const getters = createGetters(game)
    game.mPhaseExitMuster(getters)

    expect(stack.creatures).toContain(CreatureType.LION)
    expect(game.creaturePool[CreatureType.LION]).toBe(poolBefore - 1)
    expect(stack.recruits[game.round]).toEqual([CreatureType.LION, [CreatureType.CENTAUR, 2]])
  })
})
