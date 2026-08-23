import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { TitanGame } from "@/models/game"
import { StackRef } from "@/models/stack"

const GAME_PERSISTENCE_KEY = "warlord-v1"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // The instance itself is the store's state.
  const game = reactive(TitanGame.hydrate(localStorage[GAME_PERSISTENCE_KEY]))

  // The engine has no browser dependencies, so
  // persistence lives here instead of at the end of every action. A deep watcher on the
  // reactive game proxy coalesces every synchronous mutation within one action into a single
  // write, and doesn't fire for this initial hydration since that happens before the
  // `reactive()` wrap above.
  watch(
    game,
    () => {
      localStorage[GAME_PERSISTENCE_KEY] = JSON.stringify(game)
    },
    { deep: true },
  )

  // Caching earns its bookkeeping only for rules that scan or search the state graph and are
  // read from more than one place. Everything cheaper is called straight off `game`.
  const activeStacks = computed(() => TitanGame.getStacksForPlayer(game))
  const mandatoryMoves = computed(() => TitanGame.getMandatoryMoves(game))

  // A split needs at least 2 creatures remaining and 2 splitting off, so any stack of 2 or
  // fewer can never produce a valid split.
  function isSplittable(stack: StackRef): boolean {
    const found = game.stacks.find(s => s.id === stack)
    return (
      found !== undefined &&
      found.owner === game.activePlayerId &&
      TitanGame.isSplitPhase(game) &&
      found.creatures.length > 2
    )
  }

  return {
    game,
    activeStacks,
    mandatoryMoves,
    isSplittable,
    reset: (): void => {
      Object.assign(game, TitanGame.create(2))
    },
  }
})
