import { assert } from "@/utils";

const div = (a, b) => Math.floor(a / b);
const mod = (a, b) => ((a % b) + b) % b;

enum MovementRule {
    ARROW,
    SQUARE,
    CIRCLE,
}

enum Terrain {
    PLAINS,
    MARSH,
    WOODS,
    HILLS,
    DESERT,
    SWAMP,
    MOUNTAINS,
    TUNDRA,
    BRUSH,
    JUNGLE,
    TOWER,
}

// Hex edges, starting with the first after the ID # going clockwise
enum HexEdge {
    FIRST,
    SECOND,
    THIRD,
}

function getTerrainPair(terrain: Terrain): Terrain {
    if (terrain >= Terrain.BRUSH) {
        return terrain;
    }
    return terrain.valueOf() ^ 1;
}

/**
 * Return the paired terrain if the number % 2 == 1.
 */
function maybeGetPair(terrain: Terrain, maybe: number) {
    return maybe % 2 === 1 ? getTerrainPair(terrain) : terrain;
}

interface MasterboardEdge {
    rule: MovementRule;
    hex:  MasterboardHex;
    hexEdge: HexEdge;
}

class MasterboardHex implements Hex {
    readonly id: number;
    readonly terrain: Terrain;
    readonly edges: MasterboardEdge[];

    constructor(id: number, terrain: Terrain) {
        this.id = id;
        this.terrain = terrain;
        this.edges = [];
    }

    getMovement(initial?: boolean): MasterboardEdge[] {
        const options = this.edges.filter(edge => edge.rule == MovementRule.ARROW);
        if (initial) {
            if (this.edges.some(edge => edge.rule == MovementRule.SQUARE)) {
                return this.edges.filter(edge => edge.rule == MovementRule.SQUARE);
            } else {
                options.push(...this.edges.filter(edge => edge.rule == MovementRule.CIRCLE));
            }
        }
        return options;
    }

    addEdge(hex: MasterboardHex, hexEdge: HexEdge, rule: MovementRule) {
        assert(this.edges.length < 3, "Cannot add edge to hex with 3 edges");
        this.edges.push({ hex, rule, hexEdge });
    }
}

export class Masterboard {
    hexes: Map<number, MasterboardHex>;

    constructor() {
        this.hexes = new Map();

        // Construct nodes

        for (let i = 100; i <= 600; i += 100) {
            this.hexes[i] = new MasterboardHex(i, Terrain.TOWER);
        }
        for (let i = 1000, terrain = Terrain.MOUNTAINS;
             i <= 6000;
             i += 1000, terrain = getTerrainPair(terrain)) {
            this.hexes[i] = new MasterboardHex(i, terrain)
        }

        const middleOrdering = [
            Terrain.PLAINS,
            Terrain.WOODS,
            Terrain.BRUSH,
            Terrain.HILLS,
            Terrain.JUNGLE,
            Terrain.PLAINS,
            Terrain.DESERT,
        ];
        for (let i = 1; i <= 42; ++i) {
            this.hexes[i] = new MasterboardHex(i, maybeGetPair(
                middleOrdering[i % 7], div((i - 1), 7)
            ));
        }

        const bottomOrdering = [
            Terrain.PLAINS,
            Terrain.BRUSH,
            Terrain.MARSH,
            undefined,
            Terrain.PLAINS,
            Terrain.BRUSH,
            undefined,
        ];
        const bottomTriples = [
            Terrain.JUNGLE,
            Terrain.SWAMP,
            Terrain.DESERT,
        ]
        for (let i = 101; i <= 142; ++i) {
            const localIndex = (i - 101) % 7;
            let sector = div((i - 101), 7);
            if (bottomOrdering[localIndex] !== undefined) {
                this.hexes[i] = new MasterboardHex(i, maybeGetPair(
                    bottomOrdering[localIndex], sector
                ));
            } else {
                if (localIndex === 6) { sector += 2; }
                const terrain = bottomTriples[sector % 3];
                this.hexes[i] = new MasterboardHex(i, terrain);
            }
        }

        // Construct edges

        for (let id = 0; id <= 5; id += 1) {
            const tower = this.hexes[(id + 1) * 100];
            const towerEdges: [HexEdge, number][] = [
                [HexEdge.SECOND, 101 + (id * 7)],
                [HexEdge.FIRST, 3 + (id * 7)],
                [HexEdge.THIRD, (41 + (id * 7)) % 42]
            ];
            towerEdges.forEach(([edge, i]) => tower.addEdge(
                this.hexes[i], edge, MovementRule.ARROW
            ));

            const upperHex = this.hexes[(id + 1) * 1000];
            upperHex.addEdge(this.hexes[(mod((id - 1), 6) + 1) * 1000], HexEdge.FIRST, MovementRule.ARROW);
            upperHex.addEdge(this.hexes[(mod((id + 1), 6) + 1) * 1000], HexEdge.THIRD, MovementRule.ARROW);
            upperHex.addEdge(this.hexes[id * 7 + 1], HexEdge.SECOND, MovementRule.SQUARE);
        }

        const middleHexEdges = [
            HexEdge.THIRD,
            HexEdge.SECOND,
            HexEdge.THIRD,
            HexEdge.THIRD,
            HexEdge.FIRST,
            HexEdge.SECOND,
            HexEdge.FIRST
        ];
        const bottomHexEdges = [
            HexEdge.THIRD,
            HexEdge.FIRST,
            HexEdge.THIRD,
            HexEdge.THIRD,
            HexEdge.FIRST,
            HexEdge.THIRD,
            HexEdge.FIRST,
        ];
        for (let id = 1; id <= 42; ++id) {
            const localIndex = (id - 1) % 7;
            this.hexes[id].addEdge(this.hexes[id % 42 + 1], middleHexEdges[localIndex], MovementRule.ARROW);
            this.hexes[id + 100].addEdge(this.hexes[id % 42 + 101], bottomHexEdges[localIndex], MovementRule.ARROW);
        }

        for (let sector = 1; sector <= 6; sector++) {
            { // Middle area
                const baseId = (sector - 1) * 7 + 1;
                this.hexes[baseId + 0].addEdge(this.hexes[sector * 1000], HexEdge.SECOND, MovementRule.CIRCLE);
                this.hexes[baseId + 1].addEdge(this.hexes[(baseId + 1) % 42 + 5], HexEdge.THIRD, MovementRule.CIRCLE);
                this.hexes[baseId + 2].addEdge(this.hexes[sector * 100], HexEdge.FIRST, MovementRule.CIRCLE);
                this.hexes[baseId + 3].addEdge(this.hexes[baseId + 3 + 99], HexEdge.SECOND, MovementRule.SQUARE);
                this.hexes[baseId + 4].addEdge(this.hexes[baseId + 4 + 101], HexEdge.SECOND, MovementRule.SQUARE);
                this.hexes[baseId + 5].addEdge(this.hexes[((sector % 6) + 1) * 100], HexEdge.THIRD, MovementRule.CIRCLE);
                this.hexes[baseId + 6].addEdge(this.hexes[baseId + 6 - 5], HexEdge.FIRST, MovementRule.CIRCLE);
            }
            { // Bottom area
                const baseId = (sector - 1) * 7 + 101;
                this.hexes[baseId + 0].addEdge(this.hexes[sector * 100], HexEdge.SECOND, MovementRule.CIRCLE);
                this.hexes[baseId + 2].addEdge(this.hexes[baseId + 2 - 99], HexEdge.SECOND, MovementRule.CIRCLE);
                this.hexes[baseId + 5].addEdge(this.hexes[baseId + 5 - 101], HexEdge.SECOND, MovementRule.CIRCLE);
            }
        }

        const nodes = Object.values(this.hexes).map(hex => ({ id: hex.id, name: Terrain[hex.terrain] }));
        const links = Object.values(this.hexes).map(hex => hex.edges.map(edge => ({
            source_id: hex.id,
            target_id: edge.hex.id,
        }))).flat();
        console.log(JSON.stringify({ nodes, links }, undefined, 4));
    }
}