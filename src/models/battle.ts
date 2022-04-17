import _ from "lodash"
import { assert } from "~/utils/assert"
import { div } from "~/utils/math"
import { CREATURE_DATA, CreatureType } from "./creature"
import { TitanGame } from "./game"
import masterboard, { HexEdge, Terrain } from "./masterboard"
import { PlayerId } from "./player"
import { Stack } from "./stack"

export enum Hazard {
  NONE,
  BOG,
  BRAMBLE,
  DRIFT,
  SAND,
  TREE,
  VOLCANO,
}

export enum EdgeHazard {
  NONE,
  CLIFF,
  DUNE,
  SLOPE,
  WALL
}

const HAZARD_NATIVES: Record<Hazard, Set<CreatureType>> = {
  [Hazard.NONE]: new Set<CreatureType>(),
  [Hazard.BOG]: new Set<CreatureType>([
    CreatureType.OGRE, CreatureType.TROLL, CreatureType.RANGER,
    CreatureType.WYVERN, CreatureType.HYDRA
  ]),
  [Hazard.BRAMBLE]: new Set<CreatureType>([
    CreatureType.GARGOYLE, CreatureType.CYCLOPS, CreatureType.GORGON,
    CreatureType.BEHEMOTH, CreatureType.SERPENT
  ]),
  [Hazard.DRIFT]: new Set<CreatureType>([
    CreatureType.TROLL, CreatureType.WARBEAR, CreatureType.GIANT, CreatureType.COLOSSUS
  ]),
  [Hazard.SAND]: new Set<CreatureType>([
    CreatureType.LION, CreatureType.GRIFFON, CreatureType.HYDRA
  ]),
  [Hazard.TREE]: new Set<CreatureType>(),
  [Hazard.VOLCANO]: new Set<CreatureType>([CreatureType.DRAGON])
}

const EDGE_HAZARD_NATIVES: Record<EdgeHazard, Set<CreatureType>> = {
  [EdgeHazard.NONE]: new Set<CreatureType>(),
  [EdgeHazard.CLIFF]: new Set<CreatureType>(),
  [EdgeHazard.DUNE]: new Set<CreatureType>([
    CreatureType.LION, CreatureType.GRIFFON, CreatureType.HYDRA
  ]),
  [EdgeHazard.SLOPE]: new Set<CreatureType>([
    CreatureType.OGRE, CreatureType.LION, CreatureType.MINOTAUR,
    CreatureType.UNICORN, CreatureType.DRAGON, CreatureType.COLOSSUS
  ]),
  [EdgeHazard.WALL]: new Set<CreatureType>()
}

export interface Strike {
  readonly toHit: number
  readonly dice: number
}

export const combineStrikes = (a: Strike, b: Strike, clamp?: boolean): Strike => ({
  toHit: clamp === false ? a.toHit + b.toHit : _.clamp(a.toHit + b.toHit, 2, 6),
  dice: a.dice + b.dice
})

const isCreatureNative = (type: CreatureType, hazard: Hazard): boolean =>
  HAZARD_NATIVES[hazard].has(type)
const isCreatureEdgeNative = (type: CreatureType, hazard: EdgeHazard): boolean =>
  EDGE_HAZARD_NATIVES[hazard].has(type)

const UNATTAINABLE_MOVEMENT_COST = 99

export interface IBattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  hex: number
  wounds?: number
  initialHex?: number
  hasStruck?: boolean
}

export interface BattleCreature extends IBattleCreature {
  wounds: number
  initialHex: number
  hasStruck: boolean
}
export class BattleCreature {
  constructor(props: IBattleCreature) {
    Object.assign(this, {
      ...props,
      wounds: props.wounds ?? 0,
      initialHex: props.initialHex ?? props.hex,
      hasStruck: props.hasStruck ?? false
    })
  }

  getStrength(): number {
    return CREATURE_DATA[this.type].getStrength(this.playerScore)
  }

  getRemainingHp(): number {
    return this.getStrength() - this.wounds
  }

  wound(amount: number): void {
    this.wounds += amount
  }

  performStrike(): void {
    this.hasStruck = true
  }

  phaseEnterMove(): void {
    this.initialHex = this.hex
  }

  phaseExitMove(): void {
    if (this.hex >= 36) {
      this.hex = 0
    }
  }

  phaseEnterStrike(): void {
    this.hasStruck = false
  }

  phaseExitStrikeback(): void {
    if (this.getRemainingHp() <= 0) {
      this.hex = 0
    }
  }
}

export enum BattlePhaseType {
  MOVE,
  STRIKE,
  STRIKEBACK
}

export enum BattlePhase {
  DEFENDER_MOVE,
  DEFENDER_STRIKE,
  ATTACKER_STRIKEBACK,
  ATTACKER_MOVE,
  ATTACKER_STRIKE,
  DEFENDER_STRIKEBACK
}

export const BATTLE_PHASE_TYPES: Record<BattlePhase, BattlePhaseType> = {
  [BattlePhase.DEFENDER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.DEFENDER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.DEFENDER_STRIKEBACK]: BattlePhaseType.STRIKEBACK,
  [BattlePhase.ATTACKER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.ATTACKER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.ATTACKER_STRIKEBACK]: BattlePhaseType.STRIKEBACK
}

export const BATTLE_PHASE_TITLES: Record<BattlePhase, string> = {
  [BattlePhase.DEFENDER_MOVE]: "Defender's Move",
  [BattlePhase.DEFENDER_STRIKE]: "Defender's Strikes",
  [BattlePhase.DEFENDER_STRIKEBACK]: "Defender's Strikebacks",
  [BattlePhase.ATTACKER_MOVE]: "Attacker's Move",
  [BattlePhase.ATTACKER_STRIKE]: "Attacker's Strikes",
  [BattlePhase.ATTACKER_STRIKEBACK]: "Attacker's Strikebacks"
}

interface ActiveStrike {
  attacker: number
  target: number
  rolls: number[]
  totalHits: number
  carryoverHits: number
}

export class Battle {
  readonly hex: number
  readonly attackerEdge: HexEdge
  readonly terrain: Terrain
  readonly attacker: PlayerId
  readonly defender: PlayerId
  readonly creatures: BattleCreature[]

  round: number
  phase: BattlePhase
  activeStrike?: ActiveStrike

  // Parameters optional for Hydration
  constructor(hex: number, edge: HexEdge, game: TitanGame, attacking?: Stack, defending?: Stack) {
    this.round = 0
    this.phase = BattlePhase.DEFENDER_MOVE
    this.hex = hex
    this.terrain = masterboard.getHex(hex).terrain
    this.attackerEdge = this.terrain === Terrain.TOWER ? HexEdge.SECOND : edge
    if (attacking !== undefined && defending !== undefined) {
      this.attacker = attacking.owner
      this.defender = defending.owner
      this.creatures = attacking.creatures.map(type => new BattleCreature({
        type,
        player: attacking.owner,
        playerScore: game.getPlayerById()(attacking.owner)?.score ?? 0,
        hex: 37
      })).concat(defending.creatures.map(type => new BattleCreature({
        type,
        player: defending.owner,
        playerScore: game.getPlayerById()(defending.owner)?.score ?? 0,
        hex: 36
      })))
    } else {
      // These will be overwritten during hydration, but satisfy TypeScript
      this.attacker = 0
      this.defender = 0
      this.creatures = []
    }
  }

  static hydrate(battle: Battle, game: TitanGame): Battle {
    const hydrated = new Battle(battle.hex, battle.attackerEdge, game)
    Object.assign(hydrated, {
      ...battle,
      creatures: battle.creatures.map(creature => new BattleCreature(creature))
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

  /** Battle Phase Maintenance **/

  nextPhase(): void {
    if (BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.MOVE) {
      this.phaseExitMove()
    } else if (BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.STRIKEBACK) {
      this.phaseExitStrikeback()
    }
    if (this.phase === BattlePhase.DEFENDER_STRIKEBACK) {
      this.round += 1
      this.phase = BattlePhase.DEFENDER_MOVE
    } else {
      this.phase += 1
    }
    if (BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.MOVE) {
      this.phaseEnterMove()
    } else if (BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.STRIKE) {
      this.phaseEnterStrike()
    }
  }

  phaseEnterMove(): void {
    this.getActiveCreatures().forEach(creature => creature.phaseEnterMove())
  }

  phaseExitMove(): void {
    this.getActiveCreatures().forEach(creature => creature.phaseExitMove())
  }

  phaseEnterStrike(): void {
    this.activeStrike = undefined
    this.creatures.forEach(creature => creature.phaseEnterStrike())
    if (this.terrain === Terrain.TUNDRA) {
      this.creatures
        .filter(creature => this.getBoard().getHazard(creature.hex) === Hazard.DRIFT)
        .forEach(creature => creature.wound(1))
    }
  }

  phaseExitStrikeback(): void {
    this.creatures.forEach(creature => creature.phaseExitStrikeback())
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

  engagedWith(whom: BattleCreature): BattleCreature[] {
    const hex = BATTLE_PHASE_TYPES[this.phase] === BattlePhaseType.MOVE ? whom.initialHex : whom.hex
    const adjacencies = BATTLE_BOARD_ADJACENCIES[hex]
    return this.creatures.filter(creature => creature.player !== whom.player &&
      creature.getRemainingHp() > 0 &&
      adjacencies.includes(creature.hex) &&
      this.getBoard().getEdgeHazard(whom.hex, creature.hex) !== EdgeHazard.CLIFF)
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
    } else {
      return { toHit: 0, dice: 0 }
    }
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
    return combineStrikes(adjustment, edgeAdjustment, false)
  }

  /** Attacker must roll at least this high to get a hit. */
  toHitRaw(attacker: BattleCreature, defender: BattleCreature): number {
    return 4 - (CREATURE_DATA[attacker.type].skill - CREATURE_DATA[defender.type].skill)
  }

  /** Attacker must roll at least this high to get a hit. */
  toHitAdjusted(attacker: BattleCreature, defender: BattleCreature): number {
    return combineStrikes(
      { dice: 0, toHit: this.toHitRaw(attacker, defender) },
      this.strikeAdjustment(attacker, defender)
    ).toHit
  }

  strike(attacker: BattleCreature, defender: BattleCreature,
    rolls: number[], optionalToHit?: number): void {
    let toHit = this.toHitAdjusted(attacker, defender)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    const hits = rolls.filter(roll => roll >= toHit).length
    const carryover = Math.max(hits - defender.getRemainingHp(), 0)
    attacker.performStrike()
    defender.wound(hits - carryover)
    this.activeStrike = {
      attacker: attacker.hex,
      target: defender.hex,
      totalHits: hits,
      carryoverHits: carryover,
      rolls
    }
  }
}

export interface BattleBoardProps {
  elevations?: Record<number, number>
  hazards?: Record<number, Hazard>
  // Upper Hex -> Lower Hex -> Hazard
  edgeHazards?: Record<number, Record<number, EdgeHazard>>
}

export const BATTLE_BOARD_HEXES = Object.freeze([
  2, 3, 4,
  7, 8, 9, 10,
  13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23,
  25, 26, 27, 28, 29,
  31, 32, 33, 34
])

const getAdjacencyDists = (hex: number): number[] => {
  const dists = div(hex, 6) % 2 === 0
    ? [-7, -6, 1, 6, 5, -1]
    : [-6, -5, 1, 7, 6, -1]
  if (hex === 17) {
    dists[2] = 99
  } else if (hex === 18) {
    dists[5] = 99
  } else if (hex === 23) {
    dists[1] = 99
  }
  return dists
}

/** Return, starting from the above-left position, the index around the hex of the adjacent hex. */
export const relationToHex = (hex: number, adjacent: number): number =>
  getAdjacencyDists(hex).indexOf(adjacent - hex)

export const BATTLE_BOARD_ADJACENCIES = Object.freeze(Object.assign(Object.fromEntries(BATTLE_BOARD_HEXES
  .map((hex: number) => {
    const adjacencies = getAdjacencyDists(hex)
    return [hex, adjacencies
      .filter(dist => BATTLE_BOARD_HEXES.includes(hex + dist))
      .map(dist => hex + dist)]
  })
), {
  36: [2, 3, 4],
  37: [31, 32, 33, 34],
  38: [23, 29, 34],
  39: [2, 7, 13, 18],
  40: [18, 25, 31],
  41: [4, 10, 17, 23]
}))

export class BattleBoard {
  readonly terrain: Terrain
  readonly elevations: Record<number, number>
  readonly hazards: Record<number, Hazard>
  readonly edgeHazards: Record<number, Record<number, EdgeHazard>>

  constructor(terrain: Terrain, props: BattleBoardProps) {
    this.terrain = terrain
    this.elevations = props.elevations ?? {}
    this.hazards = props.hazards ?? {}
    this.edgeHazards = props.edgeHazards ?? {}
  }

  getElevation(hex: number): number {
    return this.elevations[hex] ?? 0
  }

  getHazard(hex: number): Hazard {
    return this.hazards[hex] ?? Hazard.NONE
  }

  getEdgeHazards(upper: number): Record<number, EdgeHazard> {
    return this.edgeHazards[upper] ?? {}
  }

  getEdgeHazard(lower: number, upper: number): EdgeHazard {
    return this.edgeHazards[upper]?.[lower] ?? EdgeHazard.NONE
  }
}

function propForHexes<PropType>(hexes: number[], prop: PropType): Record<number, PropType> {
  return Object.fromEntries(hexes.map(hex => [hex, prop]))
}

export const BATTLE_BOARDS: Record<Terrain, BattleBoard> = {
  [Terrain.PLAINS]: new BattleBoard(Terrain.PLAINS, {}),
  [Terrain.MARSH]: new BattleBoard(Terrain.MARSH, {
    hazards: propForHexes([8, 16, 18, 20, 27, 29], Hazard.BOG)
  }),
  [Terrain.WOODS]: new BattleBoard(Terrain.WOODS, {
    hazards: propForHexes([3, 16, 18, 20, 34], Hazard.TREE)
  }),
  [Terrain.HILLS]: new BattleBoard(Terrain.HILLS, {
    elevations: propForHexes([2, 16, 19, 28, 32], 1),
    hazards: propForHexes([14, 17, 27], Hazard.TREE),
    edgeHazards: {
      2: propForHexes([3, 7, 8], EdgeHazard.SLOPE),
      16: propForHexes([9, 10, 15, 21, 22], EdgeHazard.SLOPE),
      19: propForHexes([13, 14, 18, 20, 25, 26], EdgeHazard.SLOPE),
      28: propForHexes([21, 22, 27, 29, 33, 34], EdgeHazard.SLOPE),
      32: propForHexes([31, 26, 27, 33], EdgeHazard.SLOPE)
    }
  }),
  [Terrain.DESERT]: new BattleBoard(Terrain.DESERT, {
    elevations: propForHexes([2, 3, 4, 8, 9, 15, 25, 26, 31, 29, 34], 1),
    hazards: propForHexes([2, 3, 4, 8, 9, 15, 25, 26, 31, 29, 34], Hazard.SAND),
    edgeHazards: {
      8: propForHexes([14], EdgeHazard.DUNE),
      9: propForHexes([10, 16], EdgeHazard.DUNE),
      15: {
        ...propForHexes([14, 16], EdgeHazard.DUNE),
        ...propForHexes([20, 21], EdgeHazard.CLIFF)
      },
      25: propForHexes([18, 19], EdgeHazard.DUNE),
      26: {
        ...propForHexes([19, 20, 27], EdgeHazard.DUNE),
        ...propForHexes([32], EdgeHazard.CLIFF)
      },
      29: {
        ...propForHexes([23, 28], EdgeHazard.DUNE),
        ...propForHexes([22], EdgeHazard.CLIFF)
      },
      34: propForHexes([28, 33], EdgeHazard.DUNE)
    }
  }),
  [Terrain.SWAMP]: new BattleBoard(Terrain.SWAMP, {
    hazards: {
      ...propForHexes([7, 17, 21, 26, 34], Hazard.BOG),
      ...propForHexes([9, 14, 27], Hazard.TREE)
    }
  }),
  [Terrain.MOUNTAINS]: new BattleBoard(Terrain.MOUNTAINS, {
    elevations: {
      ...propForHexes([3, 8, 9, 10, 13, 14, 16, 21, 23, 26, 31, 33], 1),
      ...propForHexes([2, 4, 7, 15, 17, 32], 2)
    },
    hazards: propForHexes([15], Hazard.VOLCANO),
    edgeHazards: {
      2: propForHexes([3, 8], EdgeHazard.SLOPE),
      4: propForHexes([3, 9, 10], EdgeHazard.SLOPE),
      7: propForHexes([8, 13, 14], EdgeHazard.SLOPE),
      13: propForHexes([18, 19], EdgeHazard.SLOPE),
      14: propForHexes([19, 20], EdgeHazard.SLOPE),
      15: {
        ...propForHexes([8, 9, 14, 16, 21], EdgeHazard.SLOPE),
        ...propForHexes([20], EdgeHazard.CLIFF)
      },
      16: propForHexes([22], EdgeHazard.SLOPE),
      17: {
        ...propForHexes([10, 16, 23], EdgeHazard.SLOPE),
        ...propForHexes([22], EdgeHazard.CLIFF)
      },
      21: propForHexes([20, 22, 27, 28], EdgeHazard.SLOPE),
      23: propForHexes([22, 29], EdgeHazard.SLOPE),
      26: propForHexes([19, 20, 25, 27], EdgeHazard.SLOPE),
      31: propForHexes([25], EdgeHazard.SLOPE),
      32: {
        ...propForHexes([26, 31, 33], EdgeHazard.SLOPE),
        ...propForHexes([27], EdgeHazard.CLIFF)
      },
      33: propForHexes([27, 28, 34], EdgeHazard.SLOPE)
    }
  }),
  [Terrain.TUNDRA]: new BattleBoard(Terrain.TUNDRA, {
    hazards: propForHexes([7, 9, 14, 17, 21, 26, 27, 29, 31], Hazard.DRIFT)
  }),
  [Terrain.BRUSH]: new BattleBoard(Terrain.BRUSH, {
    hazards: propForHexes([4, 8, 14, 16, 18, 26, 28, 34], Hazard.BRAMBLE)
  }),
  [Terrain.JUNGLE]: new BattleBoard(Terrain.JUNGLE, {
    hazards: {
      ...propForHexes([4, 7, 15, 20, 22, 25, 33], Hazard.BRAMBLE),
      ...propForHexes([10, 13, 21], Hazard.TREE)
    }
  }),
  [Terrain.TOWER]: new BattleBoard(Terrain.TOWER, {
    elevations: {
      ...propForHexes([8, 9, 14, 16, 20, 21], 1),
      ...propForHexes([15], 2)
    },
    edgeHazards: {
      8: propForHexes([2, 3, 7], EdgeHazard.WALL),
      9: propForHexes([3, 4, 10], EdgeHazard.WALL),
      14: propForHexes([7, 13, 19], EdgeHazard.WALL),
      15: propForHexes([8, 9, 14, 16, 20, 21], EdgeHazard.WALL),
      16: propForHexes([10, 17, 22], EdgeHazard.WALL),
      20: propForHexes([19, 26, 27], EdgeHazard.WALL),
      21: propForHexes([22, 27, 28], EdgeHazard.WALL)
    }
  })
}
