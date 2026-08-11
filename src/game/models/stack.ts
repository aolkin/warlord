import { range, remove, sum } from "lodash-es"
import { assert } from "@/utils/assert"
import { CREATURE_DATA, CreatureType, MUSTER_DATA } from "./creature"
import { HexEdge, Terrain } from "./masterboard"
import { Moveable } from "./moveable"
import { PlayerId } from "./player"

let stackIdCounter = 0

export type StackRef = number

export type MusterBasis = [CreatureType, number]
// One recruitable creature and the ways it can currently be mustered.
export type MusterPossibility = [CreatureType, MusterBasis[]]
// A recruit that has actually been chosen: the creature and the single basis used to muster it.
export type MusterChoice = [CreatureType, MusterBasis]

export interface Stack extends Moveable {
  readonly owner: PlayerId
  readonly creatures: CreatureType[]
  readonly marker: number
  readonly split: boolean[]
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
      creatures: options.creatures ?? [CreatureType.TITAN, CreatureType.ANGEL,
        CreatureType.CENTAUR, CreatureType.CENTAUR,
        CreatureType.OGRE, CreatureType.OGRE,
        CreatureType.GARGOYLE, CreatureType.GARGOYLE],
      split: range(8).map(() => false),
      marker: options.marker,
      recruits: {},
      id: stackIdCounter++,
      createdRound: options.createdRound,
      initialHex: options.hex,
      hex: options.hex,
      attackEdge: undefined,
      currentMuster: undefined
    }
  }

  export function isFull(stack: Stack): boolean {
    return stack.creatures.length >= 7
  }

  export function canMuster(stack: Stack): boolean {
    return Moveable.hasMoved(stack) && !isFull(stack)
  }

  export function isValidSplit(stack: Stack, firstRound?: boolean): boolean {
    const splitCount = getSplittingCreatures(stack).length
    if (firstRound ?? false) {
      if (splitCount !== 4) {
        return false
      }
      const splitLords: number = sum(stack.creatures.map((creature, index) =>
        stack.split[index] && CREATURE_DATA[creature].lord))
      if (splitLords !== 1) {
        return false
      }
    }
    const remaining = stack.creatures.length - splitCount
    return splitCount === 0 || (splitCount >= 2 && remaining >= 2)
  }

  export function getSplittingCreatures(stack: Stack): CreatureType[] {
    return stack.creatures.filter((_, index) => stack.split[index])
  }

  export function getStayingCreatures(stack: Stack): CreatureType[] {
    return stack.creatures.filter((_, index) => !stack.split[index])
  }

  export function musterable(stack: Stack, terrain: Terrain): MusterPossibility[] {
    const creatureCounts = stack.creatures.reduce((acc: Map<CreatureType, number>, creature: CreatureType) =>
      acc.set(creature, (acc.get(creature) ?? 0) + 1), new Map())
    const terrainData = MUSTER_DATA[terrain]
    const possibilities: MusterPossibility[] = []
    if (terrain === Terrain.TOWER) {
      possibilities.push(...terrainData.map(([, creature]) =>
        [creature, [[creature, 0]]] as MusterPossibility))
      const creaturePossibilities: MusterBasis[] = []
      creatureCounts.forEach((count, type) => {
        if (count >= 3) {
          creaturePossibilities.push([type, 3])
        }
      })
      possibilities.push([CreatureType.GUARDIAN, creaturePossibilities])
      possibilities.push([CreatureType.WARLOCK,
        creatureCounts.get(CreatureType.TITAN) !== undefined ? [[CreatureType.TITAN, 1]] : []])
    } else {
      for (let i = 0; i < terrainData.length; ++i) {
        const [req, type] = terrainData[i]
        const creaturePossibilities: MusterBasis[] = []
        if (req !== null) {
          const previousCreature = terrainData[i - 1][1]
          if ((creatureCounts.get(previousCreature) ?? 0) >= req) {
            creaturePossibilities.push([previousCreature, req])
          }
        }
        for (let k = i; k < terrainData.length; ++k) {
          const [, advancedType] = terrainData[k]
          if (creatureCounts.get(advancedType) !== undefined) {
            creaturePossibilities.push([advancedType, 1])
          }
        }
        possibilities.push([type, creaturePossibilities])
      }
    }
    return possibilities
  }

  export function togglePendingSplit(stack: Stack, index: number): void {
    stack.split[index] = !stack.split[index]
  }

  export function finalizeSplit(stack: Stack, marker: number, round: number): Stack {
    assert(isValidSplit(stack), "Invalid split")
    assert(marker >= 0, "Invalid marker")
    const creatures = getSplittingCreatures(stack)
    remove(stack.creatures, (creature, index) => stack.split[index])
    stack.split.fill(false)
    return create({ owner: stack.owner, hex: stack.hex, marker, createdRound: round, creatures })
  }
}
