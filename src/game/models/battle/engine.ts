import { assert } from "@/utils/assert"
import { div } from "@/utils/math"
import { CREATURE_DATA, CreatureType } from "../creature"
import { HexEdge, Terrain } from "../masterboard"
import { PlayerId } from "../player"
import {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARDS,
  EdgeHazard,
  Hazard,
  UNATTAINABLE_MOVEMENT_COST,
  getAdjacentHexForRelation,
  isCreatureEdgeNative,
  isCreatureNative,
  relationToHex
} from "./board"
import { BattleCreature } from "./combatant"
import { BATTLE_PHASE_TYPES, BattlePhase, BattlePhaseType } from "./phase"
import { ActiveStrike, RangestrikeTarget, Strike, isRangestrike } from "./strike"

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

export interface Battle {
  readonly attackerEdge: HexEdge
  readonly terrain: Terrain
  readonly attacker: PlayerId
  readonly defender: PlayerId
  readonly creatures: BattleCreature[]

  round: number
  phase: BattlePhase
  activeStrike?: ActiveStrike
}

export type CreateBattleOptions = Pick<Battle, "terrain"> & {
  edge: HexEdge
  attacking: BattleSide
  defending: BattleSide
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Battle {
  export function create({ terrain, edge, attacking, defending }: CreateBattleOptions): Battle {
    const attackerEdge = terrain === Terrain.TOWER ? HexEdge.SECOND : edge
    return {
      attackerEdge,
      terrain,
      attacker: attacking.player,
      defender: defending.player,
      creatures: attacking.creatures.map(type => BattleCreature.create({
        type,
        player: attacking.player,
        playerScore: attacking.score,
        hex: 37 + attackerEdge * 2
      })).concat(defending.creatures.map(type => BattleCreature.create({
        type,
        player: defending.player,
        playerScore: defending.score,
        hex: 36 + attackerEdge * 2
      }))),
      round: 0,
      phase: BattlePhase.DEFENDER_MOVE,
      activeStrike: undefined
    }
  }

  export function getActivePlayer(battle: Battle): PlayerId {
    switch (battle.phase) {
      case BattlePhase.DEFENDER_MOVE:
      case BattlePhase.DEFENDER_STRIKE:
      case BattlePhase.DEFENDER_STRIKEBACK:
        return battle.defender
      case BattlePhase.ATTACKER_STRIKEBACK:
      case BattlePhase.ATTACKER_MOVE:
      case BattlePhase.ATTACKER_STRIKE:
        return battle.attacker
    }
  }

  export function getActiveCreatures(battle: Battle): BattleCreature[] {
    return battle.creatures.filter(creature => creature.player === getActivePlayer(battle))
  }

  export function getPendingStrikes(battle: Battle): BattleCreature[] {
    return getActiveCreatures(battle)
      .filter(creature => !creature.hasStruck && creature.hex > 0 && engagedWith(battle, creature).length > 0)
  }

  /** End Phase Manipulation **/

  export function creatureOnHex(battle: Battle, hex: number): BattleCreature | undefined {
    return battle.creatures.find(creature => creature.hex === hex)
  }

  export function creatureMovementCost(battle: Battle, hex: number, origin: number,
    creature: BattleCreature): number {
    const board = BATTLE_BOARDS[battle.terrain]
    const canFly = CREATURE_DATA[creature.type].canFly
    if (canFly || hex === creature.hex || creatureOnHex(battle, hex) === undefined) {
      let cost = 1
      if (!canFly) {
        const upEdgeHazard = board.getEdgeHazard(origin, hex)
        const downEdgeHazard = board.getEdgeHazard(hex, origin)
        if (upEdgeHazard === EdgeHazard.CLIFF || downEdgeHazard === EdgeHazard.CLIFF) {
          return UNATTAINABLE_MOVEMENT_COST
        } else if (upEdgeHazard === EdgeHazard.WALL || (
          upEdgeHazard === EdgeHazard.SLOPE && !isCreatureEdgeNative(creature.type, upEdgeHazard))) {
          cost += 1
        }
      }

      const hazard = board.getHazard(hex)
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

  /** This function assumes the creature can enter - for efficiency, it will not check all rules */
  export function creatureCanLand(battle: Battle, hex: number, creature: BattleCreature): boolean {
    const hazard = BATTLE_BOARDS[battle.terrain].getHazard(hex)
    return !(
      hazard === Hazard.TREE ||
      (hazard === Hazard.BOG && !isCreatureNative(creature.type, hazard)) ||
      creatureOnHex(battle, hex) !== undefined
    )
  }

  // TODO: rule 11.3 (a creature already in contact with an enemy may not move) is not enforced
  // anywhere in this function or its callers - no engagement check exists in the movement-legality path.
  export function movementFor(battle: Battle, creature: BattleCreature): Set<number> {
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
        const movementCost = creatureMovementCost(battle, potentialHex, origin, creature)
        // console.log({ origin, potentialHex, remainingMovement, movementCost })
        if (movementCost <= remainingMovement) {
          if (remainingMovement - movementCost > 0) {
            stack.push([potentialHex, remainingMovement - movementCost])
          }
          if (creatureCanLand(battle, potentialHex, creature)) {
            possibilities.set(potentialHex, remainingMovement - movementCost)
          }
        }
      })
    }
    return new Set<number>(possibilities.keys())
  }

  export function engagedWith(battle: Battle, whom: BattleCreature, includeDead = false): BattleCreature[] {
    const board = BATTLE_BOARDS[battle.terrain]
    const hex = BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE ? whom.initialHex : whom.hex
    const adjacencies = BATTLE_BOARD_ADJACENCIES[hex]
    return battle.creatures.filter(creature => creature.player !== whom.player &&
      (includeDead || creature.wounds < creature.strength) &&
      adjacencies.includes(creature.hex) &&
      board.getEdgeHazard(whom.hex, creature.hex) !== EdgeHazard.CLIFF &&
      board.getEdgeHazard(creature.hex, whom.hex) !== EdgeHazard.CLIFF)
  }

  export function carryoverTargets(battle: Battle): BattleCreature[] | undefined {
    if (battle.activeStrike === undefined || ActiveStrike.getCarryoverHits(battle.activeStrike) <= 0) {
      return undefined
    }
    const attacker = creatureOnHex(battle, battle.activeStrike.attacker) as BattleCreature
    const toHit = battle.activeStrike.toHit
    const targets = engagedWith(battle, attacker)
      .filter(creature => toHitAdjusted(battle, attacker, creature) <= toHit)
    return targets.length > 0 ? targets : undefined
  }

  // Returns Array<[target creature, hazard strike factor adjustment, long-distance]>
  // TODO: Warlocks can rangestrike creatures at the base of cliffs if not otherwise engaged
  //       This is very annoying, as it breaks the majority of the assumptions in this function
  export function rangestrikeTargets(battle: Battle, creature: BattleCreature): RangestrikeTarget[] {
    const creatureStats = CREATURE_DATA[creature.type]
    if (creature.initialHex === 0 || !creatureStats.canRangestrike ||
      engagedWith(battle, creature, true).length > 0) {
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
        const targetCreature = creatureOnHex(battle, targetHex)
        return targetCreature !== undefined && targetCreature.player !== creature.player &&
          // Warlocks can rangestrike lords!
          (creature.type === CreatureType.WARLOCK || !CREATURE_DATA[targetCreature.type].lord) &&
          targetCreature.wounds < targetCreature.strength
      }
      return false
    }) as number[][]
    if (creature.type === CreatureType.WARLOCK) {
      // Warlock rangestrikes are unaffected by other creatures and hazards
      return paths.map(path => ({
        creature: creatureOnHex(battle, path.at(-1)!)!,
        adjustment: { toHit: 0, dice: 0 },
        longDistance: false
      }))
    }
    const adjustedPaths = paths.map(path => [path, getRangestrikeAdjustmentForHazards(battle, creature, path)])
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
        creature: creatureOnHex(battle, path.at(-1)!)!,
        adjustment,
        longDistance: path.length > 2
      }))
    return results
  }

  function getRangestrikeAdjustmentForHazards(battle: Battle, creature: BattleCreature,
    path: number[]): Strike | undefined {
    const board = BATTLE_BOARDS[battle.terrain]
    const targetHex = path.at(-1)
    assert(targetHex !== undefined, "Path must have non-zero length")
    const targetHazard = board.getHazard(targetHex)
    const targetCreature = creatureOnHex(battle, targetHex)
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
    if (path.slice(0, -1).some(hex => creatureOnHex(battle, hex) !== undefined ||
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

  function strikeAdjustmentEdge(battle: Battle, striker: BattleCreature, target: BattleCreature): Strike {
    const board = BATTLE_BOARDS[battle.terrain]
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

  export function strikeAdjustment(battle: Battle, striker: BattleCreature, target: BattleCreature): Strike {
    const board = BATTLE_BOARDS[battle.terrain]
    const strikerHazard = board.getHazard(striker.hex)
    const strikerNative = isCreatureNative(striker.type, strikerHazard)
    const targetHazard = board.getHazard(target.hex)
    const targetNative = isCreatureNative(target.type, targetHazard)
    const edgeAdjustment = strikeAdjustmentEdge(battle, striker, target)
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
  export function toHitRaw(attacker: BattleCreature, defender: BattleCreature): number {
    return 4 - (CREATURE_DATA[attacker.type].skill - CREATURE_DATA[defender.type].skill)
  }

  /** Attacker must roll at least this high to get a hit. */
  export function toHitAdjusted(battle: Battle, attacker: BattleCreature, defender: BattleCreature): number {
    return Strike.combine(
      { dice: 0, toHit: toHitRaw(attacker, defender) },
      strikeAdjustment(battle, attacker, defender)
    ).toHit
  }

  export function getRawStrike(attacker: BattleCreature, defender: BattleCreature): Strike {
    return {
      toHit: toHitRaw(attacker, defender),
      dice: attacker.strength
    }
  }

  export function getAdjustedStrike(battle: Battle, attacker: BattleCreature, defender: BattleCreature): Strike {
    return Strike.combine(getRawStrike(attacker, defender),
      strikeAdjustment(battle, attacker, defender))
  }

  export function getRangestrike(attacker: BattleCreature, target: RangestrikeTarget): Strike {
    const rawStrike = getRawStrike(attacker, target.creature)
    return Strike.combine({
      toHit: target.longDistance ? rawStrike.toHit + 1 : rawStrike.toHit,
      dice: div(rawStrike.dice, 2)
    }, target.adjustment)
  }

  export function getTargetedStrike(battle: Battle, attacker: BattleCreature,
    target: BattleCreature | RangestrikeTarget): Strike {
    if (isRangestrike(target)) {
      return getRangestrike(attacker, target)
    } else {
      return getAdjustedStrike(battle, attacker, target)
    }
  }

  // Actions

  export async function moveCreature(battle: Battle, payload: BattleMovePayload): Promise<void> {
    const creature = battle.creatures.find(c => c.id === payload.creature)
    assert(creature !== undefined, "Unexpected creature")
    assert(BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === getActivePlayer(battle), "Incorrect player")
    creature.hex = payload.hex
  }

  export async function attackCreature(battle: Battle,
    { attacker, target, rolls, optionalToHit }: AttackPayload): Promise<void> {
    const { attackerCreature, targetCreature } = resolveStrikingCreatures(battle, attacker, target)
    let toHit = toHitAdjusted(battle, attackerCreature, targetCreature)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    performAttack(battle, attackerCreature, targetCreature, rolls, toHit, false)
  }

  export async function rangestrikeCreature(battle: Battle,
    { attacker, target, rolls }: RangestrikePayload): Promise<void> {
    const { attackerCreature, targetCreature } = resolveStrikingCreatures(battle, attacker, target.creature)
    const computedStrike = getRangestrike(attackerCreature, { ...target, creature: targetCreature })
    performAttack(battle, attackerCreature, targetCreature, rolls, computedStrike.toHit, true)
  }

  export async function assignCarryover(battle: Battle, target: BattleCreature["id"]): Promise<void> {
    const targetCreature = battle.creatures.find(c => c.id === target)
    assert(targetCreature !== undefined, "Unexpected target")
    assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    // Using an optional chain prevents typescript from learning that activeStrike is present
    assert(battle.activeStrike !== undefined && !ActiveStrike.isRangestrike(battle.activeStrike) &&
      ActiveStrike.getCarryoverHits(battle.activeStrike) > 0, "Cannot carryover")
    const hits = Math.min(
      ActiveStrike.getCarryoverHits(battle.activeStrike), targetCreature.strength - targetCreature.wounds)
    battle.activeStrike.carryoverTargets.push(targetCreature.hex)
    battle.activeStrike.targetHits.push(hits)
    targetCreature.wounds += hits
  }

  export async function skipCarryover(battle: Battle): Promise<void> {
    if (battle.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    assert(!ActiveStrike.isRangestrike(battle.activeStrike), "Cannot carryover on a rangestrike")
    battle.activeStrike.carryoverSkipped = true
  }

  function resolveStrikingCreatures(battle: Battle, attackerId: BattleCreature["id"],
    targetId: BattleCreature["id"]): { attackerCreature: BattleCreature, targetCreature: BattleCreature } {
    const attackerCreature = battle.creatures.find(c => c.id === attackerId)
    assert(attackerCreature !== undefined, "Unexpected attacker")
    const targetCreature = battle.creatures.find(c => c.id === targetId)
    assert(targetCreature !== undefined, "Unexpected defender")
    assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attackerCreature.player === getActivePlayer(battle), "Incorrect player")
    return { attackerCreature, targetCreature }
  }

  // TODO: rolls is never validated against the strike's expected dice count (see
  // getAdjustedStrike/getRangestrike), so a caller can pass the wrong number of dice unnoticed.
  export function performAttack(battle: Battle, attacker: BattleCreature, defender: BattleCreature,
    rolls: number[], toHit: number, rangestrike: boolean): void {
    attacker.hasStruck = true
    battle.activeStrike = ActiveStrike.create({
      attacker: attacker.hex,
      target: defender.hex,
      defenderRemainingHp: defender.strength - defender.wounds,
      toHit,
      rolls,
      rangestrike
    })
    defender.wounds += battle.activeStrike.targetHits[0]
  }

  export function nextPhase(battle: Battle): void {
    if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE) {
      getActiveCreatures(battle).forEach(creature => {
        if (creature.hex >= 36) {
          creature.hex = 0
        }
      })
    } else if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKE ||
      BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKEBACK) {
      assert(getPendingStrikes(battle).length === 0, "All eligible creatures must strike")
      battle.activeStrike = undefined
      if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKEBACK) {
        battle.creatures.forEach(creature => {
          if (creature.wounds >= creature.strength) {
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
      getActiveCreatures(battle).forEach(creature => {
        creature.initialHex = creature.hex
      })
    } else if (BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.STRIKE) {
      phaseEnterStrike(battle)
    }

    // Skip phase if possible
    if (BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE) {
      if (getPendingStrikes(battle).length === 0) {
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
        .filter(creature => BATTLE_BOARDS[battle.terrain].getHazard(creature.hex) === Hazard.DRIFT)
        .forEach(creature => { creature.wounds += 1 })
    }
  }
}
