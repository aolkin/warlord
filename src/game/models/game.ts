import { range } from "lodash-es"
import { assert } from "@/utils/assert"
import { Battle } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import { GameBattle, gameBattle } from "./game/battle"
import { GamePersistence, gamePersistence, GAME_PERSISTENCE_KEY } from "./game/persistence"
import masterboard, { HexEdge, MasterboardHex } from "./masterboard"
import { Player, PlayerId } from "./player"
import { defaultRandom, Random } from "./random"
import { finalizeSplit, MusterChoice, Stack } from "./stack"

const INITIAL_HEXES: Record<number, number[]> = {
  2: [100, 400],
  3: [100, 300, 500],
  4: [200, 300, 500, 600],
  5: [100, 200, 300, 400, 500],
  6: [100, 200, 300, 400, 500, 600]
}

export enum MasterboardPhase {
  SPLIT,
  MOVE,
  BATTLE,
  MUSTER,
  END
}

export interface Path {
  foe?: Stack
  path: MasterboardHex[]
}

export interface MovePayload { stack: Stack, hex: number | MasterboardHex, edge?: HexEdge }
export interface MusterPayload { stack: Stack, recruit: MusterChoice }

// Vue's reactive() unwrapping loses Battle's private members at the type level (though not at
// runtime), so a reactive TitanGame fails structural assignability against the full TitanGame
// type; none of the getters below touch activeBattle, so exclude it from what they require.
type GameState = Omit<TitanGame, "activeBattle">

// gameBattle/gamePersistence are mixed onto TitanGame.prototype by the Object.assign below,
// which the type checker cannot see; this interface declares what they contribute.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TitanGame extends GameBattle, GamePersistence {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TitanGame {
  readonly players: Player[]
  readonly stacks: Stack[]
  readonly creaturePool: Record<CreatureType, number>

  round: number // 0-indexed
  mulliganTaken: boolean
  activeRoll?: number
  activePlayer: number
  activePhase: MasterboardPhase
  activeBattle?: Battle
  activeBattleHex?: number

  constructor(numPlayers: number, random: Random = defaultRandom) {
    this.round = 0
    this.mulliganTaken = false
    this.activePlayer = 0
    this.activeRoll = undefined
    this.activeBattle = undefined
    this.activeBattleHex = undefined
    this.activePhase = MasterboardPhase.SPLIT
    // Capped at 5 colors, not 6: BROWN has no crest SVGs (only 5 colors x 12
    // markers exist), so 6-player support can't return until stack marker art
    // is created for it.
    const colors = random.shuffle(range(0, 5))
    this.players = range(0, numPlayers).map(i => new Player(colors[i], `Player ${i + 1}`))
    this.stacks = this.players.map((player: Player, i: number) =>
      new Stack(player?.id, INITIAL_HEXES[numPlayers][i], 0))

    this.creaturePool = Object.fromEntries(CREATURE_LIST
      .map(creature => [creature.type, creature.initialQuantity])) as Record<CreatureType, number>
    this.stacks.flatMap(stack => stack.creatures).forEach(creature => this.creaturePool[creature]--)
  }

  // Actions

  async doNextPhase(): Promise<void> {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        // TODO: check mayProceed before advancing — round-1 split rule (exactly 4 creatures with 1 lord) not yet enforced
        getActiveStacks(this).filter(stack => stack.numSplitting() > 0).forEach(stack => {
          // Each pushed stack claims a marker, so the next split needs a fresh read.
          this.stacks.push(finalizeSplit(stack, getNextMarker(this)!))
        })
        this.mulliganTaken = false
        break
      case MasterboardPhase.MOVE: {
        const engagedStacks = getEngagedStacks(this)
        // TODO: handle 2+ simultaneous engagements — no UI yet exists to let the player choose
        // which battle to resolve first. Refusing to advance keeps the game out of a battle
        // phase with no battle to resolve.
        assert(engagedStacks.length <= 1, "Multiple simultaneous engagements are unsupported")
        this.activeRoll = undefined
        // TODO: recombine splits that failed to move
        if (engagedStacks.length === 0) {
          nextPhase(this)
        } else {
          void this.doInitiateBattle(engagedStacks[0])
        }
        break
      }
      case MasterboardPhase.BATTLE:
        assert(this.activeBattle !== undefined, "Incomplete battle!")
        break
      case MasterboardPhase.MUSTER:
        getActiveStacks(this)
          .filter((stack): stack is Stack & { currentMuster: MusterChoice } => stack.currentMuster !== undefined)
          .forEach(stack => {
            const recruitedCreature = finalizeMuster(this.round, stack)
            this.creaturePool[recruitedCreature]--
          })
    }
    nextPhase(this)
    if (this.activePhase === MasterboardPhase.SPLIT) {
      // Every other case above leaves activePhase at MOVE, BATTLE, or MUSTER;
      // only wrapping past END back to SPLIT lands here.
      getActiveStacks(this).forEach(startPlayerTurn)
    }
    await this.persist()
  }

  async doSetRoll(payload?: number): Promise<void> {
    if (payload === undefined && this.activeRoll !== undefined) {
      assert(getMulliganAvailable(this), "Mulligan unavailable")
    }
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && this.activeRoll !== undefined) {
      this.mulliganTaken = true
    }
    this.activeRoll = payload
    await this.persist()
  }

  async doMove({ stack, hex, edge }: MovePayload): Promise<void> {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    stack.attackEdge = edge
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
    await this.persist()
  }

  async doSetRecruit({ stack, recruit }: MusterPayload): Promise<void> {
    if (!stack.canMuster()) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (recruit !== undefined &&
      this.creaturePool[recruit[0]] < 1 && !CREATURE_DATA[recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
    await this.persist()
  }

  static hydrate(): TitanGame {
    const game = new TitanGame(2)
    try {
      if (localStorage[GAME_PERSISTENCE_KEY] !== undefined) {
        const hydration = JSON.parse(localStorage[GAME_PERSISTENCE_KEY])
        game.mRehydrate(hydration)
      }
    } catch (e) {
      console.error("Error during hydration", e)
      return new TitanGame(2)
    }
    return game
  }
}

Object.assign(TitanGame.prototype, gameBattle, gamePersistence)

export function getRound(round: number): number {
  return round + 1
}

export function getFirstRound(round: number): boolean {
  return round === 0
}

export function getPlayers(players: Player[]): Player[] {
  return players
}

export function getPlayerById(players: Player[], id: PlayerId): Player {
  const player = players.find(player => player.id === id)
  assert(player !== undefined, `No player with id ${id}`)
  return player
}

export function getStacksForPlayer(stacks: Stack[], owner: PlayerId): Stack[] {
  return stacks.filter(stack => stack.owner === owner)
}

export function getStacksForHex(stacks: Stack[], hex: number): Stack[] {
  return stacks.filter(stack => stack.hex === hex)
}

export function getActivePlayer(players: Player[], activePlayer: number): Player {
  return players[activePlayer]
}

export function getActivePlayerId(players: Player[], activePlayer: number): PlayerId {
  return getActivePlayer(players, activePlayer).id
}

export function getActiveStacks(game: GameState): Stack[] {
  return getStacksForPlayer(game.stacks, getActivePlayerId(game.players, game.activePlayer))
}

export function getNextMarker(game: GameState): number | undefined {
  const usedMarkers = getActiveStacks(game).map(stack => stack.marker)
  return range(0, 12).find(marker => !usedMarkers.includes(marker))
}

export function getPathsForHex(game: GameState, hexNum: number): Path[] {
  if (game.activeRoll === undefined) {
    return []
  }
  const activePlayerId = getActivePlayerId(game.players, game.activePlayer)
  const initialHex = masterboard.getHex(hexNum)
  const paths: Path[] = []
  // [Array of hexes to get where we are, first hex with enemies, current hex]
  type pathing = [MasterboardHex[], Stack | undefined, MasterboardHex]
  const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
  let entry: pathing | undefined
  while ((entry = stack.pop()) !== undefined) {
    const [path, , hex] = entry
    let foe = entry[1]
    const occupants: Stack[] = getStacksForHex(game.stacks, hex.id)
    if (foe === undefined) {
      const foes = occupants.filter((stack: Stack) => stack.owner !== activePlayerId)
      if (foes.length > 0) {
        foe = foes[0]
      }
    }
    if (path.length === game.activeRoll) {
      if (!occupants.some((stack: Stack) => stack.owner === activePlayerId)) {
        paths.push({ foe, path: [...path, hex] })
      }
    } else {
      stack.push(...hex.getMovement(false)
        .filter(edge => path[path.length - 1] !== edge.hex)
        .map(edge => [[...path, hex], foe, edge.hex] as pathing))
    }
  }
  return paths
}

export function getMandatoryMoves(game: GameState): Stack[] {
  return getActiveStacks(game).filter(stack => !stack.hasMoved() &&
    getStacksForHex(game.stacks, stack.origin).length > 1 &&
    getPathsForHex(game, stack.hex).length > 0)
}

export function getMayProceed(game: GameState): boolean {
  switch (game.activePhase) {
    case MasterboardPhase.SPLIT:
      return getActiveStacks(game).every(stack => stack.isValidSplit(game.round === 0))
    case MasterboardPhase.MOVE:
      return getMandatoryMoves(game).length === 0 &&
        getActiveStacks(game).some(stack => stack.hasMoved())
    case MasterboardPhase.BATTLE:
      return true
    case MasterboardPhase.MUSTER:
      return true
    case MasterboardPhase.END:
      return true
  }
}

export function getMulliganAvailable(game: GameState): boolean {
  return game.round === 0 && !game.mulliganTaken &&
    !getActiveStacks(game).some(stack => stack.hasMoved())
}

export function getEngagedStacks(game: GameState): Stack[] {
  const activePlayerId = getActivePlayerId(game.players, game.activePlayer)
  return getActiveStacks(game)
    .filter(stack => getStacksForHex(game.stacks, stack.hex)
      .some(occupant => occupant.owner !== activePlayerId))
}

function startPlayerTurn(stack: Stack): void {
  stack.origin = stack.hex
  stack.attackEdge = undefined
  stack.currentMuster = undefined
}

function finalizeMuster(round: number, stack: Stack & { currentMuster: MusterChoice }): CreatureType {
  stack.recruits[round] = stack.currentMuster
  stack.creatures.push(stack.currentMuster[0])
  return stack.currentMuster[0]
}

function nextPhase(game: TitanGame): void {
  game.activePhase += 1
  if (game.activePhase === MasterboardPhase.END) {
    game.activePlayer += 1
    if (game.activePlayer >= game.players.length) {
      game.activePlayer = 0
      game.round++
    }
    game.activePhase = MasterboardPhase.SPLIT
  }
}
