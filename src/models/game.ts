import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
import masterboard, { MasterboardHex } from "./masterboard"
import { Player } from "./player"
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
  readonly stacks: Stack[]
  readonly stacksForHex: (hex: number) => Stack[]
  readonly pathsForHex: (hex: number) => Path[]
  readonly activePlayer: Player
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

interface MusterPayload {
  stack: Stack
  creature: CreatureType
}

interface ActionContext {
  state: TitanGame
  getters: Getters
  commit: (mutation: string, payload?: any) => void
  dispatch: (action: string, payload?: any) => void
}

export class TitanGame {
  readonly players: Player[]
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
    this.players = _.range(0, numPlayers).map(
      i => new Player(colors[i], INITIAL_HEXES[numPlayers][i], `Player ${i + 1}`))
    this.creaturePool = Object.fromEntries(CREATURE_LIST
      .map(creature => [creature.type, creature.initialQuantity])) as Record<CreatureType, number>
    this.players.flatMap(
      player => player.stacks.flatMap(
        stack => stack.creatures)).forEach(creature => this.creaturePool[creature]--)
  }

  getStacks(): Stack[] {
    return this.players.map(player => player.stacks).flat()
  }

  getStacksForHex(getters: Getters) {
    return (hex: number) => getters.stacks.filter(stack => stack.hex === hex)
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
        const [path, hex] = stack.pop()!
        const occupants: Stack[] = getters.stacksForHex(hex.id)
        const foe = occupants.some((stack: Stack) => stack.player !== getters.activePlayer)
        if (path.length === this.activeRoll) {
          if (!occupants.some((stack: Stack) => stack.player === getters.activePlayer)) {
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
    return getters.activePlayer.stacks.filter(stack => !stack.hasMoved() &&
      getters.stacksForHex(stack.origin).length > 1 &&
      getters.pathsForHex(stack.hex).length > 0)
  }

  getActivePlayer(): Player {
    return this.players[this.activePlayer]
  }

  getMayProceed(getters: Getters): boolean {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        return getters.activePlayer.stacks.every(stack => stack.isValidSplit(this.firstRound))
      case MasterboardPhase.MOVE:
        return getters.mandatoryMoves.length === 0 &&
          getters.activePlayer.stacks.some(stack => stack.hasMoved())
      case MasterboardPhase.BATTLE:
        return true
      case MasterboardPhase.MUSTER:
        return true
      case MasterboardPhase.END:
        return true
    }
  }

  getMulliganAvailable(): boolean {
    return this.firstRound && !this.mulliganTaken &&
      !this.getActivePlayer().stacks.some(stack => stack.hasMoved())
  }

  getEngagedStacks(getters: Getters): Stack[] {
    return getters.activePlayer.stacks
      .filter(stack => getters.stacksForHex(stack.hex)
        .some(occupant => occupant.player !== getters.activePlayer))
  }

  mNextTurn(): void {
    this.activePlayer += 1
    if (this.activePlayer >= this.players.length) {
      this.activePlayer = 0
      this.firstRound = false
    }
    this.activePhase = MasterboardPhase.SPLIT
  }

  mPhaseExitSplit(): void {
    const player = this.getActivePlayer()
    player.stacks.filter(stack => stack.numSplitting() > 0).forEach(stack => {
      player.stacks.push(stack.finalizeSplit(player.markers.shift()!))
    })
  }

  mPhaseEnterMove(): void {
    this.getActivePlayer().stacks.forEach(stack => stack.origin = stack.hex)
    this.mulliganTaken = false
  }

  mPhaseExitMove(): void {
    this.mSetRoll(undefined)
    // TODO: recombine splits that failed to move
  }

  mNextPhase(): void {
    this.activePhase += 1
    if (this.activePhase === MasterboardPhase.END) {
      this.mNextTurn()
    }
  }

  doNextPhase({ getters, commit }: ActionContext): void {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        commit("phaseExitSplit")
        commit("phaseEnterMove")
        break
      case MasterboardPhase.MOVE:
        commit("phaseExitMove")
        if (getters.engagedStacks.length === 0) {
          commit("nextPhase")
        }
        break
      case MasterboardPhase.BATTLE:
        break
    }
    commit("nextPhase")
  }

  mSetRoll(payload?: number): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    this.activeRoll = payload
  }

  mMulligan(): void {
    assert(this.getMulliganAvailable(), "Can only mulligan first die roll")
    this.activeRoll = undefined
    this.mulliganTaken = true
  }

  mMove({ stack, hex }: { stack: Stack, hex: number | MasterboardHex }): void {
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
}
