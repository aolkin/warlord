import { range } from "lodash-es"
import { BATTLE_PHASE_TYPES, BattleCreature, BattlePhaseType, RangestrikeTarget } from "~/models/battle"
import masterboard, { MasterboardHex } from "~/models/masterboard"
import { Player, PlayerId } from "~/models/player"
import { Stack } from "~/models/stack"
import type { TitanGame } from "./index"
import { Getters, MasterboardPhase, Path } from "./types"

export interface GameGetters {
  getRound(): number
  getFirstRound(): boolean
  getPlayers(): Player[]
  getPlayerById(): (id: PlayerId) => Player | undefined
  getStacksForPlayer(): (owner: PlayerId) => Stack[]
  getActiveStacks(getters: Getters): Stack[]
  getNextMarker(getters: Getters): number | undefined
  getStacksForHex(): (hex: number) => Stack[]
  getPathsForHex(getters: Getters): (hex: number) => Path[]
  getMandatoryMoves(getters: Getters): Stack[]
  getActivePlayer(): Player
  getActivePlayerId(getters: Getters): PlayerId
  getBattleActivePlayer(): PlayerId | undefined
  getBattlePhaseType(): BattlePhaseType | undefined
  getBattleMoves(): (creature: BattleCreature) => Set<number>
  getBattleEngagements(): (creature: BattleCreature) => BattleCreature[]
  getBattleCarryoverTargets(): BattleCreature[] | undefined
  getBattleRangestrikeTargets(): (creature: BattleCreature) => RangestrikeTarget[]
  getMayProceed(getters: Getters): boolean
  getMulliganAvailable(getters: Getters): boolean
  getEngagedStacks(getters: Getters): Stack[]
}

export const gameGetters: GameGetters & ThisType<TitanGame> = {
  getRound(): number {
    return this.round + 1
  },

  getFirstRound(): boolean {
    return this.round === 0
  },

  getPlayers(): Player[] {
    return this.players
  },

  getPlayerById() {
    return (id: PlayerId) => this.players.find(player => player.id === id)
  },

  getStacksForPlayer() {
    return (owner: PlayerId) => this.stacks.filter(stack => stack.owner === owner)
  },

  getActiveStacks(getters: Getters): Stack[] {
    return getters.stacksForPlayer(getters.activePlayerId)
  },

  getNextMarker(getters: Getters): number | undefined {
    const usedMarkers = getters.activeStacks.map(stack => stack.marker)
    return range(0, 12).find(marker => !usedMarkers.includes(marker))
  },

  getStacksForHex() {
    return (hex: number) => this.stacks.filter(stack => stack.hex === hex)
  },

  getPathsForHex(getters: Getters): (hex: number) => Path[] {
    return (hexNum: number) => {
      if (this.activeRoll === undefined) {
        return []
      }
      const initialHex = masterboard.getHex(hexNum)
      const paths: Path[] = []
      // [Array of hexes to get where we are, first hex with enemies, current hex]
      type pathing = [MasterboardHex[], Stack | undefined, MasterboardHex]
      const stack: pathing[] = initialHex.getMovement(true).map(edge => [[initialHex], undefined, edge.hex])
      let entry: pathing | undefined
      while ((entry = stack.pop()) !== undefined) {
        const [path, , hex] = entry
        let foe = entry[1]
        const occupants: Stack[] = getters.stacksForHex(hex.id)
        if (foe === undefined) {
          const foes = occupants.filter((stack: Stack) => stack.owner !== getters.activePlayerId)
          if (foes.length > 0) {
            foe = foes[0]
          }
        }
        if (path.length === this.activeRoll) {
          if (!occupants.some((stack: Stack) => stack.owner === getters.activePlayerId)) {
            paths.push({ foe, path: [...path, hex] })
          }
        } else {
          stack.push(...hex.getMovement(false)
            .filter(edge => path[path.length - 1] !== edge.hex)
            .map(edge => [[...path, hex], foe, edge.hex] as pathing))
        }
      }
      return paths
    }
  },

  getMandatoryMoves(getters: Getters): Stack[] {
    return getters.activeStacks.filter(stack => !stack.hasMoved() &&
      getters.stacksForHex(stack.origin).length > 1 &&
      getters.pathsForHex(stack.hex).length > 0)
  },

  getActivePlayer(): Player {
    return this.players[this.activePlayer]
  },

  getActivePlayerId(getters: Getters): PlayerId {
    return getters.activePlayer.id
  },

  getBattleActivePlayer(): PlayerId | undefined {
    return this.activeBattle?.getActivePlayer()
  },

  getBattlePhaseType(): BattlePhaseType | undefined {
    return this.activeBattle === undefined ? undefined : BATTLE_PHASE_TYPES[this.activeBattle.phase]
  },

  getBattleMoves(): (creature: BattleCreature) => Set<number> {
    return (creature: BattleCreature) => {
      return this.activeBattle === undefined ? new Set<number>() : this.activeBattle.movementFor(creature)
    }
  },

  getBattleEngagements(): (creature: BattleCreature) => BattleCreature[] {
    return (creature: BattleCreature) => {
      return this.activeBattle === undefined ? [] : this.activeBattle.engagedWith(creature)
    }
  },

  getBattleCarryoverTargets(): BattleCreature[] | undefined {
    return this.activeBattle?.carryoverTargets()
  },

  getBattleRangestrikeTargets(): (creature: BattleCreature) => RangestrikeTarget[] {
    return (creature: BattleCreature) => {
      return this.activeBattle === undefined ? [] : this.activeBattle.rangestrikeTargets(creature)
    }
  },

  getMayProceed(getters: Getters): boolean {
    switch (this.activePhase) {
      case MasterboardPhase.SPLIT:
        return getters.activeStacks.every(stack => stack.isValidSplit(this.round === 0))
      case MasterboardPhase.MOVE:
        return getters.mandatoryMoves.length === 0 &&
          getters.activeStacks.some(stack => stack.hasMoved())
      case MasterboardPhase.BATTLE:
        return true
      case MasterboardPhase.MUSTER:
        return true
      case MasterboardPhase.END:
        return true
    }
  },

  getMulliganAvailable(getters: Getters): boolean {
    return this.round === 0 && !this.mulliganTaken &&
      !getters.activeStacks.some(stack => stack.hasMoved())
  },

  getEngagedStacks(getters: Getters): Stack[] {
    return getters.activeStacks
      .filter(stack => getters.stacksForHex(stack.hex)
        .some(occupant => occupant.owner !== getters.activePlayerId))
  }
}
