import { describe, expect, it } from "vitest";
import { Food } from "./Food";
import { Tank } from "../game/Tank";
import { BALANCE, VIEW } from "../game/balance";

describe("Food", () => {
  it("가라앉는 동안 초당 flakeSinkCm 만큼 내려간다", () => {
    const food = new Food(100, 50);
    food.update(1, new Tank());
    expect(food.y).toBeCloseTo(50 + BALANCE.feeding.flakeSinkCm * VIEW.pxPerCm);
    expect(food.state).toBe("sinking");
    expect(food.opacity).toBe(1);
  });

  it("바닥에 닿으면 settled가 되어 고정된다", () => {
    const tank = new Tank();
    const food = new Food(100, tank.floorY - 5);
    food.update(1, tank);
    expect(food.state).toBe("settled");
    expect(food.y).toBe(tank.floorY - 2);
    food.update(1, tank);
    expect(food.y).toBe(tank.floorY - 2);
  });

  it("settled 후 서서히 흐려지다가 사라진다", () => {
    const tank = new Tank();
    const food = new Food(100, tank.floorY - 5);
    food.update(1, tank);
    food.update(37.5, tank); // 게임 3시간
    expect(food.opacity).toBeCloseTo(0.5);
    expect(food.expired).toBe(false);
    food.update(37.5, tank);
    expect(food.expired).toBe(true);
    expect(food.opacity).toBe(0);
  });

  it("가로 흔들림은 ±2px 이내이고 spin은 sinking 중에만 증가한다", () => {
    const tank = new Tank();
    const food = new Food(100, 50);
    for (let i = 0; i < 20; i++) {
      food.update(0.1, tank);
      expect(Math.abs(food.x - 100)).toBeLessThanOrEqual(2);
    }
    expect(food.spin).toBeGreaterThan(0);
    const f2 = new Food(100, tank.floorY - 5);
    f2.update(1, tank);
    const s = f2.spin;
    f2.update(1, tank);
    expect(f2.spin).toBe(s);
  });
});
