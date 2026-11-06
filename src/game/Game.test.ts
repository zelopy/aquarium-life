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

  it("시작 물고기의 포만감은 60이다", () => {
    for (const fish of new Game().fishes) expect(fish.fullness).toBe(60);
  });
});

describe("Game.dropFood", () => {
  it("한 꼬집은 수면에서 4개가 20px 안으로 퍼진다", () => {
    const game = new Game();
    game.dropFood(480);
    expect(game.foods).toHaveLength(4);
    for (const f of game.foods) {
      expect(f.y).toBe(game.tank.surfaceY);
      expect(f.x).toBeGreaterThanOrEqual(460);
      expect(f.x).toBeLessThanOrEqual(500);
    }
  });

  it("벽 여백 안쪽으로 보정한다", () => {
    const game = new Game();
    game.dropFood(0);
    game.dropFood(960);
    const { wallMargin, width } = game.tank;
    expect(game.foods).toHaveLength(8);
    for (const f of game.foods) {
      expect(f.x).toBeGreaterThanOrEqual(wallMargin);
      expect(f.x).toBeLessThanOrEqual(width - wallMargin);
    }
  });

  it("최대 40개를 넘지 않는다", () => {
    const game = new Game();
    for (let i = 0; i < 11; i++) game.dropFood(480);
    expect(game.foods).toHaveLength(BALANCE.feeding.maxFlakes);
  });

  it("가득 차면 가라앉은(settled) 것부터 지운다", () => {
    const game = new Game();
    for (let i = 0; i < 10; i++) game.dropFood(480);
    const oldestSinking = game.foods.slice(0, 4);
    const settled = game.foods.slice(4, 8);
    for (const f of settled) f.state = "settled";
    game.dropFood(480);
    expect(game.foods).toHaveLength(BALANCE.feeding.maxFlakes);
    for (const f of settled) expect(game.foods).not.toContain(f);
    for (const f of oldestSinking) expect(game.foods).toContain(f);
  });

  it("settled가 없으면 오래된 떠 있는 것부터 지운다", () => {
    const game = new Game();
    for (let i = 0; i < 10; i++) game.dropFood(480);
    const oldest = game.foods.slice(0, 4);
    game.dropFood(480);
    const newest = game.foods.slice(-4);
    expect(game.foods).toHaveLength(BALANCE.feeding.maxFlakes);
    for (const f of oldest) expect(game.foods).not.toContain(f);
    for (const f of newest) expect(game.foods).toContain(f);
  });

  it("settled 알갱이는 게임 6시간이 지나면 사라진다", () => {
    const game = new Game();
    game.dropFood(480);
    for (const f of game.foods) {
      f.state = "settled";
      f.settledHoursLeft = 0.001;
    }
    game.update(1);
    expect(game.foods).toHaveLength(0);
  });

  it("멀리 뿌린 먹이도 물고기가 쫓아가 먹는다", () => {
    const game = new Game();
    game.fishes[0].x = 740;
    game.fishes[0].y = 250;
    game.fishes[1].x = 800;
    game.fishes[1].y = 250;
    for (const f of game.fishes) f.fullness = 50;
    game.dropFood(100);
    for (let i = 0; i < 60 * 32; i++) game.update(1 / 60);
    expect(game.foods.length).toBeLessThanOrEqual(2);
  });
});
