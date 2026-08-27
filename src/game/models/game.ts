import { assert } from "@/utils/assert"
import { range } from "lodash-es"
import { Battle, BattleSide } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { HexEdge, MasterboardHex } from "./masterboard"
import { Player, PlayerId } from "./player"
import { defaultRandom, Random } from "./random"
import { MusterChoice, Stack, StackRef } from "./stack"

const INITIAL_HEXES: Record<number, number[]> = {
  2: [100, 400],
  3: [100, 300, 500],
  4: [200, 300, 500, 600],
  5: [100, 200, 300, 400, 500],
  6: [100, 200, 300, 400, 500, 600],
}

export enum MasterboardPhase {
  SPLIT,
  MOVE,
  BATTLE,
  MUSTER,
  END,
}

export interface Path {
  foe?: Stack
  path: MasterboardHex[]
}

export interface StackSplit {
  stack: StackRef
  creatures: number[] // indices into stack.creatures
}

export type StagedMoves = ReadonlyMap<StackRef, { hex: number; edge?: HexEdge }>

export type CurrentStackHexGetter = (stack: Stack) => number

const committedHex: CurrentStackHexGetter = stack => stack.hex

export interface MusterPayload {
  stack: StackRef
  recruit: MusterChoice
}

export interface TitanGame {
  readonly players: Player[]
  readonly stacks: Stack[]
  readonly creaturePool: Record<CreatureType, number>
  readonly score: Record<PlayerId, number>

  round: number // 0-indexed
  mulliganTaken: boolean
  activeRoll?: number
  activePlayerIndex: number
  activePlayerId: PlayerId
  activePhase: MasterboardPhase
  activeBattle?: Battle
  activeBattleHex?: number
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace TitanGame {
  export function create(numPlayers: number, random: Random = defaultRandom): TitanGame {
    const round = 0
    // Capped at 5 colors, not 6: BROWN has no crest SVGs (only 5 colors x 12
    // markers exist), so 6-player support can't return until stack marker art
    // is created for it.
    const colors = random.shuffle(range(0, 5))
    const players = range(0, numPlayers).map(i => ({ id: colors[i], name: `Player ${i + 1}` }))
    const stacks = players.map((player: Player, i: number) =>
      Stack.create({ owner: player?.id, hex: INITIAL_HEXES[numPlayers][i], marker: 0, createdRound: round }),
    )
    const score = Object.fromEntries(players.map(player => [player.id, 0])) as Record<PlayerId, number>

    const creaturePool = Object.fromEntries(
      CREATURE_LIST.map(creature => [creature.type, creature.initialQuantity]),
    ) as Record<CreatureType, number>
    stacks.flatMap(stack => stack.creatures).forEach(creature => creaturePool[creature]--)

    return {
      players,
      stacks,
      creaturePool,
      score,
      round,
      mulliganTaken: false,
      activePlayerIndex: 0,
      activePlayerId: players[0].id,
      activeRoll: undefined,
      activePhase: MasterboardPhase.SPLIT,
      activeBattle: undefined,
      activeBattleHex: undefined,
    }
  }

  export function getPlayerById(game: TitanGame, id: PlayerId): Player {
    const player = game.players.find(player => player.id === id)
    assert(player !== undefined, `No player with id ${id}`)
    return player
  }

  export function getStacksForPlayer(game: TitanGame, owner: PlayerId = game.activePlayerId): Stack[] {
    return game.stacks.filter(stack => stack.owner === owner)
  }

  export function getNextMarker(game: TitanGame): number | undefined {
    const usedMarkers = getStacksForPlayer(game).map(stack => stack.marker)
    return range(0, 12).find(marker => !usedMarkers.includes(marker))
  }

  export function getStacksForHex(
    game: TitanGame,
    hex: number,
    getCurrentHex: CurrentStackHexGetter = committedHex,
  ): Stack[] {
    return game.stacks.filter(stack => getCurrentHex(stack) === hex)
  }

  export function getPathsForHex(
    game: TitanGame,
    hexNum: number,
    getCurrentHex: CurrentStackHexGetter = committedHex,
  ): Path[] {
    if (game.activeRoll === undefined) {
      return []
    }
    const initialHex = masterboard.getHex(hexNum)
    const paths: Path[] = []
    // [Array of hexes to get where we are, first hex with enemies, current hex]
    type pathing = [MasterboardHex[], Stack | undefined, MasterboardHex]
    const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
    let entry: pathing | undefined
    while ((entry = stack.pop()) !== undefined) {
      const [path, , hex] = entry
      let foe = entry[1]
      const occupants: Stack[] = getStacksForHex(game, hex.id, getCurrentHex)
      if (foe === undefined) {
        const foes = occupants.filter((stack: Stack) => stack.owner !== game.activePlayerId)
        if (foes.length > 0) {
          foe = foes[0]
        }
      }
      if (path.length === game.activeRoll) {
        if (!occupants.some((stack: Stack) => stack.owner === game.activePlayerId)) {
          paths.push({ foe, path: [...path, hex] })
        }
      } else {
        stack.push(
          ...hex
            .getMovement(false)
            .filter(edge => path[path.length - 1] !== edge.hex)
            .map(edge => [[...path, hex], foe, edge.hex] as pathing),
        )
      }
    }
    return paths
  }

  export function getMandatoryMoves(
    game: TitanGame,
    moves: StagedMoves = new Map(),
    getCurrentHex: CurrentStackHexGetter = committedHex,
  ): Stack[] {
    return getStacksForPlayer(game).filter(
      stack =>
        !moves.has(stack.id) &&
        getStacksForHex(game, stack.hex, getCurrentHex).length > 1 &&
        getPathsForHex(game, stack.hex, getCurrentHex).length > 0,
    )
  }

  export function mayProceedFromSplit(game: TitanGame, splits: StackSplit[]): boolean {
    const submitted = new Map(splits.map(commit => [commit.stack, commit.creatures]))
    return getStacksForPlayer(game).every(stack =>
      Stack.isValidSplit(stack, submitted.get(stack.id) ?? [], game.round === 0),
    )
  }

  export function mayProceedFromMove(
    game: TitanGame,
    moves: StagedMoves = new Map(),
    getCurrentHex: CurrentStackHexGetter = committedHex,
  ): boolean {
    return getMandatoryMoves(game, moves, getCurrentHex).length === 0 && moves.size > 0
  }

  export function mayProceedFromMuster(game: TitanGame, musters: MusterPayload[]): boolean {
    const requestedCounts = new Map<CreatureType, number>()
    musters.forEach(({ recruit }) =>
      requestedCounts.set(recruit.creature, (requestedCounts.get(recruit.creature) ?? 0) + 1),
    )
    const poolHasCapacity = Array.from(requestedCounts.entries()).every(
      ([creature, requested]) => CREATURE_DATA[creature].lord || game.creaturePool[creature] >= requested,
    )
    return (
      poolHasCapacity &&
      musters.every(({ stack: ref }) => {
        const stack = getStacksForPlayer(game).find(candidate => candidate.id === ref)
        return stack !== undefined && Stack.canMuster(stack)
      })
    )
  }

  export function isStackActive(game: TitanGame, stack: Stack, moves: StagedMoves = new Map()): boolean {
    if (stack.owner !== game.activePlayerId) {
      return false
    }
    switch (game.activePhase) {
      case MasterboardPhase.SPLIT:
        return stack.creatures.length >= 4
      case MasterboardPhase.MOVE:
        return !moves.has(stack.id)
      case MasterboardPhase.MUSTER:
        return Stack.canMuster(stack)
      default:
        return true
    }
  }

  export function isMulliganAvailable(game: TitanGame): boolean {
    return game.round === 0 && !game.mulliganTaken
  }

  export function isSplitPhase(game: TitanGame): boolean {
    return game.activePhase === MasterboardPhase.SPLIT
  }

  export function isMovePhase(game: TitanGame): boolean {
    return game.activePhase === MasterboardPhase.MOVE
  }

  export function isMusterPhase(game: TitanGame): boolean {
    return game.activePhase === MasterboardPhase.MUSTER
  }

  export function getEngagedStacks(game: TitanGame, getCurrentHex: CurrentStackHexGetter = committedHex): Stack[] {
    const activePlayerId = game.activePlayerId
    return getStacksForPlayer(game).filter(stack =>
      getStacksForHex(game, getCurrentHex(stack), getCurrentHex).some(occupant => occupant.owner !== activePlayerId),
    )
  }

  export function canTitanTeleport(game: TitanGame, stack: Stack): boolean {
    return (
      game.activeRoll === 6 && game.score[game.activePlayerId] >= 400 && stack.creatures.includes(CreatureType.TITAN)
    )
  }

  // Actions

  export function initiateBattle(game: TitanGame, attacking: StackRef): void {
    const attackingStack = game.stacks.find(stack => stack.id === attacking)
    assert(attackingStack !== undefined, `No stack with id ${attacking}`)
    const activePlayerId = game.activePlayerId
    const defending = getStacksForHex(game, attackingStack.hex).find(stack => stack.owner !== activePlayerId) as Stack
    assert(defending !== undefined, `No engagement present on hex ${attackingStack.hex}!`)
    assert(attackingStack.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    const terrain = masterboard.getHex(attackingStack.hex).terrain
    const attackingSide = toBattleSide(attackingStack, game.score[attackingStack.owner])
    const defendingSide = toBattleSide(defending, game.score[defending.owner])
    game.activeBattle = Battle.create({
      terrain,
      edge: attackingStack.attackEdge,
      attacking: attackingSide,
      defending: defendingSide,
    })
    game.activeBattleHex = attackingStack.hex
  }

  /** Splits the submitted creatures off their stacks onto fresh markers and enters the move phase. */
  export function finalizeSplits(game: TitanGame, splits: StackSplit[], random: Random = defaultRandom): void {
    assert(game.activePhase === MasterboardPhase.SPLIT, "Innappropriate phase")
    assert(mayProceedFromSplit(game, splits), "Invalid splits")
    const owned = getStacksForPlayer(game)
    splits.forEach(({ stack: ref, creatures }) => {
      const stack = owned.find(candidate => candidate.id === ref)
      assert(stack !== undefined, `The active player does not own a stack with id ${ref}`)
      if (creatures.length > 0) {
        // Each pushed stack claims a marker, so the next split needs a fresh read.
        game.stacks.push(Stack.finalizeSplit(stack, creatures, getNextMarker(game)!, game.round))
      }
    })
    game.mulliganTaken = false
    advancePhase(game)
    game.activeRoll = random.die()
  }

  /** Re-rolls movement, which rule 7.6 allows once on a player's first turn. */
  export function takeMulligan(game: TitanGame, random: Random = defaultRandom): void {
    assert(isMulliganAvailable(game), "Mulligan unavailable")
    assert(game.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    game.mulliganTaken = true
    game.activeRoll = random.die()
  }

  export function finalizeMoves(game: TitanGame, moves: StagedMoves): void {
    assert(game.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    moves.forEach(({ hex, edge }, ref) => {
      const movingStack = game.stacks.find(stack => stack.id === ref)
      assert(movingStack !== undefined, `No stack with id ${ref}`)
      movingStack.hex = hex
      movingStack.attackEdge = edge
      movingStack.hasMoved = true
    })
    const engagedStacks = getEngagedStacks(game)
    game.activeRoll = undefined
    // TODO: recombine splits that failed to move
    // TODO: handle 2+ simultaneous engagements
    if (engagedStacks.length === 0) {
      advancePhase(game)
    } else {
      initiateBattle(game, engagedStacks[0].id)
    }
    advancePhase(game)
  }

  export function finalizeMusters(game: TitanGame, musters: MusterPayload[]): void {
    assert(game.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    assert(mayProceedFromMuster(game, musters), "Invalid musters")
    musters.forEach(({ stack: ref, recruit }) => {
      const stack = getStacksForPlayer(game).find(candidate => candidate.id === ref)
      assert(stack !== undefined, `The active player does not own a stack with id ${ref}`)
      stack.recruits[game.round] = recruit
      stack.latestMuster = recruit
      stack.creatures.push(recruit.creature)
      game.creaturePool[recruit.creature]--
    })
    // Muster is a turn's last phase, so advancing past it wraps to the next player's split.
    advancePhase(game)
    getStacksForPlayer(game).forEach(startPlayerTurn)
  }

  export function hydrate(persisted?: string): TitanGame {
    const game = create(2)
    try {
      if (persisted !== undefined) {
        Object.assign(game, JSON.parse(persisted))
      }
    } catch (e) {
      console.error("Error during hydration", e)
      return create(2)
    }
    // Advances the stack id counter past the highest id present in the restored save,
    // so ids assigned to new stacks after hydration can't collide with restored ones.
    Stack.reserveIdsThrough(Math.max(-1, ...game.stacks.map(stack => stack.id)))
    return game
  }
}

function toBattleSide(stack: Stack, score: number): BattleSide {
  return { player: stack.owner, score, creatures: stack.creatures }
}

function startPlayerTurn(stack: Stack): void {
  stack.initialHex = stack.hex
  stack.hasMoved = false
  stack.attackEdge = undefined
  stack.latestMuster = undefined
}

function advancePhase(game: TitanGame): void {
  game.activePhase += 1
  if (game.activePhase === MasterboardPhase.END) {
    game.activePlayerIndex += 1
    if (game.activePlayerIndex >= game.players.length) {
      game.activePlayerIndex = 0
      game.round++
    }
    game.activePlayerId = game.players[game.activePlayerIndex].id
    game.activePhase = MasterboardPhase.SPLIT
  }
}
