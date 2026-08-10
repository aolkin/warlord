import {
  BATTLE_PHASE_TYPES,
  Battle,
  BattleCreature,
  BattlePhaseType,
  nextPhase,
  performAttack,
  wound
} from "./battle"
import type { TitanGame } from "./game"

// Actions reference entities by id, never by live object reference, so an action can
// cross a serialization boundary (persistence log, network) unchanged.
export type BattleCreatureRef = number

interface BattleMoveAction { type: "moveCreature", creature: BattleCreatureRef, hex: number }
interface NextBattlePhaseAction { type: "nextBattlePhase" }
interface AttackAction {
  type: "attackCreature"
  attacker: BattleCreatureRef
  target: BattleCreatureRef
  rolls: number[]
  optionalToHit?: number
}
interface RangestrikeAction {
  type: "rangestrikeCreature"
  attacker: BattleCreatureRef
  target: BattleCreatureRef
  rolls: number[]
}
interface AssignCarryoverAction { type: "assignCarryover", target: BattleCreatureRef }
interface SkipCarryoverAction { type: "skipCarryover" }

export type GameAction =
  | BattleMoveAction
  | NextBattlePhaseAction
  | AttackAction
  | RangestrikeAction
  | AssignCarryoverAction
  | SkipCarryoverAction

export type ActionResult = { accepted: true } | { accepted: false, reason: string }

interface ActionHandler<A extends GameAction> {
  /** Pure predicate over (state, action): returns a rejection reason, or undefined to accept. */
  validate(game: TitanGame, action: A): string | undefined
  /** Only called after validate accepts, so lookups it repeats are known to succeed. */
  apply(game: TitanGame, action: A): void
}

function findCreature(battle: Battle, ref: BattleCreatureRef): BattleCreature | undefined {
  return battle.creatures.find(creature => creature.id === ref)
}

/** Shared prologue for the strike-phase actions: an active battle outside its movement phase. */
function validateStrikePhase(game: TitanGame): string | undefined {
  if (game.activeBattle === undefined) {
    return "Must be in a battle!"
  }
  if (BATTLE_PHASE_TYPES[game.activeBattle.phase] === BattlePhaseType.MOVE) {
    return "Cannot strike in movement phase"
  }
  return undefined
}

/** Resolves the acting striker, or a rejection reason when it cannot act. */
function resolveStriker(battle: Battle, ref: BattleCreatureRef): BattleCreature | string {
  const attacker = findCreature(battle, ref)
  if (attacker === undefined) {
    return "Unexpected attacker"
  }
  if (attacker.player !== battle.getActivePlayer()) {
    return "Incorrect player"
  }
  return attacker
}

const handlers: { [T in GameAction["type"]]: ActionHandler<Extract<GameAction, { type: T }>> } = {
  moveCreature: {
    validate(game, action) {
      const battle = game.activeBattle
      if (battle === undefined || BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE) {
        return "Not in movement phase"
      }
      const creature = findCreature(battle, action.creature)
      if (creature === undefined) {
        return "Unexpected creature"
      }
      if (creature.player !== battle.getActivePlayer()) {
        return "Incorrect player"
      }
      return undefined
    },
    apply(game, action) {
      findCreature(game.activeBattle!, action.creature)!.hex = action.hex
    }
  },

  nextBattlePhase: {
    validate(game) {
      const battle = game.activeBattle
      if (battle === undefined) {
        return "No active battle!"
      }
      if (BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE &&
        battle.getPendingStrikes().length > 0) {
        return "All eligible creatures must strike"
      }
      return undefined
    },
    apply(game) {
      nextPhase(game.activeBattle!)
    }
  },

  attackCreature: {
    validate(game, action) {
      const phaseReason = validateStrikePhase(game)
      if (phaseReason !== undefined) {
        return phaseReason
      }
      const battle = game.activeBattle!
      const attacker = resolveStriker(battle, action.attacker)
      if (typeof attacker === "string") {
        return attacker
      }
      const target = findCreature(battle, action.target)
      if (target === undefined) {
        return "Unexpected defender"
      }
      if (action.optionalToHit !== undefined &&
        action.optionalToHit < battle.toHitAdjusted(attacker, target)) {
        return "Cannot choose a lower to-hit"
      }
      return undefined
    },
    apply(game, action) {
      const battle = game.activeBattle!
      const attacker = findCreature(battle, action.attacker)!
      const target = findCreature(battle, action.target)!
      const toHit = action.optionalToHit ?? battle.toHitAdjusted(attacker, target)
      performAttack(battle, attacker, target, action.rolls, toHit, false)
    }
  },

  rangestrikeCreature: {
    validate(game, action) {
      const phaseReason = validateStrikePhase(game)
      if (phaseReason !== undefined) {
        return phaseReason
      }
      const battle = game.activeBattle!
      const attacker = resolveStriker(battle, action.attacker)
      if (typeof attacker === "string") {
        return attacker
      }
      // The action carries only the target's id; the rangestrike itself (path legality,
      // hazard adjustments, long-distance penalty) is recomputed from state, so an action
      // naming an unreachable target rejects here.
      if (!battle.rangestrikeTargets(attacker).some(target => target.creature.id === action.target)) {
        return "Unexpected defender"
      }
      return undefined
    },
    apply(game, action) {
      const battle = game.activeBattle!
      const attacker = findCreature(battle, action.attacker)!
      const target = battle.rangestrikeTargets(attacker)
        .find(target => target.creature.id === action.target)!
      performAttack(battle, attacker, target.creature, action.rolls,
        battle.getRangestrike(attacker, target).toHit, true)
    }
  },

  assignCarryover: {
    validate(game, action) {
      const battle = game.activeBattle
      if (battle === undefined) {
        return "Must be in a battle!"
      }
      if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE) {
        return "Cannot carryover in movement phase"
      }
      if (!(battle.activeStrike?.canCarryover ?? false)) {
        return "Cannot carryover"
      }
      if (!(battle.carryoverTargets()?.some(target => target.id === action.target) ?? false)) {
        return "Unexpected target"
      }
      return undefined
    },
    apply(game, action) {
      const battle = game.activeBattle!
      const strike = battle.activeStrike!
      const target = findCreature(battle, action.target)!
      const hits = Math.min(strike.getCarryoverHits(), target.getRemainingHp())
      strike.targets.push(target.hex)
      strike.targetHits.push(hits)
      wound(target, hits)
    }
  },

  skipCarryover: {
    validate(game) {
      if (game.activeBattle === undefined) {
        return "Must be in a battle!"
      }
      if (game.activeBattle.activeStrike === undefined) {
        return "Must have an active strike!"
      }
      if (BATTLE_PHASE_TYPES[game.activeBattle.phase] === BattlePhaseType.MOVE) {
        return "Cannot carryover in movement phase"
      }
      return undefined
    },
    apply(game) {
      game.activeBattle!.activeStrike!.carryoverSkipped = true
    }
  }
}

/**
 * The single entry point for state mutation: validates the action against current state
 * and applies it only when accepted. Never throws for an invalid action.
 */
export function dispatch(game: TitanGame, action: GameAction): ActionResult {
  const handler = handlers[action.type] as ActionHandler<GameAction>
  const reason = handler.validate(game, action)
  if (reason !== undefined) {
    return { accepted: false, reason }
  }
  handler.apply(game, action)
  return { accepted: true }
}
