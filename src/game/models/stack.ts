import { remove, sum } from "lodash-es"
import { assert } from "@/utils/assert"
import { CREATURE_DATA, CreatureType, MUSTER_DATA } from "./creature"
import { HexEdge, Terrain } from "./masterboard"
import { Moveable } from "./moveable"
import { PlayerId } from "./player"

let stackIdCounter = 0

export type StackRef = number

export interface MusterBasis {
  creature: CreatureType
  count: number
}
// One recruitable creature and the ways it can currently be mustered.
export interface MusterPossibility {
  creature: CreatureType
  bases: MusterBasis[]
}
// A recruit that has actually been chosen: the creature and the single basis used to muster it.
export interface MusterChoice {
  creature: CreatureType
  basis: MusterBasis
}

export interface Stack extends Moveable {
  readonly owner: PlayerId
  readonly creatures: CreatureType[]
  readonly marker: number
  readonly recruits: Record<number, MusterChoice>
  readonly id: number
  readonly createdRound: number

  attackEdge: HexEdge | undefined
  currentMuster: MusterChoice | undefined
}

export type CreateStackOptions = Pick<Stack, "owner" | "marker" | "createdRound" | "hex"> &
  Partial<Pick<Stack, "creatures">>

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Stack {
  export function create(options: CreateStackOptions): Stack {
    return {
      owner: options.owner,
      creatures: options.creatures ?? [
        CreatureType.TITAN,
        CreatureType.ANGEL,
        CreatureType.CENTAUR,
        CreatureType.CENTAUR,
        CreatureType.OGRE,
        CreatureType.OGRE,
        CreatureType.GARGOYLE,
        CreatureType.GARGOYLE,
      ],
      marker: options.marker,
      recruits: {},
      id: stackIdCounter++,
      createdRound: options.createdRound,
      initialHex: options.hex,
      hex: options.hex,
      attackEdge: undefined,
      currentMuster: undefined,
    }
  }

  // Called on hydration so ids assigned to newly-created stacks never collide with ids
  // already present in a restored save.
  export function reserveIdsThrough(maxUsedId: number): void {
    stackIdCounter = Math.max(stackIdCounter, maxUsedId + 1)
  }

  export function isFull(stack: Stack): boolean {
    return stack.creatures.length >= 7
  }

  export function canMuster(stack: Stack): boolean {
    return Moveable.hasMoved(stack) && !isFull(stack)
  }

  // `splitting` is a parameter rather than state on `Stack` because the pick is reversible until submitted.
  export function isValidSplit(stack: Stack, splitting: number[], firstRound?: boolean): boolean {
    if (firstRound ?? false) {
      if (splitting.length !== 4) {
        return false
      }
      const splitLords: number = sum(splitting.map(index => CREATURE_DATA[stack.creatures[index]].lord))
      if (splitLords !== 1) {
        return false
      }
    }
    const remaining = stack.creatures.length - splitting.length
    return splitting.length === 0 || (splitting.length >= 2 && remaining >= 2)
  }

  export function getSplittingCreatures(stack: Stack, splitting: number[]): CreatureType[] {
    return stack.creatures.filter((_, index) => splitting.includes(index))
  }

  export function getStayingCreatures(stack: Stack, splitting: number[]): CreatureType[] {
    return stack.creatures.filter((_, index) => !splitting.includes(index))
  }

  export function musterable(stack: Stack, terrain: Terrain): MusterPossibility[] {
    const creatureCounts = stack.creatures.reduce(
      (acc: Map<CreatureType, number>, creature: CreatureType) => acc.set(creature, (acc.get(creature) ?? 0) + 1),
      new Map(),
    )
    const terrainData = MUSTER_DATA[terrain]
    const possibilities: MusterPossibility[] = []
    if (terrain === Terrain.TOWER) {
      possibilities.push(
        ...terrainData.map(([, creature]): MusterPossibility => ({ creature, bases: [{ creature, count: 0 }] })),
      )
      const creaturePossibilities: MusterBasis[] = []
      creatureCounts.forEach((count, type) => {
        if (count >= 3) {
          creaturePossibilities.push({ creature: type, count: 3 })
        }
      })
      possibilities.push({ creature: CreatureType.GUARDIAN, bases: creaturePossibilities })
      possibilities.push({
        creature: CreatureType.WARLOCK,
        bases: creatureCounts.get(CreatureType.TITAN) !== undefined ? [{ creature: CreatureType.TITAN, count: 1 }] : [],
      })
    } else {
      for (let i = 0; i < terrainData.length; ++i) {
        const [req, type] = terrainData[i]
        const creaturePossibilities: MusterBasis[] = []
        if (req !== null) {
          const previousCreature = terrainData[i - 1][1]
          if ((creatureCounts.get(previousCreature) ?? 0) >= req) {
            creaturePossibilities.push({ creature: previousCreature, count: req })
          }
        }
        for (let k = i; k < terrainData.length; ++k) {
          const [, advancedType] = terrainData[k]
          if (creatureCounts.get(advancedType) !== undefined) {
            creaturePossibilities.push({ creature: advancedType, count: 1 })
          }
        }
        possibilities.push({ creature: type, bases: creaturePossibilities })
      }
    }
    return possibilities
  }

  export function finalizeSplit(stack: Stack, splitting: number[], marker: number, round: number): Stack {
    assert(isValidSplit(stack, splitting), "Invalid split")
    assert(marker >= 0, "Invalid marker")
    const creatures = getSplittingCreatures(stack, splitting)
    remove(stack.creatures, (_, index) => splitting.includes(index))
    return create({ owner: stack.owner, hex: stack.hex, marker, createdRound: round, creatures })
  }
}
