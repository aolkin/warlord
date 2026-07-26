import { range, shuffle } from "lodash-es"
import { Battle } from "~/models/battle"
import { CREATURE_LIST, CreatureType } from "~/models/creature"
import { Player } from "~/models/player"
import { Stack } from "~/models/stack"
import { GameActions, gameActions } from "./actions"
import { GameGetters, gameGetters } from "./getters"
import { GameMutations, gameMutations } from "./mutations"
import { GAME_PERSISTENCE_KEY, GamePersistence, gamePersistence } from "./persistence"
import { MasterboardPhase } from "./types"

export { MasterboardPhase }
export type { Path } from "./types"

const INITIAL_HEXES: Record<number, number[]> = {
  2: [100, 400],
  3: [100, 300, 500],
  4: [200, 300, 500, 600],
  5: [100, 200, 300, 400, 500],
  6: [100, 200, 300, 400, 500, 600]
}

// Methods are assigned onto TitanGame.prototype via Object.assign below rather than declared
// in the class body, so the store's Object.getOwnPropertyNames(TitanGame.prototype) reflection
// still finds them; this interface makes those methods visible to the type checker.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TitanGame extends GameGetters, GameMutations, GameActions, GamePersistence {}

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

  constructor(numPlayers: number) {
    this.round = 0
    this.mulliganTaken = false
    this.activePlayer = 0
    this.activeRoll = undefined
    this.activeBattle = undefined
    this.activePhase = MasterboardPhase.SPLIT
    const colors = shuffle(range(0, 5))
    this.players = range(0, numPlayers).map(i => new Player(colors[i], `Player ${i + 1}`))
    this.stacks = this.players.map((player: Player, i: number) =>
      new Stack(player?.id, INITIAL_HEXES[numPlayers][i], 0))

    this.creaturePool = Object.fromEntries(CREATURE_LIST
      .map(creature => [creature.type, creature.initialQuantity])) as Record<CreatureType, number>
    this.stacks.flatMap(stack => stack.creatures).forEach(creature => this.creaturePool[creature]--)
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

Object.assign(TitanGame.prototype, gameGetters, gameMutations, gameActions, gamePersistence)
