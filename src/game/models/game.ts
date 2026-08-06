import { range } from "lodash-es"
import { BaseActionContext } from "@/store/types"
import { assert } from "@/utils/assert"
import { Battle, BattleCreature, BattlePhaseType } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import { GameBattle, gameBattle } from "./game/battle"
import { GamePersistence, gamePersistence, GAME_PERSISTENCE_KEY } from "./game/persistence"
import masterboard, { HexEdge, MasterboardHex } from "./masterboard"
import { Player, PlayerId } from "./player"
import { defaultRandom, Random } from "./random"
import { MusterChoice, Stack } from "./stack"

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

export interface Getters {
  readonly round: number // 1-indexed
  readonly firstRound: boolean
  readonly players: Player[]
  readonly activeStacks: Stack[]
  readonly playerById: (player: PlayerId) => Player | undefined
  readonly stacksForPlayer: (owner: PlayerId) => Stack[]
  readonly stacksForHex: (hex: number) => Stack[]
  readonly pathsForHex: (hex: number) => Path[]
  readonly nextMarker: number
  readonly mulliganAvailable: boolean
  readonly activePlayer: Player
  readonly activePlayerId: PlayerId
  readonly battleActivePlayer: PlayerId
  readonly battlePhaseType: BattlePhaseType
  readonly battleMoves: Set<number>
  readonly battleEngagements: BattleCreature[]
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MovePayload { stack: Stack, hex: number | MasterboardHex, edge?: HexEdge }
interface MusterPayload { stack: Stack, recruit: MusterChoice }

export interface ActionContext extends BaseActionContext {
  state: TitanGame
  getters: Getters
}

// Methods contributed by gameBattle/gamePersistence are assigned onto TitanGame.prototype via
// Object.assign below rather than declared in the class body, so the store's
// Object.getOwnPropertyNames(TitanGame.prototype) reflection still finds them; this interface
// makes those methods visible to the type checker.
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

  getPlayers(): Player[] {
    return this.players
  }

  getPlayerById() {
    return (id: PlayerId) => this.players.find(player => player.id === id)
  }

  getStacksForPlayer() {
    return (owner: PlayerId) => this.stacks.filter(stack => stack.owner === owner)
  }

  getActiveStacks(getters: Getters): Stack[] {
    return getters.stacksForPlayer(getters.activePlayerId)
  }

  getNextMarker(getters: Getters): number | undefined {
    const usedMarkers = getters.activeStacks.map(stack => stack.marker)
    return range(0, 12).find(marker => !usedMarkers.includes(marker))
  }

  getStacksForHex() {
    return (hex: number) => this.stacks.filter(stack => stack.hex === hex)
  }

  getPathsForHex(getters: Getters): (hex: number) => Path[] {
    return (hexNum: number) => {
      if (this.activeRoll === undefined) {
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
        const occupants: Stack[] = getters.stacksForHex(hex.id)
        if (foe === undefined) {
          const foes = occupants.filter((stack: Stack) => stack.owner !== getters.activePlayerId)
          if (foes.length > 0) {
            foe = foes[0]
          }
        }
        if (path.length === this.activeRoll) {
          if (!occupants.some((stack: Stack) => stack.owner === getters.activePlayerId)) {
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
  }

  getMandatoryMoves(getters: Getters): Stack[] {
    return getters.activeStacks.filter(stack => !stack.hasMoved() &&
      getters.stacksForHex(stack.origin).length > 1 &&
      getters.pathsForHex(stack.hex).length > 0)
  }

  getActivePlayer(): Player {
    return this.players[this.activePlayer]
  }

  getActivePlayerId(getters: Getters): PlayerId {
    return getters.activePlayer.id
  }

  getMayProceed(getters: Getters): boolean {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        return getters.activeStacks.every(stack => stack.isValidSplit(this.round === 0))
      case MasterboardPhase.MOVE:
        return getters.mandatoryMoves.length === 0 &&
          getters.activeStacks.some(stack => stack.hasMoved())
      case MasterboardPhase.BATTLE:
        return true
      case MasterboardPhase.MUSTER:
        return true
      case MasterboardPhase.END:
        return true
    }
  }

  getMulliganAvailable(getters: Getters): boolean {
    return this.round === 0 && !this.mulliganTaken &&
      !getters.activeStacks.some(stack => stack.hasMoved())
  }

  getEngagedStacks(getters: Getters): Stack[] {
    return getters.activeStacks
      .filter(stack => getters.stacksForHex(stack.hex)
        .some(occupant => occupant.owner !== getters.activePlayerId))
  }

  // Mutations

  // Phase Entry/Exit Mutations take Getters and should not be called outside of `doNextPhase()`

  mPhaseExitSplit(getters: Getters): void {
    getters.activeStacks.filter(stack => stack.numSplitting() > 0).forEach(stack => {
      this.stacks.push(stack.finalizeSplit(getters.nextMarker))
    })
  }

  mPhaseEnterMove(getters: Getters): void {
    getters.activeStacks.forEach(stack => {
      stack.origin = stack.hex
      stack.attackEdge = undefined
    })
    this.mulliganTaken = false
  }

  mPhaseExitMove(_getters: Getters): void {
    this.activeRoll = undefined
    // TODO: recombine splits that failed to move
  }

  mPhaseEnterBattle(_getters: Getters): void {
  }

  mPhaseExitBattle(_getters: Getters): void {
  }

  mPhaseEnterMuster(_getters: Getters): void {
  }

  mPhaseExitMuster(getters: Getters): void {
    getters.activeStacks.forEach(stack => {
      if (stack.currentMuster !== undefined) {
        stack.recruits[this.round] = stack.currentMuster
        stack.creatures.push(stack.currentMuster[0])
        this.creaturePool[stack.currentMuster[0]]--
      }
    })
  }

  // End Phase Entry/Exit Mutations

  mNextPhase(getters: Getters): void {
    this.activePhase += 1
    if (this.activePhase === MasterboardPhase.END) {
      this.activePlayer += 1
      if (this.activePlayer >= this.players.length) {
        this.activePlayer = 0
        this.round++
      }
      this.activePhase = MasterboardPhase.SPLIT
      getters.activeStacks.forEach(stack => stack.currentMuster = undefined)
    }
  }

  mSetRoll(payload: number): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && this.activeRoll !== undefined) {
      this.mulliganTaken = true
    }
    this.activeRoll = payload
  }

  mMove({ stack, hex, edge }: MovePayload): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    stack.attackEdge = edge
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
  }

  mMuster({ stack, recruit }: MusterPayload): void {
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
  }

  // Actions

  async doNextPhase({ getters, commit, dispatch }: ActionContext): Promise<void> {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        // TODO: check getters.mayProceed before advancing — round-1 split rule (exactly 4 creatures with 1 lord) not yet enforced
        commit("phaseExitSplit", getters)
        commit("phaseEnterMove", getters)
        break
      case MasterboardPhase.MOVE:
        // TODO: handle 2+ simultaneous engagements — no UI yet exists to let the player choose
        // which battle to resolve first. Refusing to advance keeps the game out of a battle
        // phase with no battle to resolve.
        assert(getters.engagedStacks.length <= 1, "Multiple simultaneous engagements are unsupported")
        commit("phaseExitMove", getters)
        commit("phaseEnterBattle", getters)
        if (getters.engagedStacks.length === 0) {
          commit("nextPhase", getters)
          commit("phaseExitBattle", getters)
          commit("phaseEnterMuster", getters)
        } else {
          dispatch("initiateBattle", getters.engagedStacks[0])
        }
        break
      case MasterboardPhase.BATTLE:
        assert(this.activeBattle !== undefined, "Incomplete battle!")
        commit("phaseExitBattle", getters)
        commit("phaseEnterMuster", getters)
        break
      case MasterboardPhase.MUSTER:
        commit("phaseExitMuster", getters)
    }
    commit("nextPhase", getters)
    await this.persist()
  }

  async doSetRoll({ getters, commit }: ActionContext, payload?: number): Promise<void> {
    if (payload === undefined && this.activeRoll !== undefined) {
      assert(getters.mulliganAvailable, "Mulligan unavailable")
    }
    commit("setRoll", payload)
    await this.persist()
  }

  async doMove({ commit }: ActionContext, payload: MovePayload): Promise<void> {
    commit("move", payload)
    await this.persist()
  }

  async doSetRecruit({ commit }: ActionContext, payload: MusterPayload): Promise<void> {
    if (!payload.stack.canMuster()) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (payload.recruit !== undefined &&
      this.creaturePool[payload.recruit[0]] < 1 && !CREATURE_DATA[payload.recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    commit("muster", payload)
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
