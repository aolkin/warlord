import { assign } from "lodash-es"
import { compressAndEncode, decodeAndDecompress } from "@/utils/base64"
import { Battle } from "../battle"
import { Player } from "../player"
import { Stack } from "../stack"
import type { TitanGame } from "../game"

export const GAME_PERSISTENCE_KEY = "warlord-v1"

export interface GamePersistence {
  persist(): Promise<string | undefined>
  mRehydrate(hydration: TitanGame): void
  doRestore(encoded: string): Promise<void>
}

export const gamePersistence: GamePersistence & ThisType<TitanGame> = {
  async persist(): Promise<string | undefined> {
    const stringified = JSON.stringify(this)
    localStorage[GAME_PERSISTENCE_KEY] = stringified
    return await compressAndEncode(stringified)
  },

  mRehydrate(hydration: TitanGame): void {
    assign(this, {
      ...hydration,
      players: hydration.players.map((player: Player) =>
        assign(new Player(player.id, player.name), player)),
      stacks: hydration.stacks.map((stack: Stack) =>
        assign(new Stack(stack.owner, stack.hex, stack.marker, stack.creatures), stack)),
      activeBattle: hydration.activeBattle !== undefined ? Battle.hydrate(hydration.activeBattle) : undefined
    })
  },

  async doRestore(encoded: string): Promise<void> {
    const hydration = await decodeAndDecompress(encoded)
    if (hydration === undefined) {
      throw new Error("Failed to load save data")
    }
    this.mRehydrate(JSON.parse(hydration))
  }
}
