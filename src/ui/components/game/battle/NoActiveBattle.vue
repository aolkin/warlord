<template>
  <div class="no-active-battle-root">
    <svg
      class="no-active-battle"
      viewBox="-100 -50 200 100"
    >
      <text
        x="0"
        y="0"
      >No Active Battle!</text>
    </svg>
  </div>
</template>

<style scoped lang="sass">
.no-active-battle-root
  width: 100%
  height: calc(100vh - 30px)
  background-color: #101010

.no-active-battle
  width: 100%
  height: 100%

  &>text
    fill: currentColor
    text-anchor: middle
    dominant-baseline: central
    font-family: "Fondamento", serif
</style>
