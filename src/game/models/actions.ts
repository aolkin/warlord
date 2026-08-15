import { assert } from "@/utils/assert"
import { AttackPayload, Battle, BattleCreature, BattleMovePayload, RangestrikePayload } from "./battle"
import { MovePayload, MusterPayload, TitanGame } from "./game"
import { Stack, StackRef } from "./stack"

export interface TogglePendingSplitPayload { stack: StackRef, index: number }

// One variant per free function in game.ts, battle/engine.ts, and stack.ts that mutates
// game state. Each payload matches the shape the underlying function already takes.
export type GameAction =
  | { type: "move", payload: MovePayload }
  | { type: "setRecruit", payload: MusterPayload }
  | { type: "nextPhase" }
  | { type: "setRoll", payload?: number }
  | { type: "initiateBattle", payload: StackRef }
  | { type: "moveCreature", payload: BattleMovePayload }
  | { type: "attackCreature", payload: AttackPayload }
  | { type: "rangestrikeCreature", payload: RangestrikePayload }
  | { type: "assignCarryover", payload: BattleCreature["id"] }
  | { type: "skipCarryover" }
  | { type: "togglePendingSplit", payload: TogglePendingSplitPayload }

export function dispatch(game: TitanGame, action: GameAction): void {
  switch (action.type) {
    case "move":
      TitanGame.move(game, action.payload)
      break
    case "setRecruit":
      TitanGame.setRecruit(game, action.payload)
      break
    case "nextPhase":
      TitanGame.nextPhase(game)
      break
    case "setRoll":
      TitanGame.setRoll(game, action.payload)
      break
    case "initiateBattle":
      TitanGame.initiateBattle(game, action.payload)
      break
    case "moveCreature":
      Battle.moveCreature(requireActiveBattle(game), action.payload)
      break
    case "attackCreature":
      Battle.attackCreature(requireActiveBattle(game), action.payload)
      break
    case "rangestrikeCreature":
      Battle.rangestrikeCreature(requireActiveBattle(game), action.payload)
      break
    case "assignCarryover":
      Battle.assignCarryover(requireActiveBattle(game), action.payload)
      break
    case "skipCarryover":
      Battle.skipCarryover(requireActiveBattle(game))
      break
    case "togglePendingSplit": {
      const stack = game.stacks.find(s => s.id === action.payload.stack)
      assert(stack !== undefined, `No stack with id ${action.payload.stack}`)
      Stack.togglePendingSplit(stack, action.payload.index)
      break
    }
    default:
      // Exhaustiveness check: fails to compile if a GameAction variant is added above
      // without a matching case here.
      throw new Error(`Unhandled action: ${JSON.stringify(action satisfies never)}`)
  }
}

function requireActiveBattle(game: TitanGame): Battle {
  assert(game.activeBattle !== undefined, "No active battle")
  return game.activeBattle
}
