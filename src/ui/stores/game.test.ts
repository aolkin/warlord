import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { MasterboardPhase } from "@/models/game"
import { useGameStore } from "~/stores/game"

describe("game store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useGameStore().reset()
  })

  it("derives getters that build on other getters", () => {
    const gameStore = useGameStore()

    expect(gameStore.activePlayerId).toBe(gameStore.activePlayer.id)
    expect(gameStore.activeStacks).toEqual(gameStore.game.getStacksForPlayer(gameStore.activePlayerId))
  })

  it("advances the phase and splits stacks through its own action", async () => {
    const gameStore = useGameStore()
    const stack = gameStore.activeStacks[0]
    stack.split[2] = true
    stack.split[4] = true
    stack.split[6] = true
    const before = gameStore.game.stacks.length

    await gameStore.game.doNextPhase()

    expect(gameStore.game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(gameStore.game.stacks).toHaveLength(before + 1)
  })

  it("recomputes getters after an action changes state", async () => {
    const gameStore = useGameStore()
    gameStore.game.activePhase = MasterboardPhase.MOVE

    await gameStore.game.doSetRoll(4)

    expect(gameStore.game.activeRoll).toBe(4)
    expect(gameStore.mulliganAvailable).toBe(true)
  })
})
