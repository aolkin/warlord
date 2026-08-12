// Battle logic is split across src/game/models/battle/ by concern (board, combatant,
// phase, strike resolution, and the Battle engine itself); this barrel re-exports the
// same public surface that used to live directly in this file.
export {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BattleBoard,
  EdgeHazard,
  Hazard,
  relationToHex
} from "./battle/board"
export type { BattleBoardProps } from "./battle/board"

export { BattleCreature } from "./battle/combatant"

export {
  BATTLE_PHASE_TITLES,
  BATTLE_PHASE_TYPES,
  BattlePhase,
  BattlePhaseType
} from "./battle/phase"

export { ActiveStrike, Strike, isRangestrike } from "./battle/strike"
export type { RangestrikeTarget } from "./battle/strike"

export { Battle, nextPhase, performAttack } from "./battle/engine"
export type { BattleSide } from "./battle/engine"
