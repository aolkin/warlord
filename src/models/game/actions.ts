import { BattleCreature, BattlePhaseType } from "~/models/battle"
import { CREATURE_DATA } from "~/models/creature"
import { Stack } from "~/models/stack"
import { View } from "~/store/ui/selection"
import { assert } from "~/utils/assert"
import type { TitanGame } from "./index"
import { ActionContext, AttackPayload, BattleMovePayload, MasterboardPhase, MovePayload, MusterPayload, RangestrikePayload } from "./types"

export interface GameActions {
  doNextPhase(context: ActionContext): Promise<void>
  doSetRoll(context: ActionContext, payload?: number): Promise<void>
  doMove(context: ActionContext, payload: MovePayload): Promise<void>
  doSetRecruit(context: ActionContext, payload: MusterPayload): Promise<void>
  doInitiateBattle(context: ActionContext, attacking: Stack): Promise<void>
  doMoveCreature(context: ActionContext, payload: BattleMovePayload): Promise<void>
  doNextBattlePhase(context: ActionContext): Promise<void>
  doAttackCreature(context: ActionContext, payload: AttackPayload): Promise<void>
  doRangestrikeCreature(context: ActionContext, payload: RangestrikePayload): Promise<void>
  doAssignCarryover(context: ActionContext, payload: BattleCreature): Promise<void>
  doSkipCarryover(context: ActionContext): Promise<void>
}

export const gameActions: GameActions & ThisType<TitanGame> = {
  async doNextPhase({ getters, commit, dispatch }: ActionContext): Promise<void> {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        commit("phaseExitSplit", getters)
        commit("phaseEnterMove", getters)
        break
      case MasterboardPhase.MOVE:
        commit("phaseExitMove", getters)
        commit("phaseEnterBattle", getters)
        if (getters.engagedStacks.length === 0) {
          commit("nextPhase", getters)
          commit("phaseExitBattle", getters)
          commit("phaseEnterMuster", getters)
        } else if (getters.engagedStacks.length === 1) {
          dispatch("initiateBattle", getters.engagedStacks[0])
        }
        break
      case MasterboardPhase.BATTLE:
        assert(this.activeBattle !== undefined, "Incomplete battle!")
        commit("phaseExitBattle", getters)
        commit("phaseEnterMuster", getters)
        break
      case MasterboardPhase.MUSTER:
        commit("phaseExitMuster", getters)
    }
    commit("nextPhase", getters)
    commit("ui/selections/deselectStack", null, { root: true })
    await this.persist()
  },

  async doSetRoll({ getters, commit }: ActionContext, payload?: number): Promise<void> {
    if (payload === undefined && this.activeRoll !== undefined) {
      assert(getters.mulliganAvailable, "Mulligan unavailable")
    }
    commit("setRoll", payload)
    await this.persist()
  },

  async doMove({ commit }: ActionContext, payload: MovePayload): Promise<void> {
    commit("move", payload)
    await this.persist()
  },

  async doSetRecruit({ commit }: ActionContext, payload: MusterPayload): Promise<void> {
    if (!payload.stack.canMuster()) {
      throw new Error("Stack is not eligible to muster!")
    }
    if (payload.recruit !== undefined &&
      this.creaturePool[payload.recruit[0]] < 1 && !CREATURE_DATA[payload.recruit[0]].lord) {
      throw new Error("No more of the requested creature remaining")
    }
    commit("muster", payload)
    await this.persist()
  },

  /*
   *** BATTLE FUNCTIONS ***
   */

  async doInitiateBattle({ commit, getters }: ActionContext, attacking: Stack): Promise<void> {
    const defending = getters.stacksForHex(attacking.hex)
      .find(stack => stack.owner !== getters.activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attacking.hex}!`)
    commit("initiateBattle", { attacking, defending })
    commit("ui/selections/setView", View.BATTLEBOARD, { root: true })
    await this.persist()
  },

  async doMoveCreature({ getters, commit }: ActionContext, payload: BattleMovePayload): Promise<void> {
    assert(getters.battlePhaseType === BattlePhaseType.MOVE, "Not in movement phase")
    assert(payload.creature.player === this.getBattleActivePlayer(), "Incorrect player")
    commit("moveCreature", payload)
    await this.persist()
  },

  async doNextBattlePhase({ commit }: ActionContext): Promise<void> {
    commit("nextBattlePhase")
    await this.persist()
  },

  async doAttackCreature({ getters, commit }: ActionContext, payload: AttackPayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getters.battlePhaseType !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(payload.attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    commit("attackCreature", payload)
    await this.persist()
  },

  async doRangestrikeCreature({ getters, commit }: ActionContext, payload: RangestrikePayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getters.battlePhaseType !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(payload.attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    commit("rangestrikeCreature", payload)
    await this.persist()
  },

  async doAssignCarryover({ getters, commit }: ActionContext, payload: BattleCreature): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getters.battlePhaseType !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    commit("assignCarryover", payload)
    await this.persist()
  },

  async doSkipCarryover({ getters, commit }: ActionContext): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    if (this.activeBattle.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(getters.battlePhaseType !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    commit("skipCarryover")
    await this.persist()
  }
}
