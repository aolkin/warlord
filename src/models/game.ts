import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { MasterboardHex } from "./masterboard"
import { Player, PlayerId } from "./player"
import { Stack } from "./stack"

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

export type Path = Array<[boolean, MasterboardHex]>

interface Getters {
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
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MusterPayload { stack: Stack, creature: CreatureType }
interface MovePayload { stack: Stack, hex: number | MasterboardHex }

interface ActionContext {
  state: TitanGame
  getters: Getters
  commit: (mutation: string, payload?: any, options?: object) => void
  dispatch: (action: string, payload?: any) => void
}

const GAME_PERSISTENCE_KEY = "warlord-v1"

export class TitanGame {
  readonly players: Player[]
  readonly stacks: Stack[]
  readonly creaturePool: Record<CreatureType, number>

  firstRound: boolean
  mulliganTaken: boolean
  activeRoll?: number
  activePlayer: number
  activePhase: MasterboardPhase

  constructor(numPlayers: number) {
    this.firstRound = true
    this.mulliganTaken = false
    this.activePlayer = 0
    this.activePhase = MasterboardPhase.SPLIT
    const colors = _.shuffle(_.range(0, 5))
    this.players = _.range(0, numPlayers).map(i => new Player(colors[i], `Player ${i + 1}`))
    this.stacks = this.players.map((player: Player, i: number) =>
      new Stack(player?.id, INITIAL_HEXES[numPlayers][i], 0))

    this.creaturePool = Object.fromEntries(CREATURE_LIST
      .map(creature => [creature.type, creature.initialQuantity])) as Record<CreatureType, number>
    this.stacks.flatMap(stack => stack.creatures).forEach(creature => this.creaturePool[creature]--)
  }

  getPlayers() {
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
    return _.range(0, 12).find(marker => !usedMarkers.includes(marker))
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
      type pathing = [Array<[boolean, MasterboardHex]>, MasterboardHex]
      const stack: pathing[] = initialHex.getMovement(true).map(edge => [[[false, initialHex]], edge.hex])
      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [path, hex] = stack.pop()!
        const occupants: Stack[] = getters.stacksForHex(hex.id)
        const foe = occupants.some((stack: Stack) => stack.owner !== getters.activePlayerId)
        if (foe || path.length === this.activeRoll) {
          if (!occupants.some((stack: Stack) => stack.owner === getters.activePlayerId)) {
            paths.push([...path.splice(1), [foe, hex]])
          }
        } else {
          stack.push(...hex.getMovement(false)
            .filter(edge => path[path.length - 1][1] !== edge.hex)
            .map(edge => [[...path, [foe, hex]], edge.hex] as pathing))
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
        return getters.activeStacks.every(stack => stack.isValidSplit(this.firstRound))
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
    return this.firstRound && !this.mulliganTaken &&
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
    getters.activeStacks.forEach(stack => stack.origin = stack.hex)
    this.mulliganTaken = false
  }

  mPhaseExitMove(getters: Getters): void {
    this.activeRoll = undefined
    // TODO: recombine splits that failed to move
  }

  // End Phase Entry/Exit Mutations

  mNextPhase(): void {
    this.activePhase += 1
    if (this.activePhase === MasterboardPhase.END) {
      this.activePlayer += 1
      if (this.activePlayer >= this.players.length) {
        this.activePlayer = 0
        this.firstRound = false
      }
      this.activePhase = MasterboardPhase.SPLIT
    }
  }

  mSetRoll(payload: number): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && this.activeRoll !== undefined) {
      this.mulliganTaken = true
    }
    this.activeRoll = payload
  }

  mMove({ stack, hex }: MovePayload): void {
    console.log(stack, hex)
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
  }

  mMuster({ stack, creature }: MusterPayload): void {
    if (this.creaturePool[creature] < 1 && !CREATURE_DATA[creature].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    stack.creatures.push(creature)
    this.creaturePool[creature]--
  }

  // Actions

  doNextPhase({ getters, commit }: ActionContext): void {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        commit("phaseExitSplit", getters)
        commit("phaseEnterMove", getters)
        break
      case MasterboardPhase.MOVE:
        commit("phaseExitMove", getters)
        if (getters.engagedStacks.length === 0) {
          commit("nextPhase")
        }
        break
      case MasterboardPhase.BATTLE:
        break
    }
    commit("nextPhase")
    commit("ui/selections/deselectStack", null, { root: true })
    this.persist()
  }

  doSetRoll({ getters, commit }: ActionContext, payload?: number): void {
    if (payload === undefined && this.activeRoll !== undefined) {
      assert(getters.mulliganAvailable, "Mulligan unavailable")
    }
    commit("setRoll", payload)
    this.persist()
  }

  doMove({ commit }: ActionContext, payload: MovePayload): void {
    commit("move", payload)
    this.persist()
  }

  doMuster({ commit }: ActionContext, payload: MusterPayload): void {
    commit("muster", payload)
    this.persist()
  }

  persist() {
    localStorage[GAME_PERSISTENCE_KEY] = JSON.stringify(this)
  }

  static hydrate(): TitanGame {
    const game = new TitanGame(2)
    if (localStorage[GAME_PERSISTENCE_KEY] !== undefined) {
      const hydration = JSON.parse(localStorage[GAME_PERSISTENCE_KEY])
      hydration.players = hydration.players.map((player: Player) =>
        _.assign(new Player(player.id, player.name), player))
      hydration.stacks = hydration.stacks.map((stack: Stack) =>
        new Stack(stack.owner, stack.hex, stack.marker, stack.creatures))
      _.assign(game, hydration)
    }
    return game
  }
}
