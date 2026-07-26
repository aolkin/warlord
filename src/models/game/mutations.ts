import { matches } from "lodash-es"
import { Battle, BattleCreature } from "~/models/battle"
import { MasterboardHex } from "~/models/masterboard"
import { assert } from "~/utils/assert"
import type { TitanGame } from "./index"
import { AttackPayload, BattleMovePayload, BattlePayload, Getters, MasterboardPhase, MovePayload, MusterPayload, RangestrikePayload } from "./types"

export interface GameMutations {
  mPhaseExitSplit(getters: Getters): void
  mPhaseEnterMove(getters: Getters): void
  mPhaseExitMove(getters: Getters): void
  mPhaseEnterBattle(getters: Getters): void
  mPhaseExitBattle(getters: Getters): void
  mPhaseEnterMuster(getters: Getters): void
  mPhaseExitMuster(getters: Getters): void
  mNextPhase(getters: Getters): void
  mSetRoll(payload: number): void
  mMove(payload: MovePayload): void
  mMuster(payload: MusterPayload): void
  mInitiateBattle(payload: BattlePayload): void
  mNextBattlePhase(): void
  mMoveCreature(payload: BattleMovePayload): void
  mAttackCreature(payload: AttackPayload): void
  mRangestrikeCreature(payload: RangestrikePayload): void
  mAssignCarryover(target: BattleCreature): void
  mSkipCarryover(): void
}

// Phase Entry/Exit Mutations take Getters and should not be called outside of `doNextPhase()`

export const gameMutations: GameMutations & ThisType<TitanGame> = {
  mPhaseExitSplit(getters: Getters): void {
    getters.activeStacks.filter(stack => stack.numSplitting() > 0).forEach(stack => {
      this.stacks.push(stack.finalizeSplit(getters.nextMarker))
    })
  },

  mPhaseEnterMove(getters: Getters): void {
    getters.activeStacks.forEach(stack => {
      stack.origin = stack.hex
      stack.attackEdge = undefined
    })
    this.mulliganTaken = false
  },

  mPhaseExitMove(_getters: Getters): void {
    this.activeRoll = undefined
    // TODO: recombine splits that failed to move
  },

  mPhaseEnterBattle(_getters: Getters): void {
  },

  mPhaseExitBattle(_getters: Getters): void {
  },

  mPhaseEnterMuster(_getters: Getters): void {
  },

  mPhaseExitMuster(getters: Getters): void {
    getters.activeStacks.forEach(stack => {
      if (stack.currentMuster !== undefined) {
        stack.recruits[this.round] = stack.currentMuster
        stack.creatures.push(stack.currentMuster[0])
        this.creaturePool[stack.currentMuster[0]]--
      }
    })
  },

  // End Phase Entry/Exit Mutations

  mNextPhase(getters: Getters): void {
    this.activePhase += 1
    if (this.activePhase === MasterboardPhase.END) {
      this.activePlayer += 1
      if (this.activePlayer >= this.players.length) {
        this.activePlayer = 0
        this.round++
      }
      this.activePhase = MasterboardPhase.SPLIT
      getters.activeStacks.forEach(stack => stack.currentMuster = undefined)
    }
  },

  mSetRoll(payload: number): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    if (payload === undefined && this.activeRoll !== undefined) {
      this.mulliganTaken = true
    }
    this.activeRoll = payload
  },

  mMove({ stack, hex, edge }: MovePayload): void {
    assert(this.activePhase === MasterboardPhase.MOVE, "Innappropriate phase")
    stack.attackEdge = edge
    if (hex instanceof MasterboardHex) {
      stack.hex = hex.id
    } else {
      stack.hex = hex
    }
  },

  mMuster({ stack, recruit }: MusterPayload): void {
    assert(this.activePhase === MasterboardPhase.MUSTER, "Innappropriate phase")
    stack.currentMuster = recruit
  },

  mInitiateBattle({ attacking, defending }: BattlePayload): void {
    assert(attacking.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    this.activeBattle = new Battle(attacking.hex, attacking.attackEdge, this, attacking, defending)
  },

  mNextBattlePhase(): void {
    assert(this.activeBattle !== undefined, "No active battle!")
    this.activeBattle?.nextPhase()
  },

  mMoveCreature({ creature, hex }: BattleMovePayload): void {
    assert(this.activeBattle?.creatures.some(matches(creature)) ?? false, "Unexpected creature")
    creature.hex = hex
  },

  mAttackCreature({ attacker, target, rolls, optionalToHit }: AttackPayload): void {
    assert(this.activeBattle?.creatures.some(matches(attacker)) ?? false, "Unexpected attacker")
    assert(this.activeBattle?.creatures.some(matches(target)) ?? false, "Unexpected defender")
    this.activeBattle?.strike(attacker, target, rolls, optionalToHit)
  },

  mRangestrikeCreature({ attacker, target, rolls }: RangestrikePayload): void {
    assert(this.activeBattle?.creatures.some(matches(attacker)) ?? false, "Unexpected attacker")
    assert(this.activeBattle?.creatures.some(matches(target.creature)) ?? false, "Unexpected defender")
    this.activeBattle?.rangestrike(attacker, target, rolls)
  },

  mAssignCarryover(target: BattleCreature): void {
    assert(this.activeBattle?.creatures.some(matches(target)) ?? false, "Unexpected target")
    this.activeBattle?.carryover(target)
  },

  mSkipCarryover(): void {
    this.activeBattle?.activeStrike?.skipCarryover()
  }
}
