// Battle logic is split across src/game/models/battle/ by concern (board, combatant,
// strike resolution, and the Battle engine itself); this barrel re-exports the
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
export type { IBattleCreature } from "./battle/combatant"

export {
  ActiveStrike,
  BATTLE_PHASE_TITLES,
  BATTLE_PHASE_TYPES,
  BattlePhase,
  BattlePhaseType,
  combineStrikes,
  isRangestrike
} from "./battle/strike"
export type { ActiveStrikeHit, IActiveStrike, RangestrikeTarget, Strike } from "./battle/strike"

export { Battle } from "./battle/engine"
export type { BattleSide } from "./battle/engine"
