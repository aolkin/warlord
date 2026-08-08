import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { MasterboardPhase, TitanGame } from "@/models/game"
import vuexStore from "~/plugins/vuex"
import { useGameStore } from "~/stores/game"

const vuexGame = (): TitanGame => (vuexStore.state as unknown as { game: TitanGame }).game

describe("game store alongside the vuex game module", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useGameStore().reset()
  })

  it("wraps the instance the vuex module holds", () => {
    expect(useGameStore().game).toBe(vuexGame())
  })

  it("sees state a vuex action changed", async () => {
    const gameStore = useGameStore()
    vuexGame().activePhase = MasterboardPhase.MOVE

    await vuexStore.dispatch("game/setRoll", 4)
    await nextTick()

    expect(gameStore.game.activeRoll).toBe(4)
  })

  it("drives vuex getters when its own actions change state", async () => {
    const gameStore = useGameStore()
    gameStore.game.activePhase = MasterboardPhase.MOVE

    await gameStore.setRoll(6)
    await nextTick()

    expect(vuexGame().activeRoll).toBe(6)
    expect(vuexStore.getters["game/mayProceed"]).toBe(gameStore.mayProceed)
  })

  it("advances the phase and splits stacks through its own action", async () => {
    const gameStore = useGameStore()
    const stack = gameStore.activeStacks[0]
    stack.split[2] = true
    stack.split[4] = true
    stack.split[6] = true
    const before = gameStore.game.stacks.length

    await gameStore.nextPhase()

    expect(gameStore.game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(gameStore.game.stacks).toHaveLength(before + 1)
  })
})
