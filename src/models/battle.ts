// Battle logic is split across src/models/battle/ by concern (board, combatant,
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

export {
  createBattleCreature,
  creatureName,
  getRemainingHp,
  getStrength,
  performStrike,
  phaseEnterMove,
  phaseEnterStrike,
  phaseExitMove,
  phaseExitStrikeback,
  wound
} from "./battle/combatant"
export type { BattleCreature, BattleCreatureInit } from "./battle/combatant"

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
