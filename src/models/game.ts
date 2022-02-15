import _ from "lodash"
import { BaseActionContext } from "~/store/types"
import { View } from "~/store/ui/selection"
import { assert } from "~/utils/assert"
import { Battle } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { MasterboardHex } from "./masterboard"
import { Player, PlayerId } from "./player"
import { MusterPossibility, Stack } from "./stack"

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

export type Path = [boolean, MasterboardHex[]]

interface Getters {
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
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MovePayload { stack: Stack, hex: number | MasterboardHex }
interface MusterPayload { stack: Stack, recruit: MusterPossibility }
interface BattlePayload { attacking: Stack, defending: Stack, hex: number }

interface ActionContext extends BaseActionContext {
  state: TitanGame
  getters: Getters
}

const GAME_PERSISTENCE_KEY = "warlord-v1"

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

  constructor(numPlayers: number) {
    this.round = 0
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

  getRound() {
    return this.round + 1
  }

  getFirstRound() {
    return this.round === 0
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
      type pathing = [MasterboardHex[], MasterboardHex | undefined, MasterboardHex]
      const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let [path, foe, hex] = stack.pop()!
        const occupants: Stack[] = getters.stacksForHex(hex.id)
        if (occupants.some((stack: Stack) => stack.owner !== getters.activePlayerId)) {
          foe = hex
        }
        if (path.length === this.activeRoll) {
          if (!occupants.some((stack: Stack) => stack.owner === getters.activePlayerId)) {
            paths.push([foe !== undefined, [...path.splice(1), hex]])
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
    getters.activeStacks.forEach(stack => stack.origin = stack.hex)
    this.mulliganTaken = false
  }

  mPhaseExitMove(getters: Getters): void {
    this.activeRoll = undefined
    // TODO: recombine splits that failed to move
  }

  mPhaseEnterBattle(getters: Getters): void {
  }

  mPhaseExitBattle(getters: Getters): void {
  }

  mPhaseEnterMuster(getters: Getters): void {
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

  mMove({ stack, hex }: MovePayload): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
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

  mInitiateBattle({ hex, attacking, defending }: BattlePayload): void {
    this.activeBattle = new Battle(hex, attacking, defending)
  }

  // Actions

  doNextPhase({ getters, commit, dispatch }: ActionContext): void {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        commit("phaseExitSplit", getters)
        commit("phaseEnterMove", getters)
        break
      case MasterboardPhase.MOVE:
        commit("phaseExitMove", getters)
        commit("phaseEnterBattle", getters)
        if (getters.engagedStacks.length === 0) {
          commit("nextPhase", getters)
          commit("phaseExitBattle", getters)
          commit("phaseEnterMuster", getters)
        } else if (getters.engagedStacks.length === 1) {
          dispatch("initiateBattle", getters.engagedStacks[0].hex)
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

  doSetRecruit({ commit }: ActionContext, payload: MusterPayload): void {
    if (!payload.stack.canMuster()) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (payload.recruit !== undefined &&
      this.creaturePool[payload.recruit[0]] < 1 && !CREATURE_DATA[payload.recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    commit("muster", payload)
    this.persist()
  }

  doInitiateBattle({ commit, getters }: ActionContext, hex: number) {
    const stacks = getters.stacksForHex(hex)
    const attacking = stacks.find(stack => stack.owner === getters.activePlayerId) as Stack
    const defending = stacks.find(stack => stack.owner !== getters.activePlayerId) as Stack
    assert(attacking !== undefined && defending !== undefined,
      `No engagement present on hex ${hex}!`)
    commit("initiateBattle", { hex, attacking, defending })
    commit("ui/selections/setView", View.BATTLEBOARD, { root: true })
  }

  persist() {
    localStorage[GAME_PERSISTENCE_KEY] = JSON.stringify(this)
  }

  static hydrate(): TitanGame {
    const game = new TitanGame(2)
    try {
      if (localStorage[GAME_PERSISTENCE_KEY] !== undefined) {
        const hydration = JSON.parse(localStorage[GAME_PERSISTENCE_KEY])
        _.assign(game, {
          ...hydration,
          players: hydration.players.map((player: Player) =>
            _.assign(new Player(player.id, player.name), player)),
          stacks: hydration.stacks.map((stack: Stack) =>
            _.assign(new Stack(stack.owner, stack.hex, stack.marker, stack.creatures), stack)),
          activeBattle: Battle.hydrate(hydration.activeBattle)
        })
      }
    } catch (e) {
      console.error("Error during hydration", e)
      return new TitanGame(2)
    }
    return game
  }
}
