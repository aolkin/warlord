<template>
  <div id="dicebox-container" :class="{ rolling }" />
</template>

<script lang="ts">
import DiceBox from "@3d-dice/dice-box"
import { defineComponent } from "@vue/runtime-core"
import _ from "lodash"

interface ComponentData {
  ready: boolean,
  rolling: boolean,
  resolve?: (_: number[]) => void,
  reject?: (_: Error) => void
}

export default defineComponent({
  name: "DiceRoller",
  data(): ComponentData {
    return {
      ready: false,
      rolling: false,
      resolve: undefined,
      reject: undefined
    }
  },
  mounted() {
    const diceBox = new DiceBox("#dicebox-container", {
      assetPath: "/assets/dice-box/"
    })
    diceBox.init().then(() => {
      this.ready = true
    })
    diceBox.onRollComplete = (): void => {
      const result = diceBox.rollData.flatMap(
        (i: any) => i.rolls.map((roll: any) => roll.result)) as number[]
      console.log("Complete", diceBox.rollData, result)
      this.resolve?.(result)
      this.reject = undefined
      this.resolve = undefined
      this.rolling = false
    }
    _.set(this, "diceBox", diceBox)
  },
  methods: {
    async roll(quantity?: number) {
      return new Promise((resolve, reject) => {
        if (!this.ready) {
          return reject(new Error("not ready"))
        } else if (this.resolve !== undefined && this.reject !== undefined) {
          return reject(new Error("busy"))
        }
        this.resolve = resolve
        this.reject = reject
        try {
          this.rolling = true
          this.$forceUpdate()
          this.diceBox.roll(`${quantity ?? 1}d6`)
        } catch (e) {
          reject(e)
        }
      })
    }
  }
})
</script>

<style scoped lang="sass">
#dicebox-container, #dicebox-container>canvas
  width: 100%
  height: 100%

#dicebox-container
  position: absolute
  left: 0
  top: 0
  background: #88888801
  z-index: -100
  opacity: 0
  transition: opacity 1s 1s, z-index 0s 2s

#dicebox-container.rolling
  opacity: 1
  z-index: 1
  transition: opacity 1s
</style>
