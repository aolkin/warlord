import { describe, expect, it } from "vitest"
import { Battle } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { HexEdge } from "@/models/masterboard"
import { PlayerId } from "@/models/player"
import { Random } from "@/models/random"
import { Stack } from "@/models/stack"
import { MasterboardPhase, TitanGame } from "./game"

const noShuffleRandom: Random = { shuffle: collection => [...collection] }

function newGame(numPlayers = 2): TitanGame {
  return TitanGame.create(numPlayers, noShuffleRandom)
}

describe("TitanGame", () => {
  it("assigns player colors via the injected Random instead of a fixed order", () => {
    const reverse: Random = {
      shuffle: collection => [...collection].reverse()
    }

    const game = TitanGame.create(2, reverse)

    expect(game.players.map(player => player.id)).toEqual([PlayerId.BLACK, PlayerId.YELLOW])
  })
})

describe("TitanGame movement legality", () => {
  it("enumerates one path per exit on a single-pip roll", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    // Player 0 (BLUE) starts at tower hex 100, whose 3 exits are all plain arrows.
    const destinations = TitanGame.getPathsForHex(game, 100).map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(destinations).toEqual([3, 41, 101])
    expect(TitanGame.getPathsForHex(game, 100).every(p => p.foe === undefined)).toBe(true)
  })

  it("excludes a destination occupied by the mover's own stack, but flags one occupied by an enemy stack", () => {
    const ownStackGame = newGame()
    ownStackGame.stacks.push(Stack.create({
      owner: ownStackGame.players[0].id, hex: 3, marker: 5, createdRound: ownStackGame.round
    }))
    ownStackGame.activePhase = MasterboardPhase.MOVE
    ownStackGame.activeRoll = 1
    const ownDestinations = TitanGame.getPathsForHex(ownStackGame, 100)
      .map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(ownDestinations).toEqual([41, 101])

    const enemyStackGame = newGame()
    enemyStackGame.stacks.push(Stack.create({
      owner: enemyStackGame.players[1].id, hex: 3, marker: 5, createdRound: enemyStackGame.round
    }))
    enemyStackGame.activePhase = MasterboardPhase.MOVE
    enemyStackGame.activeRoll = 1
    const toEnemyHex = TitanGame.getPathsForHex(enemyStackGame, 100).find(p => p.path.at(-1)!.id === 3)
    expect(toEnemyHex?.foe?.owner).toBe(enemyStackGame.players[1].id)
  })

  it.each([
    // Hex 4 has a square edge (to 103) alongside its arrow edge (to 5).
    { label: "square edge replaces the arrow exit", startHex: 4, expected: [103] },
    // Hex 1 has a circle edge (to 1000) alongside its arrow edge (to 2), and no square edge.
    { label: "circle edge adds to the arrow exit", startHex: 1, expected: [2, 1000] }
  ])("$label on the first step", ({ startHex, expected }) => {
    const game = newGame()
    game.stacks[0].hex = startHex
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    const destinations = TitanGame.getPathsForHex(game, startHex).map(p => p.path.at(-1)!.id).sort((a, b) => a - b)
    expect(destinations).toEqual(expected)
  })

  it("continues from the entry hex using normal arrow movement on later steps", () => {
    const game = newGame()
    game.stacks[0].hex = 4
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 2

    const paths = TitanGame.getPathsForHex(game, 4)
    expect(paths).toHaveLength(1)
    expect(paths[0].path.map(h => h.id)).toEqual([4, 103, 102])
  })
})

describe("TitanGame mandatory moves (stack splitting during movement)", () => {
  it("requires splitting apart two stacks sharing a hex until one of them moves away", () => {
    const game = newGame()
    const original = game.stacks[0]
    original.split[0] = true // TITAN
    original.split[2] = true // CENTAUR
    original.split[4] = true // OGRE
    original.split[6] = true // GARGOYLE
    TitanGame.nextPhase(game)
    const sibling = game.stacks.at(-1)!
    game.activeRoll = 1

    expect(TitanGame.getMandatoryMoves(game)).toEqual(expect.arrayContaining([original, sibling]))
    expect(TitanGame.getMandatoryMoves(game)).toHaveLength(2)
    expect(TitanGame.getMayProceed(game)).toBe(false)

    TitanGame.move(game, { stack: original.id, hex: 3 })

    // Once split apart, the remaining stack alone on the origin hex is no longer mandatory.
    expect(TitanGame.getMandatoryMoves(game)).toEqual([])
    expect(TitanGame.getMayProceed(game)).toBe(true)
  })
})

describe("TitanGame mayProceed for the split phase", () => {
  it("blocks proceeding out of the split phase in round 1 until every active stack has a valid split", () => {
    const game = newGame()
    expect(game.round).toBe(0)
    expect(TitanGame.getMayProceed(game)).toBe(false)

    const stack = game.stacks[0]
    stack.split[0] = true
    stack.split[2] = true
    stack.split[4] = true
    stack.split[6] = true

    expect(TitanGame.getMayProceed(game)).toBe(true)
  })
})

describe("TitanGame.isStackActive", () => {
  it("gates SPLIT phase on having enough creatures to split", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.SPLIT
    const stack = game.stacks[0]
    expect(TitanGame.isStackActive(game, stack)).toBe(true) // 8 creatures by default

    stack.creatures.splice(3)
    expect(TitanGame.isStackActive(game, stack)).toBe(false) // down to 3, below the 4-creature minimum
  })

  it("gates MOVE phase on not having moved yet", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    const stack = game.stacks[0]
    expect(TitanGame.isStackActive(game, stack)).toBe(true)

    stack.hex = stack.initialHex + 1
    expect(TitanGame.isStackActive(game, stack)).toBe(false)
  })

  it("gates MUSTER phase on Stack.canMuster", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MUSTER
    const stack = game.stacks[0]
    stack.creatures.splice(3) // below the 7-creature cap, so only "hasn't moved" blocks mustering
    expect(TitanGame.isStackActive(game, stack)).toBe(false) // hasn't moved, so can't muster

    stack.hex = stack.initialHex + 1
    expect(TitanGame.isStackActive(game, stack)).toBe(true)
  })

  it("is always active outside SPLIT/MOVE/MUSTER", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.BATTLE
    expect(TitanGame.isStackActive(game, game.stacks[0])).toBe(true)
  })
})

describe("TitanGame turn and phase transitions", () => {
  it("advances from split to move, finalizing pending splits", () => {
    const game = newGame()
    const original = game.stacks[0]
    // Stale state from a previous turn, cleared on move entry.
    game.mulliganTaken = true
    original.split[0] = true // TITAN
    original.split[2] = true // CENTAUR
    original.split[4] = true // OGRE
    original.split[6] = true // GARGOYLE

    TitanGame.nextPhase(game)

    expect(game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(game.stacks).toHaveLength(3)
    const sibling = game.stacks.find(s => s !== original && s.owner === original.owner)!
    expect(sibling.hex).toBe(original.hex)
    expect(sibling.creatures).toEqual([CreatureType.TITAN, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.GARGOYLE])
    expect(original.creatures).toEqual([CreatureType.ANGEL, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.GARGOYLE])
    // initialHex/attackEdge are only ever reset at the start of a turn (SPLIT reached via the
    // MUSTER wraparound); a freshly split stack already has them at their construction
    // defaults, so this transition leaves them untouched.
    expect(original.initialHex).toBe(original.hex)
    expect(original.attackEdge).toBeUndefined()
    expect(game.mulliganTaken).toBe(false)
  })

  it("skips an empty battle phase and goes straight to muster when nobody is engaged", () => {
    const game = newGame() // BLUE at 100, GREEN at 400: never in contact
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    TitanGame.nextPhase(game)

    expect(game.activePhase).toBe(MasterboardPhase.MUSTER)
    expect(game.activeRoll).toBeUndefined()
  })

  it("initiates a battle and stays in the battle phase when one stack ends on an enemy hex", () => {
    const game = newGame()
    const attacker = game.stacks[0]
    const defender = game.stacks[1]
    attacker.hex = defender.hex // stacks are engaged by sharing a hex
    attacker.attackEdge = HexEdge.FIRST
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1

    TitanGame.nextPhase(game)

    expect(game.activeBattle?.attacker).toBe(attacker.owner)
    expect(game.activeBattle?.defender).toBe(defender.owner)
    expect(game.activeBattleHex).toBe(attacker.hex)
    expect(game.activePhase).toBe(MasterboardPhase.BATTLE)
  })

  // Real Titan rules allow multiple simultaneous engagements, resolved one battle at a time.
  // Until a player can choose the resolution order, nextPhase refuses to leave the move
  // phase rather than advancing into a battle phase with no battle. See its TODO.
  it("refuses to leave the move phase with multiple simultaneous engagements", () => {
    const game = newGame(3) // BLUE @ 100, GREEN @ 300, RED @ 500
    const original = game.stacks[0]
    original.split[0] = true
    original.split[2] = true
    original.split[4] = true
    original.split[6] = true
    TitanGame.nextPhase(game)
    const sibling = game.stacks.at(-1)!
    original.hex = game.stacks[1].hex // engage GREEN
    sibling.hex = game.stacks[2].hex // engage RED
    game.activeRoll = 1

    expect(() => TitanGame.nextPhase(game)).toThrow("Multiple simultaneous engagements")

    expect(game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(game.activeBattle).toBeUndefined()
  })

  it("advances from battle to muster once a battle is present", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.BATTLE
    // Battle mechanics themselves are exercised by the battle test suite; only the
    // phase-transition gating (an active battle must exist) is under test here.
    game.activeBattle = {} as unknown as Battle

    TitanGame.nextPhase(game)

    expect(game.activePhase).toBe(MasterboardPhase.MUSTER)
  })

  it("rotates to the next player after musters, then wraps to the first player and advances the round on the next muster", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MUSTER

    TitanGame.nextPhase(game)
    expect(game.activePhase).toBe(MasterboardPhase.SPLIT)
    expect(game.activePlayerIndex).toBe(1)
    expect(game.activePlayerId).toBe(game.players[1].id)
    expect(game.round).toBe(0)

    game.activePhase = MasterboardPhase.MUSTER
    game.stacks[0].currentMuster = [CreatureType.CENTAUR, [CreatureType.CENTAUR, 0]]
    // Stale movement state left over from this player's earlier MOVE phase this round.
    game.stacks[0].attackEdge = HexEdge.FIRST
    game.stacks[0].initialHex = 3

    TitanGame.nextPhase(game)
    expect(game.activePhase).toBe(MasterboardPhase.SPLIT)
    expect(game.activePlayerIndex).toBe(0)
    expect(game.activePlayerId).toBe(game.players[0].id)
    expect(game.round).toBe(1)
    // Wrapping to the new active player starts their turn: clears any stale pending muster
    // and resets per-turn movement state left on their stacks.
    expect(game.stacks[0].currentMuster).toBeUndefined()
    expect(game.stacks[0].attackEdge).toBeUndefined()
    expect(game.stacks[0].initialHex).toBe(game.stacks[0].hex)
  })
})

describe("TitanGame roll setting (setRoll)", () => {
  it("records the roll during the move phase", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE

    TitanGame.setRoll(game, 4)

    expect(game.activeRoll).toBe(4)
  })

  it("taking a mulligan clears the roll and marks it taken", () => {
    const game = newGame()
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 3

    TitanGame.setRoll(game, undefined)

    expect(game.activeRoll).toBeUndefined()
    expect(game.mulliganTaken).toBe(true)
  })
})

describe("TitanGame persistence", () => {
  it("round-trips a non-zero score through hydrate", () => {
    const game = newGame()
    game.score[game.players[0].id] = 250

    const rehydrated = TitanGame.hydrate(JSON.stringify(game))

    expect(rehydrated.score[game.players[0].id]).toBe(250)
    expect(rehydrated.score[game.players[1].id]).toBe(0)
  })

  it("round-trips an in-progress battle, preserving its creature ids", () => {
    const game = newGame()
    const attacker = game.stacks[0]
    attacker.hex = game.stacks[1].hex
    attacker.attackEdge = HexEdge.FIRST
    TitanGame.initiateBattle(game, attacker.id)
    const creatureIds = game.activeBattle!.creatures.map(creature => creature.id)

    const rehydrated = TitanGame.hydrate(JSON.stringify(game))

    expect(rehydrated.activeBattle!.creatures.map(creature => creature.id)).toEqual(creatureIds)
  })
})

describe("TitanGame mustering (setRecruit)", () => {
  it("refuses to record a recruit for a stack that isn't eligible to muster", () => {
    const game = newGame()
    const stack = game.stacks[0] // hasn't moved this turn
    game.activePhase = MasterboardPhase.MUSTER

    expect(() => TitanGame.setRecruit(game, {
      stack: stack.id, recruit: [CreatureType.CENTAUR, [CreatureType.CENTAUR, 0]]
    })).toThrow("not eligible to muster")
  })

  it("refuses to record a recruit outside the muster phase", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id, hex: 100, marker: 1, createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR]
    })
    stack.hex = 101 // moved, so otherwise eligible to muster
    game.stacks.push(stack)
    game.activePhase = MasterboardPhase.MOVE

    expect(() => TitanGame.setRecruit(game, {
      stack: stack.id, recruit: [CreatureType.LION, [CreatureType.CENTAUR, 2]]
    })).toThrow("Innappropriate phase")
  })

  it.each([
    { label: "a non-lord", creatureType: CreatureType.LION, expectSuccess: false },
    { label: "a lord", creatureType: CreatureType.TITAN, expectSuccess: true }
  ])("recruiting $label when its pool is exhausted: succeeds only for the lord", ({
    creatureType, expectSuccess
  }) => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id, hex: 100, marker: 1, createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR]
    })
    stack.hex = 101 // moved
    game.stacks.push(stack)
    game.creaturePool[creatureType] = 0
    game.activePhase = MasterboardPhase.MUSTER
    const recruit: [CreatureType, [CreatureType, number]] = [creatureType, [CreatureType.CENTAUR, 2]]

    if (expectSuccess) {
      TitanGame.setRecruit(game, { stack: stack.id, recruit })
      expect(stack.currentMuster).toEqual(recruit)
    } else {
      expect(() => TitanGame.setRecruit(game, { stack: stack.id, recruit }))
        .toThrow("No more of the requested creature remaining")
    }
  })

  it("applies the pending muster to the stack and pool when the muster phase ends", () => {
    const game = newGame()
    const stack = Stack.create({
      owner: game.players[0].id, hex: 100, marker: 1, createdRound: game.round,
      creatures: [CreatureType.CENTAUR, CreatureType.CENTAUR]
    })
    stack.hex = 101
    game.stacks.push(stack)
    const poolBefore = game.creaturePool[CreatureType.LION]
    game.activePhase = MasterboardPhase.MUSTER
    TitanGame.setRecruit(game, { stack: stack.id, recruit: [CreatureType.LION, [CreatureType.CENTAUR, 2]] })

    TitanGame.nextPhase(game)

    expect(stack.creatures).toContain(CreatureType.LION)
    expect(game.creaturePool[CreatureType.LION]).toBe(poolBefore - 1)
    expect(stack.recruits[game.round]).toEqual([CreatureType.LION, [CreatureType.CENTAUR, 2]])
  })
})
