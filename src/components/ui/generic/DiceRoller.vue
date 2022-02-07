<template>
  <div id="dicebox-container" :class="{ rolling, quickDice }">
    <div class="bg">&nbsp;</div>
  </div>
</template>

<script lang="ts">
import DiceBox from "@3d-dice/dice-box"
import { defineComponent } from "@vue/runtime-core"
import _ from "lodash"
import { mapState } from "vuex"

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
      assetPath: "/assets/dice-box/",
      theme: "diceOfRolling",
      zoomLevel: 2,
      restitution: 0.6,
      friction: 0.9,
      linearDamping: 0.5,
      angularDamping: 0.5,
      throwForce: 6,
      spinForce: 2,
      startingHeight: 30
    })
    diceBox.init().then(() => {
      this.ready = true
    })
    diceBox.onRollComplete = (): void => {
      const result = diceBox.rollData.flatMap(
        (i: any) => i.rolls.map((roll: any) => roll.result)) as number[]
      console.log("Dice roll complete", diceBox.rollData, result)
      this.resolve?.(result)
      this.reject = undefined
      this.resolve = undefined
      this.rolling = false
    }
    _.set(this, "diceBox", diceBox)
  },
  computed: {
    ...mapState("ui/preferences", ["quickDice"])
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
          if (this.quickDice) {
            setTimeout(() => {
              this.resolve?.(_.range(quantity ?? 1).map(i => _.random(1, 6)))
              this.reject = undefined
              this.resolve = undefined
              this.rolling = false
            }, 0)
          }
        } catch (e) {
          reject(e)
        }
      })
    }
  }
})
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
