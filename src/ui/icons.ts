import {
  mdiDice1,
  mdiDice2,
  mdiDice3,
  mdiDice4,
  mdiDice5,
  mdiDice6,
  mdiDiceMultiple
} from "@mdi/js"

// Returns icons[index], or fallback when index is out of range.
export function indexedIcon(icons: string[], index: number, fallback: string): string {
  return icons[index] ?? fallback
}

const DICE_ICONS = [mdiDice1, mdiDice2, mdiDice3, mdiDice4, mdiDice5, mdiDice6]

// Falls back to the "multiple dice" icon for undefined or out-of-range rolls.
export function diceIcon(roll?: number | string): string {
  return indexedIcon(DICE_ICONS, Number(roll) - 1, mdiDiceMultiple)
}
