<template>
  <div
    id="dicebox-container"
    :class="{ rolling, quickDice: preferencesStore.quickDice }"
  >
    <div class="bg">
&nbsp;
    </div>
  </div>
</template>

<script setup lang="ts">
import DiceBox from "@3d-dice/dice-box"
import { markRaw, onMounted, ref } from "vue"
import { random, range } from "lodash-es"
import { usePreferencesStore } from "~/stores/ui/preferences"

const DebugDice: { nextRolls?: number[] } = {
  nextRolls: undefined
}
// @ts-expect-error window.DebugDice is a debug hook with no declared type
window.DebugDice = DebugDice

const preferencesStore = usePreferencesStore()

const ready = ref(false)
const rolling = ref(false)
let pendingResolve: ((_: number[]) => void) | undefined
let pendingReject: ((_: Error) => void) | undefined
let diceBox: DiceBox | undefined

onMounted(() => {
  const box = new DiceBox({
    container: "#dicebox-container",
    assetPath: "/assets/dice-box/",
    theme: "diceOfRolling",
    scale: 6,
    restitution: 0.6,
    friction: 0.9,
    linearDamping: 0.5,
    angularDamping: 0.5,
    throwForce: 6,
    spinForce: 2,
    startingHeight: 30
  })
  box.init().then(() => {
    ready.value = true
  })
  box.onRollComplete = (rollResult): void => {
    const result = rollResult.flatMap(group => group.rolls.map(roll => roll.value))
    console.log("Dice roll complete", rollResult, result)
    pendingResolve?.(result)
    pendingReject = undefined
    pendingResolve = undefined
    rolling.value = false
  }
  diceBox = markRaw(box)
})

async function roll(quantity?: number): Promise<number[]> {
  return new Promise<number[]>((resolve, reject) => {
    if (DebugDice.nextRolls) {
      return resolve(DebugDice.nextRolls)
    }
    if (!ready.value) {
      return reject(new Error("not ready"))
    } else if (pendingResolve !== undefined && pendingReject !== undefined) {
      return reject(new Error("busy"))
    }
    pendingResolve = resolve
    pendingReject = reject
    try {
      rolling.value = true
      diceBox?.roll(`${quantity ?? 1}d6`)
      if (preferencesStore.quickDice) {
        setTimeout(() => {
          pendingResolve?.(range(quantity ?? 1).map(() => random(1, 6)))
          pendingReject = undefined
          pendingResolve = undefined
          rolling.value = false
        }, 0)
      }
    } catch (e) {
      reject(e)
    }
  })
}

defineExpose({ roll })
</script>

<style scoped lang="sass">
#dicebox-container, #dicebox-container :deep(canvas), .bg
  width: 100%
  height: 100%
  position: absolute

#dicebox-container
  z-index: -100

#dicebox-container, .bg
  left: 0
  top: 0
  opacity: 0
  transition: opacity 1s 1s, z-index 0s 2s

.bg
  background: linear-gradient(27deg, #151515 5px, transparent 5px) 0 5px, linear-gradient(207deg, #151515 5px, transparent 5px) 10px 0px, linear-gradient(27deg, #222 5px, transparent 5px) 0px 10px, linear-gradient(207deg, #222 5px, transparent 5px) 10px 5px, linear-gradient(90deg, #1b1b1b 10px, transparent 10px), linear-gradient(#1d1d1d 25%, #1a1a1a 25%, #1a1a1a 50%, transparent 50%, transparent 75%, #242424 75%, #242424)
  background-color: #131313
  background-size: 20px 20px
  background-repeat: repeat
  opacity: 0
  transition: opacity 0s 3s

.rolling .bg
  opacity: 0.8
  transition: opacity 1s

#dicebox-container.rolling
  opacity: 1
  z-index: 1
  transition: opacity 0s

.quickDice
  pointer-events: none
  transition: opacity 1s 0.5s, z-index 0s 2s

  .bg
    display: none
</style>
