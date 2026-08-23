import { range } from "lodash-es"
import { assert } from "@/utils/assert"
import { Battle, BattleSide } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { HexEdge, MasterboardHex } from "./masterboard"
import { Moveable } from "./moveable"
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

export interface SplitCommit {
  stack: StackRef
  creatures: number[] // indices into stack.creatures
}
export interface MovePayload {
  stack: StackRef
  hex: number
  edge?: HexEdge
}
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

  export function getStacksForHex(game: TitanGame, hex: number): Stack[] {
    return game.stacks.filter(stack => stack.hex === hex)
  }

  export function getPathsForHex(game: TitanGame, hexNum: number): Path[] {
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
      const occupants: Stack[] = getStacksForHex(game, hex.id)
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

  export function getMandatoryMoves(game: TitanGame): Stack[] {
    return getStacksForPlayer(game).filter(
      stack =>
        !Moveable.hasMoved(stack) &&
        getStacksForHex(game, stack.initialHex).length > 1 &&
        getPathsForHex(game, stack.hex).length > 0,
    )
  }

  export function getMayProceed(game: TitanGame, splits: SplitCommit[]): boolean {
    switch (game.activePhase) {
      case MasterboardPhase.SPLIT: {
        const submitted = new Map(splits.map(commit => [commit.stack, commit.creatures]))
        return getStacksForPlayer(game).every(stack =>
          Stack.isValidSplit(stack, submitted.get(stack.id) ?? [], game.round === 0),
        )
      }
      case MasterboardPhase.MOVE:
        return getMandatoryMoves(game).length === 0 && getStacksForPlayer(game).some(stack => Moveable.hasMoved(stack))
      case MasterboardPhase.BATTLE:
        return true
      case MasterboardPhase.MUSTER:
        return true
      case MasterboardPhase.END:
        return true
    }
  }

  export function isStackActive(game: TitanGame, stack: Stack): boolean {
    if (stack.owner !== game.activePlayerId) {
      return false
    }
    switch (game.activePhase) {
      case MasterboardPhase.SPLIT:
        return stack.creatures.length >= 4
      case MasterboardPhase.MOVE:
        return !Moveable.hasMoved(stack)
      case MasterboardPhase.MUSTER:
        return Stack.canMuster(stack)
      default:
        return true
    }
  }

  export function isMulliganAvailable(game: TitanGame): boolean {
    return game.round === 0 && !game.mulliganTaken && !getStacksForPlayer(game).some(stack => Moveable.hasMoved(stack))
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

  export function getEngagedStacks(game: TitanGame): Stack[] {
    const activePlayerId = game.activePlayerId
    return getStacksForPlayer(game).filter(stack =>
      getStacksForHex(game, stack.hex).some(occupant => occupant.owner !== activePlayerId),
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
  export function finalizeSplits(game: TitanGame, splits: SplitCommit[]): void {
    assert(game.activePhase === MasterboardPhase.SPLIT, "Innappropriate phase")
    // TODO: check mayProceed before advancing — round-1 split rule (exactly 4 creatures with 1 lord) not yet enforced
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
  }

  export function nextPhase(game: TitanGame): void {
    switch (game.activePhase) {
      case MasterboardPhase.SPLIT:
        throw new Error("The split phase ends through finalizeSplits, which carries the splits")
      case MasterboardPhase.MOVE: {
        const engagedStacks = getEngagedStacks(game)
        // TODO: handle 2+ simultaneous engagements — no UI yet exists to let the player choose
        // which battle to resolve first. Refusing to advance keeps the game out of a battle
        // phase with no battle to resolve.
        assert(engagedStacks.length <= 1, "Multiple simultaneous engagements are unsupported")
        game.activeRoll = undefined
        // TODO: recombine splits that failed to move
        if (engagedStacks.length === 0) {
          advancePhase(game)
        } else {
          initiateBattle(game, engagedStacks[0].id)
        }
        break
      }
      case MasterboardPhase.BATTLE:
        assert(game.activeBattle !== undefined, "Incomplete battle!")
        break
      case MasterboardPhase.MUSTER:
        getStacksForPlayer(game)
          .filter((stack): stack is Stack & { currentMuster: MusterChoice } => stack.currentMuster !== undefined)
          .forEach(stack => {
            const recruitedCreature = finalizeMuster(game.round, stack)
            game.creaturePool[recruitedCreature]--
          })
        // Muster is a turn's last phase, so advancing past it wraps to the next player's split.
        advancePhase(game)
        getStacksForPlayer(game).forEach(startPlayerTurn)
        return
    }
    advancePhase(game)
  }

  export function setRoll(game: TitanGame, payload?: number): void {
    if (payload === undefined && game.activeRoll !== undefined) {
      assert(isMulliganAvailable(game), "Mulligan unavailable")
    }
    assert(game.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && game.activeRoll !== undefined) {
      game.mulliganTaken = true
    }
    game.activeRoll = payload
  }

  export function move(game: TitanGame, { stack, hex, edge }: MovePayload): void {
    const movingStack = game.stacks.find(s => s.id === stack)
    assert(movingStack !== undefined, `No stack with id ${stack}`)
    assert(game.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    movingStack.attackEdge = edge
    movingStack.hex = hex
  }

  export function setRecruit(game: TitanGame, { stack, recruit }: MusterPayload): void {
    const recruitingStack = game.stacks.find(s => s.id === stack)
    assert(recruitingStack !== undefined, `No stack with id ${stack}`)
    if (!Stack.canMuster(recruitingStack)) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (recruit !== undefined && game.creaturePool[recruit[0]] < 1 && !CREATURE_DATA[recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    assert(game.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    recruitingStack.currentMuster = recruit
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
  stack.attackEdge = undefined
  stack.currentMuster = undefined
}

function finalizeMuster(round: number, stack: Stack & { currentMuster: MusterChoice }): CreatureType {
  stack.recruits[round] = stack.currentMuster
  stack.creatures.push(stack.currentMuster[0])
  return stack.currentMuster[0]
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
