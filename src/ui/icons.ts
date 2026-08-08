import {
  mdiDice1,
  mdiDice2,
  mdiDice3,
  mdiDice4,
  mdiDice5,
  mdiDice6,
  mdiDiceMultiple
} from "@mdi/js"

const DICE_ICONS: Record<number, string> = {
  1: mdiDice1,
  2: mdiDice2,
  3: mdiDice3,
  4: mdiDice4,
  5: mdiDice5,
  6: mdiDice6
}

// Falls back to the "multiple dice" icon for undefined or out-of-range rolls.
export function diceIcon(roll?: number | string): string {
  return DICE_ICONS[Number(roll)] ?? mdiDiceMultiple
}
