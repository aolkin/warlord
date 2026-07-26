import { BaseActionContext } from "~/store/types"
import { BattleCreature, BattlePhaseType, RangestrikeTarget } from "~/models/battle"
import { HexEdge, MasterboardHex } from "~/models/masterboard"
import { Player, PlayerId } from "~/models/player"
import { MusterChoice, Stack } from "~/models/stack"
import type { TitanGame } from "./index"

export enum MasterboardPhase {
  SPLIT,
  MOVE,
  BATTLE,
  MUSTER,
  END
}

export interface Path {
  foe?: Stack
  path: MasterboardHex[]
}

export interface Getters {
  readonly round: number // 1-indexed
  readonly firstRound: boolean
  readonly players: Player[]
  readonly activeStacks: Stack[]
  readonly playerById: (player: PlayerId) => Player | undefined
  readonly stacksForPlayer: (owner: PlayerId) => Stack[]
  readonly stacksForHex: (hex: number) => Stack[]
  readonly pathsForHex: (hex: number) => Path[]
  readonly nextMarker: number
  readonly mulliganAvailable: boolean
  readonly activePlayer: Player
  readonly activePlayerId: PlayerId
  readonly battleActivePlayer: PlayerId
  readonly battlePhaseType: BattlePhaseType
  readonly battleMoves: Set<number>
  readonly battleEngagements: BattleCreature[]
  readonly mayProceed: boolean
  readonly engagedStacks: Stack[]
  readonly mandatoryMoves: Stack[]
}

export interface MovePayload { stack: Stack, hex: number | MasterboardHex, edge?: HexEdge }
export interface BattleMovePayload { creature: BattleCreature, hex: number }
export interface MusterPayload { stack: Stack, recruit: MusterChoice }
export interface BattlePayload { attacking: Stack, defending: Stack }
export interface IStrikePayload { attacker: BattleCreature, rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature, optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload { target: RangestrikeTarget }

export interface ActionContext extends BaseActionContext {
  state: TitanGame
  getters: Getters
}
