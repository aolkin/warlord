import _ from "lodash"
import { BaseActionContext } from "~/store/types"
import { View } from "~/store/ui/selection"
import { assert } from "~/utils/assert"
import { Battle, BattleCreature, BattlePhase } from "./battle"
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
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MovePayload { stack: Stack, hex: number | MasterboardHex, edge?: HexEdge }
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
    switch (this.activeBattle?.phase) {
      case BattlePhase.DEFENDER_MOVE:
      case BattlePhase.DEFENDER_STRIKE:
      case BattlePhase.DEFENDER_STRIKEBACK:
        return this.activeBattle.defender
      case BattlePhase.ATTACKER_STRIKEBACK:
      case BattlePhase.ATTACKER_MOVE:
      case BattlePhase.ATTACKER_STRIKE:
        return this.activeBattle.attacker
    }
    return undefined
  }

  getBattleMoves(): (creature: BattleCreature) => Set<number> {
    return (creature: BattleCreature) => {
      if (this.activeBattle === undefined) {
        return new Set<number>()
      }
      return this.activeBattle.movementFor(creature)
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

  mMuster({ stack, recruit }: MusterPayload): void {
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
  }

  mInitiateBattle({ attacking, defending }: BattlePayload): void {
    assert(attacking.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    this.activeBattle = new Battle(attacking.hex, attacking.attackEdge as HexEdge, attacking, defending)
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

  doInitiateBattle({ commit, getters }: ActionContext, attacking: Stack): void {
    const defending = getters.stacksForHex(attacking.hex)
      .find(stack => stack.owner !== getters.activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attacking.hex}!`)
    commit("initiateBattle", { attacking, defending })
    commit("ui/selections/setView", View.BATTLEBOARD, { root: true })
  }

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
          activeBattle: hydration.activeBattle !== undefined ? Battle.hydrate(hydration.activeBattle) : undefined
        })
      }
    } catch (e) {
      console.error("Error during hydration", e)
      return new TitanGame(2)
    }
    return game
  }
}

async function compressAndEncode(stringified: string): Promise<string | undefined> {
  // @ts-expect-error
  if (window.CompressionStream !== undefined) {
    const stringStream = new ReadableStream({
      start(controller) {
        const buffer = new ArrayBuffer(stringified.length * 2) // 2 bytes for each char
        const bufferView = new Uint16Array(buffer)
        for (let i = 0; i < stringified.length; i++) {
          bufferView[i] = stringified.charCodeAt(i)
        }
        controller.enqueue(buffer)
        controller.close()
      }
    })
    // @ts-expect-error
    const compressedStream = stringStream.pipeThrough(new CompressionStream("gzip"))
    const reader = compressedStream.getReader()
    const result = { value: new Uint8Array(0), done: false }
    let read
    while (!(read = await reader.read() as { value: Uint8Array, done: boolean }).done) {
      const newValue = new Uint8Array(result.value.length + read.value.length)
      newValue.set(result.value)
      newValue.set(read.value, result.value.length)
      result.done = read.done
      result.value = newValue
    }
    return base64ArrayBuffer(result.value)
  }
}

function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let base64 = ""
  const encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

  const bytes = new Uint8Array(arrayBuffer)
  const byteLength = bytes.byteLength
  const byteRemainder = byteLength % 3
  const mainLength = byteLength - byteRemainder

  let a, b, c, d
  let chunk

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63 // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + "=="
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + "="
  }

  return base64
}
