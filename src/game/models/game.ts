import { range } from "lodash-es"
import { assert } from "@/utils/assert"
import { Battle } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import { GameBattle, gameBattle } from "./game/battle"
import { GamePersistence, gamePersistence } from "./game/persistence"
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

  getRound(): number {
    return this.round + 1
  }

  getFirstRound(): boolean {
    return this.round === 0
  }

  getPlayerById(id: PlayerId): Player {
    const player = this.players.find(player => player.id === id)
    assert(player !== undefined, `No player with id ${id}`)
    return player
  }

  getStacksForPlayer(owner: PlayerId): Stack[] {
    return this.stacks.filter(stack => stack.owner === owner)
  }

  getActiveStacks(): Stack[] {
    return this.getStacksForPlayer(this.getActivePlayerId())
  }

  getNextMarker(): number | undefined {
    const usedMarkers = this.getActiveStacks().map(stack => stack.marker)
    return range(0, 12).find(marker => !usedMarkers.includes(marker))
  }

  getStacksForHex(hex: number): Stack[] {
    return this.stacks.filter(stack => stack.hex === hex)
  }

  getPathsForHex(hexNum: number): Path[] {
    if (this.activeRoll === undefined) {
      return []
    }
    const activePlayerId = this.getActivePlayerId()
    const initialHex = masterboard.getHex(hexNum)
    const paths: Path[] = []
    // [Array of hexes to get where we are, first hex with enemies, current hex]
    type pathing = [MasterboardHex[], Stack | undefined, MasterboardHex]
    const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
    let entry: pathing | undefined
    while ((entry = stack.pop()) !== undefined) {
      const [path, , hex] = entry
      let foe = entry[1]
      const occupants: Stack[] = this.getStacksForHex(hex.id)
      if (foe === undefined) {
        const foes = occupants.filter((stack: Stack) => stack.owner !== activePlayerId)
        if (foes.length > 0) {
          foe = foes[0]
        }
      }
      if (path.length === this.activeRoll) {
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

  getMandatoryMoves(): Stack[] {
    return this.getActiveStacks().filter(stack => !stack.hasMoved() &&
      this.getStacksForHex(stack.origin).length > 1 &&
      this.getPathsForHex(stack.hex).length > 0)
  }

  getActivePlayer(): Player {
    return this.players[this.activePlayer]
  }

  getActivePlayerId(): PlayerId {
    return this.getActivePlayer().id
  }

  getMayProceed(): boolean {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        return this.getActiveStacks().every(stack => stack.isValidSplit(this.round === 0))
      case MasterboardPhase.MOVE:
        return this.getMandatoryMoves().length === 0 &&
          this.getActiveStacks().some(stack => stack.hasMoved())
      case MasterboardPhase.BATTLE:
        return true
      case MasterboardPhase.MUSTER:
        return true
      case MasterboardPhase.END:
        return true
    }
  }

  getMulliganAvailable(): boolean {
    return this.round === 0 && !this.mulliganTaken &&
      !this.getActiveStacks().some(stack => stack.hasMoved())
  }

  getEngagedStacks(): Stack[] {
    const activePlayerId = this.getActivePlayerId()
    return this.getActiveStacks()
      .filter(stack => this.getStacksForHex(stack.hex)
        .some(occupant => occupant.owner !== activePlayerId))
  }

  // Actions

  async nextPhase(): Promise<void> {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        // TODO: check mayProceed before advancing — round-1 split rule (exactly 4 creatures with 1 lord) not yet enforced
        this.getActiveStacks().filter(stack => stack.numSplitting() > 0).forEach(stack => {
          // Each pushed stack claims a marker, so the next split needs a fresh read.
          this.stacks.push(finalizeSplit(stack, this.getNextMarker()!))
        })
        this.mulliganTaken = false
        break
      case MasterboardPhase.MOVE: {
        const engagedStacks = this.getEngagedStacks()
        // TODO: handle 2+ simultaneous engagements — no UI yet exists to let the player choose
        // which battle to resolve first. Refusing to advance keeps the game out of a battle
        // phase with no battle to resolve.
        assert(engagedStacks.length <= 1, "Multiple simultaneous engagements are unsupported")
        this.activeRoll = undefined
        // TODO: recombine splits that failed to move
        if (engagedStacks.length === 0) {
          advancePhase(this)
        } else {
          void this.initiateBattle(engagedStacks[0])
        }
        break
      }
      case MasterboardPhase.BATTLE:
        assert(this.activeBattle !== undefined, "Incomplete battle!")
        break
      case MasterboardPhase.MUSTER:
        this.getActiveStacks()
          .filter((stack): stack is Stack & { currentMuster: MusterChoice } => stack.currentMuster !== undefined)
          .forEach(stack => {
            const recruitedCreature = finalizeMuster(this.round, stack)
            this.creaturePool[recruitedCreature]--
          })
    }
    advancePhase(this)
    if (this.activePhase === MasterboardPhase.SPLIT) {
      // Every other case above leaves activePhase at MOVE, BATTLE, or MUSTER;
      // only wrapping past END back to SPLIT lands here.
      this.getActiveStacks().forEach(startPlayerTurn)
    }
  }

  async setRoll(payload?: number): Promise<void> {
    if (payload === undefined && this.activeRoll !== undefined) {
      assert(this.getMulliganAvailable(), "Mulligan unavailable")
    }
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && this.activeRoll !== undefined) {
      this.mulliganTaken = true
    }
    this.activeRoll = payload
  }

  async move({ stack, hex, edge }: MovePayload): Promise<void> {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    stack.attackEdge = edge
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
  }

  async setRecruit({ stack, recruit }: MusterPayload): Promise<void> {
    if (!stack.canMuster()) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (recruit !== undefined &&
      this.creaturePool[recruit[0]] < 1 && !CREATURE_DATA[recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
  }

  static hydrate(persisted?: string): TitanGame {
    const game = new TitanGame(2)
    try {
      if (persisted !== undefined) {
        const hydration = JSON.parse(persisted)
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

function advancePhase(game: TitanGame): void {
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
