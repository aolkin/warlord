import _ from "lodash"
import { CREATURE_DATA, CREATURE_LIST, CreatureType } from "./creature"
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

interface Getters {
  readonly stacks: Stack[]
  readonly stacksForHex: Stack[]
}

interface MusterPayload {
  stack: Stack
  creature: CreatureType
}

export class TitanGame {
  readonly players: Player[]
  readonly creaturePool: Record<CreatureType, number>

  firstRound: boolean
  activeRoll?: number
  activePlayer: number
  activePhase: MasterboardPhase

  constructor(numPlayers: number) {
    this.firstRound = true
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

  getActivePlayer(): Player {
    return this.players[this.activePlayer]
  }

  mNextTurn(): Player {
    this.activePlayer += 1
    if (this.activePlayer >= this.players.length) {
      this.activePlayer = 0
      this.firstRound = false
    }
    this.activeRoll = undefined
    this.activePhase = MasterboardPhase.SPLIT
    return this.players[this.activePlayer]
  }

  mNextPhase(): MasterboardPhase {
    this.activePhase += 1
    if (this.activePhase === MasterboardPhase.END) {
      this.mNextTurn()
    }
    return this.activePhase
  }

  mSetRoll(payload: number): void {
    this.activeRoll = payload
    this.activePhase = MasterboardPhase.MOVE
  }

  mMuster({ stack, creature }: MusterPayload): void {
    if (this.creaturePool[creature] < 1 && !CREATURE_DATA[creature].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    stack.creatures.push(creature)
    this.creaturePool[creature]--
  }
}
