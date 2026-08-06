import { assign } from "lodash-es"
import { compressAndEncode, decodeAndDecompress } from "~/utils/base64"
import { Battle } from "../battle"
import { Player } from "../player"
import { Stack } from "../stack"
import type { ActionContext, TitanGame } from "../game"

export const GAME_PERSISTENCE_KEY = "warlord-v1"

export interface GamePersistence {
  doPersist(context: ActionContext): Promise<string | undefined>
  persist(): Promise<string | undefined>
  mRehydrate(hydration: TitanGame): void
  doRestore(context: ActionContext, encoded: string): Promise<void>
}

export const gamePersistence: GamePersistence & ThisType<TitanGame> = {
  async doPersist({ commit }: ActionContext): Promise<string | undefined> {
    const b64 = await this.persist()
    commit("setEncodedSaveData", b64, { root: true })
    return b64
  },

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

  async doRestore({ commit }: ActionContext, encoded: string): Promise<void> {
    const hydration = await decodeAndDecompress(encoded)
    if (hydration === undefined) {
      throw new Error("Failed to load save data")
    }
    commit("rehydrate", JSON.parse(hydration))
  }
}
