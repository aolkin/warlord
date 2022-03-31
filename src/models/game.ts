import _ from "lodash"
import { BaseActionContext } from "~/store/types"
import { View } from "~/store/ui/selection"
import { assert } from "~/utils/assert"
import { compressAndEncode, decodeAndDecompress } from "~/utils/base64"
import { Battle, BATTLE_PHASE_TYPES, BattleCreature, BattlePhase, BattlePhaseType } from "./battle"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { HexEdge, MasterboardHex } from "./masterboard"
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

export interface Path {
  foe?: Stack
  path: MasterboardHex[]
}

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
  readonly battleActivePlayer: PlayerId
  readonly battlePhaseType: BattlePhaseType
  readonly battleMoves: Set<number>
  readonly battleEngagements: BattleCreature[]
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MovePayload { stack: Stack, hex: number | MasterboardHex, edge?: HexEdge }
interface BattleMovePayload { creature: BattleCreature, hex: number }
interface MusterPayload { stack: Stack, recruit: MusterPossibility }
interface BattlePayload { attacking: Stack, defending: Stack }

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
      // [Array of hexes to get where we are, first hex with enemies, current hex]
      type pathing = [MasterboardHex[], Stack | undefined, MasterboardHex]
      const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
      let entry: pathing | undefined
      while ((entry = stack.pop()) !== undefined) {
        let [path, foe, hex] = entry
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

  getBattleActivePlayer(): PlayerId | undefined {
    return this.activeBattle?.getActivePlayer()
  }

  getBattlePhaseType(): BattlePhaseType | undefined {
    return this.activeBattle === undefined ? undefined : BATTLE_PHASE_TYPES[this.activeBattle.phase]
  }

  getBattleMoves(): (creature: BattleCreature) => Set<number> {
    return (creature: BattleCreature) => {
      return this.activeBattle === undefined ? new Set<number>() : this.activeBattle.movementFor(creature)
    }
  }

  getBattleEngagements(): (creature: BattleCreature) => BattleCreature[] {
    return (creature: BattleCreature) => {
      return this.activeBattle === undefined ? [] : this.activeBattle.engagedWith(creature)
    }
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

  mMove({ stack, hex, edge }: MovePayload): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    stack.attackEdge = edge
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
  }

  mMoveCreature({ creature, hex }: BattleMovePayload): void {
    assert(this.activeBattle?.creatures.some(_.matches(creature)) ?? false, "Unexpected creature")
    creature.hex = hex
  }

  mMuster({ stack, recruit }: MusterPayload): void {
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
  }

  mInitiateBattle({ attacking, defending }: BattlePayload): void {
    assert(attacking.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    this.activeBattle = new Battle(attacking.hex, attacking.attackEdge as HexEdge, this, attacking, defending)
  }

  mNextBattlePhase(): void {
    assert(this.activeBattle !== undefined, "No active battle!")
    this.activeBattle?.nextPhase()
  }

  // Actions

  async doNextPhase({ getters, commit, dispatch }: ActionContext): Promise<void> {
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
    commit("ui/selections/deselectStack", null, { root: true })
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

  /*
   *** BATTLE FUNCTIONS ***
   */

  async doInitiateBattle({ commit, getters }: ActionContext, attacking: Stack): Promise<void> {
    const defending = getters.stacksForHex(attacking.hex)
      .find(stack => stack.owner !== getters.activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attacking.hex}!`)
    commit("initiateBattle", { attacking, defending })
    commit("ui/selections/setView", View.BATTLEBOARD, { root: true })
    await this.persist()
  }

  async doMoveCreature({ getters, commit }: ActionContext, payload: BattleMovePayload): Promise<void> {
    assert(this.activeBattle?.phase === BattlePhase.DEFENDER_MOVE ||
      this.activeBattle?.phase === BattlePhase.ATTACKER_MOVE, "Not in movement phase")
    assert(payload.creature.player === this.getBattleActivePlayer(), "Incorrect player")
    commit("moveCreature", payload)
    await this.persist()
  }

  async doNextBattlePhase({ getters, commit }: ActionContext): Promise<void> {
    commit("nextBattlePhase")
    await this.persist()
  }

  /*
   *** PERSISTENCE FUNCTIONS ***
   */

  async doPersist({ commit }: ActionContext): Promise<string | undefined> {
    console.log(localStorage[GAME_PERSISTENCE_KEY])
    const b64 = await this.persist()
    commit("setEncodedSaveData", b64, { root: true })
    return b64
  }

  async persist(): Promise<string | undefined> {
    const stringified = JSON.stringify(this)
    localStorage[GAME_PERSISTENCE_KEY] = stringified
    return await compressAndEncode(stringified)
  }

  mRehydrate(hydration: TitanGame): void {
    _.assign(this, {
      ...hydration,
      players: hydration.players.map((player: Player) =>
        _.assign(new Player(player.id, player.name), player)),
      stacks: hydration.stacks.map((stack: Stack) =>
        _.assign(new Stack(stack.owner, stack.hex, stack.marker, stack.creatures), stack)),
      activeBattle: hydration.activeBattle !== undefined ? Battle.hydrate(hydration.activeBattle, this) : undefined
    })
  }

  async doRestore({ commit }: ActionContext, encoded: string): Promise<void> {
    const hydration = await decodeAndDecompress(encoded)
    if (hydration === undefined) {
      throw new Error("Failed to load save data")
    }
    commit("rehydrate", JSON.parse(hydration))
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
