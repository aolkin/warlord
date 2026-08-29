import { assert } from "@/utils/assert"
import { HexEdge } from "@/models/masterboard"
import { StackRef } from "@/models/stack"
import { MasterboardPhase, MusterPayload, StackSplit, StagedMoves, TitanGame } from "./game"
import { defaultRandom, Random } from "./random"

export interface MovePayload {
  stack: StackRef
  hex: number
  edge?: HexEdge
}

export type GameAction =
  | { type: "masterboard/finalizeSplits"; payload: StackSplit[] }
  | { type: "masterboard/takeMulligan" }
  | { type: "masterboard/finalizeMoves"; payload: MovePayload[] }
  | { type: "masterboard/initiateBattle"; payload: StackRef }
  | { type: "masterboard/finalizeMusters"; payload: MusterPayload[] }

export function dispatch(game: TitanGame, action: GameAction, random: Random = defaultRandom): void {
  switch (action.type) {
    case "masterboard/finalizeSplits":
      TitanGame.finalizeSplits(game, action.payload, random)
      break
    case "masterboard/takeMulligan":
      TitanGame.takeMulligan(game, random)
      break
    case "masterboard/finalizeMoves":
      TitanGame.finalizeMoves(game, toStagedMoves(action.payload))
      break
    case "masterboard/initiateBattle":
      assertPhase(game, MasterboardPhase.BATTLE)
      TitanGame.initiateBattle(game, action.payload)
      break
    case "masterboard/finalizeMusters":
      TitanGame.finalizeMusters(game, action.payload)
      break
    default:
      throw new Error(`Unhandled action: ${JSON.stringify(action satisfies never)}`)
  }
}

function toStagedMoves(payload: MovePayload[]): StagedMoves {
  return new Map(payload.map(({ stack, hex, edge }) => [stack, { hex, edge }]))
}

function assertPhase(game: TitanGame, phase: MasterboardPhase): void {
  assert(game.activePhase === phase, `Action requires the ${MasterboardPhase[phase]} phase`)
}
