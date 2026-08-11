import { assign } from "lodash-es"
import { assert } from "@/utils/assert"
import { div } from "@/utils/math"
import { CREATURE_DATA, CreatureType } from "../creature"
import { HexEdge, Terrain } from "../masterboard"
import { PlayerId } from "../player"
import {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARDS,
  BattleBoard,
  EdgeHazard,
  Hazard,
  UNATTAINABLE_MOVEMENT_COST,
  getAdjacentHexForRelation,
  isCreatureEdgeNative,
  isCreatureNative,
  relationToHex
} from "./board"
import {
  BattleCreature,
  performStrike,
  wound
} from "./combatant"
import {
  ActiveStrike,
  BATTLE_PHASE_TYPES,
  BattlePhase,
  BattlePhaseType,
  RangestrikeTarget,
  Strike,
  isRangestrike
} from "./strike"

export interface BattleSide {
  player: PlayerId
  score: number
  creatures: CreatureType[]
}

export interface BattleMovePayload { creature: BattleCreature["id"], hex: number }
interface IStrikePayload { attacker: BattleCreature["id"], rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature["id"], optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload {
  target: Omit<RangestrikeTarget, "creature"> & { creature: BattleCreature["id"] }
}

export class Battle {
  readonly attackerEdge: HexEdge
  readonly terrain: Terrain
  readonly attacker: PlayerId
  readonly defender: PlayerId
  readonly creatures: BattleCreature[]

  round: number
  phase: BattlePhase
  activeStrike?: ActiveStrike

  constructor(terrain: Terrain, edge: HexEdge, attacking: BattleSide, defending: BattleSide) {
    this.round = 0
    this.phase = BattlePhase.DEFENDER_MOVE
    this.terrain = terrain
    this.attackerEdge = terrain === Terrain.TOWER ? HexEdge.SECOND : edge
    this.attacker = attacking.player
    this.defender = defending.player
    this.creatures = attacking.creatures.map(type => new BattleCreature({
      type,
      player: attacking.player,
      playerScore: attacking.score,
      hex: 37 + this.attackerEdge * 2
    })).concat(defending.creatures.map(type => new BattleCreature({
      type,
      player: defending.player,
      playerScore: defending.score,
      hex: 36 + this.attackerEdge * 2
    })))
  }

  static hydrate(battle: Battle): Battle {
    const hydrated: Battle = Object.assign(Object.create(Battle.prototype) as Battle, {
      ...battle,
      creatures: battle.creatures.map(creature => assign(new BattleCreature(creature), creature)),
      activeStrike: battle.activeStrike === undefined ? undefined : new ActiveStrike(battle.activeStrike)
    })
    return hydrated
  }

  getBoard(): BattleBoard {
    return BATTLE_BOARDS[this.terrain]
  }

  getActivePlayer(): PlayerId {
    switch (this.phase) {
      case BattlePhase.DEFENDER_MOVE:
      case BattlePhase.DEFENDER_STRIKE:
      case BattlePhase.DEFENDER_STRIKEBACK:
        return this.defender
      case BattlePhase.ATTACKER_STRIKEBACK:
      case BattlePhase.ATTACKER_MOVE:
      case BattlePhase.ATTACKER_STRIKE:
        return this.attacker
    }
  }

  getOffense(): BattleCreature[] {
    return this.creatures.filter(creature => creature.player === this.attacker)
  }

  getDefense(): BattleCreature[] {
    return this.creatures.filter(creature => creature.player === this.defender)
  }

  getActiveCreatures(): BattleCreature[] {
    return this.getActivePlayer() === this.attacker ? this.getOffense() : this.getDefense()
  }

  getPendingStrikes(): BattleCreature[] {
    return this.getActiveCreatures()
      .filter(creature => !creature.hasStruck && creature.hex > 0 && this.engagedWith(creature).length > 0)
  }

  /** End Phase Manipulation **/

  creatureOnHex(hex: number): BattleCreature | undefined {
    return this.creatures.find(creature => creature.hex === hex)
  }

  creatureMovementCost(hex: number, origin: number, creature: BattleCreature): number {
    const canFly = CREATURE_DATA[creature.type].canFly
    if (canFly || hex === creature.hex || this.creatureOnHex(hex) === undefined) {
      let cost = 1
      if (!canFly) {
        const upEdgeHazard = this.getBoard().getEdgeHazard(origin, hex)
        const downEdgeHazard = this.getBoard().getEdgeHazard(hex, origin)
        if (upEdgeHazard === EdgeHazard.CLIFF || downEdgeHazard === EdgeHazard.CLIFF) {
          return UNATTAINABLE_MOVEMENT_COST
        } else if (upEdgeHazard === EdgeHazard.WALL || (
          upEdgeHazard === EdgeHazard.SLOPE && !isCreatureEdgeNative(creature.type, upEdgeHazard))) {
          cost += 1
        }
      }

      const hazard = this.getBoard().getHazard(hex)
      const native = isCreatureNative(creature.type, hazard)
      switch (hazard) {
        case Hazard.NONE:
          return cost
        case Hazard.BRAMBLE:
        case Hazard.DRIFT:
          return native ? cost : cost + 1
        case Hazard.BOG:
        case Hazard.TREE:
          return native || canFly ? cost : UNATTAINABLE_MOVEMENT_COST
        case Hazard.SAND:
          return native || canFly ? cost : cost + 1
        case Hazard.VOLCANO:
          return native ? cost : UNATTAINABLE_MOVEMENT_COST
      }
    } else {
      return UNATTAINABLE_MOVEMENT_COST
    }
  }

  /** This method assumes the creature can enter - for efficiency, it will not check all rules */
  creatureCanLand(hex: number, creature: BattleCreature): boolean {
    const hazard = this.getBoard().getHazard(hex)
    return !(
      hazard === Hazard.TREE ||
      (hazard === Hazard.BOG && !isCreatureNative(creature.type, hazard)) ||
      this.creatureOnHex(hex) !== undefined
    )
  }

  // TODO: rule 11.3 (a creature already in contact with an enemy may not move) is not enforced
  // anywhere in this method or its callers - no engagement check exists in the movement-legality path.
  movementFor(creature: BattleCreature): Set<number> {
    if (creature.initialHex === 0) {
      return new Set<number>()
    }
    // Map of hex to remaining movement last time it was visited
    const possibilities = new Map<number, number>()
    const stack: Array<[number, number]> = [[creature.initialHex, CREATURE_DATA[creature.type].skill]]
    let entry
    while ((entry = stack.pop()) !== undefined) {
      const [origin, remainingMovement] = entry
      const adjacencies = BATTLE_BOARD_ADJACENCIES[origin]
        .filter(i => (possibilities.get(i) ?? -1) < remainingMovement)
      adjacencies.forEach(potentialHex => {
        const movementCost = this.creatureMovementCost(potentialHex, origin, creature)
        // console.log({ origin, potentialHex, remainingMovement, movementCost })
        if (movementCost <= remainingMovement) {
          if (remainingMovement - movementCost > 0) {
            stack.push([potentialHex, remainingMovement - movementCost])
          }
          if (this.creatureCanLand(potentialHex, creature)) {
            possibilities.set(potentialHex, remainingMovement - movementCost)
          }
        }
      })
    }
    return new Set<number>(possibilities.keys())
  }

  engagedWith(whom: BattleCreature, includeDead = false): BattleCreature[] {
    const hex = BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.MOVE ? whom.initialHex : whom.hex
    const adjacencies = BATTLE_BOARD_ADJACENCIES[hex]
    return this.creatures.filter(creature => creature.player !== whom.player &&
      (includeDead || creature.getRemainingHp() > 0) &&
      adjacencies.includes(creature.hex) &&
      // TODO: only checks the cliff hazard in the fixed direction (whom -> creature), so it misses
      // cliffs where `creature` (not `whom`) is the upper hex - creatureMovementCost above shows the
      // correct pattern of querying both directions and ORing the result.
      this.getBoard().getEdgeHazard(whom.hex, creature.hex) !== EdgeHazard.CLIFF)
  }

  carryoverTargets(): BattleCreature[] | undefined {
    if (this.activeStrike === undefined || !this.activeStrike.canCarryover) {
      return undefined
    }
    const attacker = this.creatureOnHex(this.activeStrike.attacker) as BattleCreature
    const toHit = this.activeStrike.toHit
    const targets = this.engagedWith(attacker)
      .filter(creature => this.toHitAdjusted(attacker, creature) <= toHit)
    return targets.length > 0 ? targets : undefined
  }

  // Returns Array<[target creature, hazard strike factor adjustment, long-distance]>
  // TODO: Warlocks can rangestrike creatures at the base of cliffs if not otherwise engaged
  //       This is very annoying, as it breaks the majority of the assumptions in this function
  rangestrikeTargets(creature: BattleCreature): RangestrikeTarget[] {
    const creatureStats = CREATURE_DATA[creature.type]
    if (creature.initialHex === 0 || !creatureStats.canRangestrike ||
      this.engagedWith(creature, true).length > 0) {
      return []
    }
    // Distance = 2
    const startingHexes = BATTLE_BOARD_ADJACENCIES[creature.hex]
    const paths: number[][] = startingHexes.flatMap(hex => {
      const direction = relationToHex(creature.hex, hex)
      // Distance = 3
      const possibleTargets = [direction - 1, direction, direction + 1]
        .map(relation => getAdjacentHexForRelation(hex, relation))
      // Distance = 4
      const longRange = creatureStats.skill < 4 ? [] : possibleTargets
        .map(target => [target, target !== undefined ? getAdjacentHexForRelation(target, direction) : undefined])
      return [...possibleTargets.map(target => [hex, target]), ...longRange.map(path => [hex, ...path])]
    }).filter(path => {
      const targetHex = path.at(-1)
      if (targetHex !== undefined) {
        const targetCreature = this.creatureOnHex(targetHex)
        return targetCreature !== undefined && targetCreature.player !== creature.player &&
          // Warlocks can rangestrike lords!
          (creature.type === CreatureType.WARLOCK || !CREATURE_DATA[targetCreature.type].lord) &&
          targetCreature.getRemainingHp() > 0
      }
      return false
    }) as number[][]
    if (creature.type === CreatureType.WARLOCK) {
      // Warlock rangestrikes are unaffected by other creatures and hazards
      return paths.map(path => ({
        creature: this.creatureOnHex(path.at(-1)!)!,
        adjustment: { toHit: 0, dice: 0 },
        longDistance: false
      }))
    }
    const adjustedPaths = paths.map(path => [path, this.getRangestrikeAdjustmentForHazards(creature, path)])
      .filter(([, adjustment]) => adjustment !== undefined) as Array<[number[], Strike]>

    const bestPaths = new Map<number, [number[], Strike]>()
    adjustedPaths.forEach(([path, strike]) => {
      const target = path.at(-1)
      assert(target !== undefined, "Path must have non-zero length")
      if (!bestPaths.has(target) || (bestPaths.get(target)?.[1]?.toHit ?? 0) < strike.toHit) {
        bestPaths.set(target, [path, strike])
      }
    })

    const results: RangestrikeTarget[] = []
    bestPaths.forEach(([path, adjustment]: [number[], Strike]) =>
      results.push({
        creature: this.creatureOnHex(path.at(-1)!)!,
        adjustment,
        longDistance: path.length > 2
      }))
    return results
  }

  private getRangestrikeAdjustmentForHazards(creature: BattleCreature, path: number[]): Strike | undefined {
    const board = this.getBoard()
    const targetHex = path.at(-1)
    assert(targetHex !== undefined, "Path must have non-zero length")
    const targetHazard = board.getHazard(targetHex)
    const targetCreature = this.creatureOnHex(targetHex)
    assert(targetCreature !== undefined, "Path must end in a creature")

    const crossedHazards: Record<EdgeHazard, number> = {
      [EdgeHazard.NONE]: 0,
      [EdgeHazard.CLIFF]: 0,
      [EdgeHazard.DUNE]: 0,
      [EdgeHazard.SLOPE]: 0,
      [EdgeHazard.WALL]: 0
    }
    let atopAtLeastOneEdge = false // Used for walls and slopes, which do not appear on the same maps
    let adjustment = 0

    if (targetHazard === Hazard.VOLCANO && targetCreature.type === CreatureType.DRAGON) {
      // Dragons in volcanos have the strike number needed to hit them increased by one
      // Dragons in volcanos get bonus dice when rangestriking out (not covered here)
      adjustment += 1
    }

    // Ensure path does not go through a creature or a tree
    if (path.slice(0, -1).some(hex => this.creatureOnHex(hex) !== undefined ||
      board.getHazard(hex) === Hazard.TREE)) {
      return undefined
    }

    const attackerIsBrambleNative = isCreatureNative(creature.type, Hazard.BRAMBLE)
    if (targetHazard === Hazard.BRAMBLE && isCreatureNative(targetCreature.type, Hazard.BRAMBLE) &&
      !attackerIsBrambleNative) {
      // A native character defending in brambles is harder to hit when attacked by a non-native
      adjustment += 1
    }
    if (!attackerIsBrambleNative) {
      // A non-native rangestriker loses a skill factor for each intervening hex containing bramble
      adjustment += path.slice(0, -1).filter(hex => board.getHazard(hex) === Hazard.BRAMBLE).length
    }

    // Dunes, cliffs, slopes, and walls
    for (let i = 0; i < path.length; ++i) {
      const last = i === 0 ? creature.hex : path[i - 1]
      const next = path[i]
      const lastElevation = board.getElevation(last)
      const nextElevation = board.getElevation(next)
      let hazard = EdgeHazard.NONE
      if (lastElevation > nextElevation) {
        hazard = board.getEdgeHazard(next, last)
      } else if (nextElevation > lastElevation) {
        hazard = board.getEdgeHazard(last, next)
      }
      crossedHazards[hazard] += 1
      if (hazard !== EdgeHazard.NONE) {
        const rangestrikerOrTargetAtopHex = (i === 0 && lastElevation > nextElevation) ||
          (i === path.length - 1 && lastElevation < nextElevation)
        switch (hazard) {
          case EdgeHazard.CLIFF:
            // Rangestriker or target must be atop the cliff
            // (and if that's the case, we pass the slope check)
            atopAtLeastOneEdge = rangestrikerOrTargetAtopHex
          case EdgeHazard.DUNE:
            // Rangestriker or target must occupy dune hex for each crossed dune
            if (!rangestrikerOrTargetAtopHex) {
              return undefined
            }
            break
          case EdgeHazard.SLOPE:
            if (crossedHazards[EdgeHazard.SLOPE] === 3 &&
              !(atopAtLeastOneEdge && rangestrikerOrTargetAtopHex)) {
              // For the third slope, we must have had the attacker on top of the first slope and the
              // target atop the final slope, otherwise we fail the slope check
              return undefined
            }
            atopAtLeastOneEdge = atopAtLeastOneEdge || rangestrikerOrTargetAtopHex
            break
          case EdgeHazard.WALL:
            if (lastElevation < nextElevation) {
              // Lose a skill factor for crossing a wall upwards
              adjustment += 1
            }
            atopAtLeastOneEdge = atopAtLeastOneEdge || rangestrikerOrTargetAtopHex
            break
        }
      }
    }
    if (crossedHazards[EdgeHazard.WALL] > 0 || crossedHazards[EdgeHazard.SLOPE] > 0) {
      if (!atopAtLeastOneEdge) {
        return undefined
      }
      if (crossedHazards[EdgeHazard.WALL] === 2) {
        // Target or attacker is in the center of the tower, this must be a long-distance
        // rangestrike to ensure the other character isn't at the base of the tower
        if (!((targetHex === 15 || creature.hex === 15) && path.length > 2)) {
          return undefined
        }
      }
    }

    if (creature.type === CreatureType.DRAGON && board.getHazard(creature.hex) === Hazard.VOLCANO) {
      return { toHit: adjustment, dice: 2 }
    } else {
      return { toHit: adjustment, dice: 0 }
    }
  }

  private strikeAdjustmentEdge(striker: BattleCreature, target: BattleCreature): Strike {
    const board = this.getBoard()
    const strikingUp = board.getElevation(striker.hex) <= board.getElevation(target.hex)
    const edgeHazard = board.getEdgeHazard(strikingUp ? striker.hex : target.hex,
      strikingUp ? target.hex : striker.hex)
    if (edgeHazard === EdgeHazard.SLOPE) {
      const strikerNative = isCreatureEdgeNative(striker.type, edgeHazard)
      if (strikerNative && !strikingUp) {
        return { toHit: 0, dice: 1 }
      } else if (!strikerNative && strikingUp) {
        return { toHit: 1, dice: 0 }
      }
    } else if (edgeHazard === EdgeHazard.DUNE) {
      const strikerNative = isCreatureEdgeNative(striker.type, edgeHazard)
      if (strikerNative && !strikingUp) {
        return { toHit: 0, dice: 2 }
      } else if (!strikerNative && strikingUp) {
        return { toHit: 0, dice: -1 }
      }
    } else if (edgeHazard === EdgeHazard.WALL) {
      return { toHit: strikingUp ? 1 : -1, dice: 0 }
    }
    return { toHit: 0, dice: 0 }
  }

  strikeAdjustment(striker: BattleCreature, target: BattleCreature): Strike {
    const board = this.getBoard()
    const strikerHazard = board.getHazard(striker.hex)
    const strikerNative = isCreatureNative(striker.type, strikerHazard)
    const targetHazard = board.getHazard(target.hex)
    const targetNative = isCreatureNative(target.type, targetHazard)
    const edgeAdjustment = this.strikeAdjustmentEdge(striker, target)
    let adjustment = { toHit: 0, dice: 0 }
    if (strikerHazard === Hazard.BRAMBLE && !strikerNative) {
      adjustment = { toHit: 1, dice: 0 }
    } else if (targetHazard === Hazard.BRAMBLE && targetNative &&
      !isCreatureNative(striker.type, targetHazard)) {
      adjustment = { toHit: 1, dice: 0 }
    } else if (strikerHazard === Hazard.VOLCANO && strikerNative) {
      adjustment = { toHit: 0, dice: 2 }
    }
    return Strike.combine(adjustment, edgeAdjustment, false)
  }

  /** Attacker must roll at least this high to get a hit. */
  toHitRaw(attacker: BattleCreature, defender: BattleCreature): number {
    return 4 - (CREATURE_DATA[attacker.type].skill - CREATURE_DATA[defender.type].skill)
  }

  /** Attacker must roll at least this high to get a hit. */
  toHitAdjusted(attacker: BattleCreature, defender: BattleCreature): number {
    return Strike.combine(
      { dice: 0, toHit: this.toHitRaw(attacker, defender) },
      this.strikeAdjustment(attacker, defender)
    ).toHit
  }

  getRawStrike(attacker: BattleCreature, defender: BattleCreature): Strike {
    return {
      toHit: this.toHitRaw(attacker, defender),
      dice: attacker.getStrength()
    }
  }

  getAdjustedStrike(attacker: BattleCreature, defender: BattleCreature): Strike {
    return Strike.combine(this.getRawStrike(attacker, defender),
      this.strikeAdjustment(attacker, defender))
  }

  getRangestrike(attacker: BattleCreature, target: RangestrikeTarget): Strike {
    const rawStrike = this.getRawStrike(attacker, target.creature)
    return Strike.combine({
      toHit: target.longDistance ? rawStrike.toHit + 1 : rawStrike.toHit,
      dice: div(rawStrike.dice, 2)
    }, target.adjustment)
  }

  getTargetedStrike(attacker: BattleCreature, target: BattleCreature | RangestrikeTarget): Strike {
    if (isRangestrike(target)) {
      return this.getRangestrike(attacker, target)
    } else {
      return this.getAdjustedStrike(attacker, target)
    }
  }

  // Actions

  async moveCreature(payload: BattleMovePayload): Promise<void> {
    const creature = this.creatures.find(c => c.id === payload.creature)
    assert(creature !== undefined, "Unexpected creature")
    assert(BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === this.getActivePlayer(), "Incorrect player")
    creature.hex = payload.hex
  }

  async nextBattlePhase(): Promise<void> {
    nextPhase(this)
  }

  async attackCreature({ attacker, target, rolls, optionalToHit }: AttackPayload): Promise<void> {
    const { attackerCreature, targetCreature } = this.resolveStrikingCreatures(attacker, target)
    let toHit = this.toHitAdjusted(attackerCreature, targetCreature)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    performAttack(this, attackerCreature, targetCreature, rolls, toHit, false)
  }

  async rangestrikeCreature({ attacker, target, rolls }: RangestrikePayload): Promise<void> {
    const { attackerCreature, targetCreature } = this.resolveStrikingCreatures(attacker, target.creature)
    const computedStrike = this.getRangestrike(attackerCreature, { ...target, creature: targetCreature })
    performAttack(this, attackerCreature, targetCreature, rolls, computedStrike.toHit, true)
  }

  async assignCarryover(target: BattleCreature["id"]): Promise<void> {
    const targetCreature = this.creatures.find(c => c.id === target)
    assert(targetCreature !== undefined, "Unexpected target")
    assert(BATTLE_PHASE_TYPES[this.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    // Using an optional chain prevents typescript from learning that activeStrike is present
    assert(this.activeStrike !== undefined &&
      this.activeStrike.canCarryover, "Cannot carryover")
    const hits = Math.min(this.activeStrike.getCarryoverHits(), targetCreature.getRemainingHp())
    this.activeStrike.targets.push(targetCreature.hex)
    this.activeStrike.targetHits.push(hits)
    wound(targetCreature, hits)
  }

  async skipCarryover(): Promise<void> {
    if (this.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(BATTLE_PHASE_TYPES[this.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    this.activeStrike.carryoverSkipped = true
  }

  private resolveStrikingCreatures(attackerId: BattleCreature["id"], targetId: BattleCreature["id"]):
    { attackerCreature: BattleCreature, targetCreature: BattleCreature } {
    const attackerCreature = this.creatures.find(c => c.id === attackerId)
    assert(attackerCreature !== undefined, "Unexpected attacker")
    const targetCreature = this.creatures.find(c => c.id === targetId)
    assert(targetCreature !== undefined, "Unexpected defender")
    assert(BATTLE_PHASE_TYPES[this.phase] !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attackerCreature.player === this.getActivePlayer(), "Incorrect player")
    return { attackerCreature, targetCreature }
  }

}

// TODO: rolls is never validated against the strike's expected dice count (see
// getAdjustedStrike/getRangestrike), so a caller can pass the wrong number of dice unnoticed.
export function performAttack(battle: Battle, attacker: BattleCreature, defender: BattleCreature,
  rolls: number[], toHit: number, rangestrike: boolean): void {
  const totalHits = rolls.filter(roll => roll >= toHit).length
  const hits = Math.min(totalHits, defender.getRemainingHp())
  performStrike(attacker)
  wound(defender, hits)
  battle.activeStrike = new ActiveStrike({
    attacker: attacker.hex,
    target: defender.hex,
    totalHits,
    hits,
    toHit,
    rolls,
    rangestrike
  })
}

export function nextPhase(battle: Battle): void {
  if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE) {
    battle.getActiveCreatures().forEach(creature => {
      if (creature.hex >= 36) {
        creature.hex = 0
      }
    })
  } else if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKE ||
    BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKEBACK) {
    assert(battle.getPendingStrikes().length === 0, "All eligible creatures must strike")
    battle.activeStrike = undefined
    if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKEBACK) {
      battle.creatures.forEach(creature => {
        if (creature.getRemainingHp() <= 0) {
          creature.hex = 0
        }
      })
    }
  }
  if (battle.phase === BattlePhase.DEFENDER_STRIKEBACK) {
    battle.round += 1
    battle.phase = BattlePhase.DEFENDER_MOVE
  } else {
    battle.phase += 1
  }
  if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE) {
    battle.getActiveCreatures().forEach(creature => {
      creature.initialHex = creature.hex
    })
  } else if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKE) {
    phaseEnterStrike(battle)
  }

  // Skip phase if possible
  if (BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE) {
    if (battle.getPendingStrikes().length === 0) {
      console.log(`Skipping phase ${battle.phase} thanks to no pending strikes`)
      nextPhase(battle)
    }
  }
}

export function phaseEnterStrike(battle: Battle): void {
  battle.activeStrike = undefined
  battle.creatures.forEach(creature => {
    creature.hasStruck = false
  })
  if (battle.terrain === Terrain.TUNDRA) {
    battle.creatures
      .filter(creature => battle.getBoard().getHazard(creature.hex) === Hazard.DRIFT)
      .forEach(creature => wound(creature, 1))
  }
}
