export enum BattlePhaseType {
  MOVE,
  STRIKE,
  STRIKEBACK,
}

export enum BattlePhase {
  DEFENDER_MOVE,
  DEFENDER_STRIKE,
  ATTACKER_STRIKEBACK,
  ATTACKER_MOVE,
  ATTACKER_STRIKE,
  DEFENDER_STRIKEBACK,
}

export const BATTLE_PHASE_TYPES: Record<BattlePhase, BattlePhaseType> = {
  [BattlePhase.DEFENDER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.DEFENDER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.DEFENDER_STRIKEBACK]: BattlePhaseType.STRIKEBACK,
  [BattlePhase.ATTACKER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.ATTACKER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.ATTACKER_STRIKEBACK]: BattlePhaseType.STRIKEBACK,
}

export const BATTLE_PHASE_TITLES: Record<BattlePhase, string> = {
  [BattlePhase.DEFENDER_MOVE]: "Defender's Move",
  [BattlePhase.DEFENDER_STRIKE]: "Defender's Strikes",
  [BattlePhase.DEFENDER_STRIKEBACK]: "Defender's Strikebacks",
  [BattlePhase.ATTACKER_MOVE]: "Attacker's Move",
  [BattlePhase.ATTACKER_STRIKE]: "Attacker's Strikes",
  [BattlePhase.ATTACKER_STRIKEBACK]: "Attacker's Strikebacks",
}
