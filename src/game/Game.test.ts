import { describe, expect, it } from "vitest";
import { Game } from "./Game";
import { BALANCE } from "./balance";
import { SPECIES } from "../entities/species";

describe("Game 시작 상태", () => {
  it("구피 2마리로 시작한다", () => {
    const game = new Game();
    expect(BALANCE.startGuppyCount).toBe(2);
    expect(game.fishes).toHaveLength(2);
    for (const fish of game.fishes) expect(fish.species).toBe(SPECIES.guppy);
  });

  it("showcase 모드에서는 변이 수만큼 풀어 놓는다", () => {
    const game = new Game({ showcase: true });
    expect(game.fishes).toHaveLength(SPECIES.guppy.variants.length);
  });
});
