import { describe, expect, it } from "vitest"
import { PlayerId } from "~/models/player"
import { Random } from "~/models/random"
import { TitanGame } from "./index"

describe("TitanGame", () => {
  it("assigns player colors via the injected Random instead of a fixed order", () => {
    const reverse: Random = {
      shuffle: collection => [...collection].reverse()
    }

    const game = new TitanGame(2, reverse)

    expect(game.players.map(player => player.id)).toEqual([PlayerId.BLACK, PlayerId.YELLOW])
  })
})
