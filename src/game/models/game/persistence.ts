import { assign } from "lodash-es"
import { Battle } from "../battle"
import { Player } from "../player"
import { Stack } from "../stack"
import type { TitanGame } from "../game"

export interface GamePersistence {
  mRehydrate(hydration: TitanGame): void
}

export const gamePersistence: GamePersistence & ThisType<TitanGame> = {
  mRehydrate(hydration: TitanGame): void {
    assign(this, {
      ...hydration,
      players: hydration.players.map((player: Player) =>
        assign(new Player(player.id, player.name), player)),
      stacks: hydration.stacks.map((stack: Stack) =>
        assign(new Stack(stack.owner, stack.hex, stack.marker, stack.creatures), stack)),
      activeBattle: hydration.activeBattle !== undefined ? Battle.hydrate(hydration.activeBattle) : undefined
    })
  }
}
