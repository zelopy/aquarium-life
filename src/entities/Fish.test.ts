import { describe, expect, it } from "vitest";
import { Tank } from "../game/Tank";
import { SPECIES } from "./species";
import { Fish } from "./Fish";

const makeFish = () => new Fish(SPECIES.guppy, SPECIES.guppy.variants[0], "테스트", 400, 300);

describe("Fish 포만감·쫓기", () => {
  it("생성 시 포만감은 startFullness", () => {
    expect(makeFish().fullness).toBe(60);
  });

  it("입은 바라보는 방향 몸 끝에 있다", () => {
    const fish = makeFish();
    fish.facing = 1;
    expect(fish.mouth.x).toBe(400 + 22);
    fish.facing = -1;
    expect(fish.mouth.x).toBe(400 - 22);
    expect(fish.mouth.y).toBe(300);
  });

  it("chase 하면 목표 방향으로 움직인다", () => {
    const tank = new Tank();
    const fish = makeFish();
    fish.chase(500, 300);
    expect(fish.chasing).toBe(true);
    for (let i = 0; i < 120; i++) fish.update(1 / 60, tank);
    expect(fish.x).toBeGreaterThan(400);
  });

  it("쫓는 중에는 재선정 없이 입이 목표 근처에 머문다", () => {
    const tank = new Tank();
    const fish = makeFish();
    for (let i = 0; i < 600; i++) {
      fish.chase(500, 300);
      fish.update(1 / 60, tank);
    }
    expect(fish.chasing).toBe(true);
    expect(Math.hypot(fish.mouth.x - 500, fish.mouth.y - 300)).toBeLessThan(10);
  });

  it("뒤쪽에 있는 먹이도 몸을 돌려 입으로 닿는다", () => {
    const tank = new Tank();
    const fish = makeFish();
    for (let i = 0; i < 600; i++) {
      fish.chase(370, 330);
      fish.update(1 / 60, tank);
    }
    expect(Math.hypot(fish.mouth.x - 370, fish.mouth.y - 330)).toBeLessThan(10);
  });

  it("바로 위에서 내려오는 먹이에도 방향이 떨리지 않는다", () => {
    const tank = new Tank();
    const fish = makeFish();
    let flakeY = 200;
    let flips = 0;
    let prevSign = Math.sign(fish.facing);
    let reached = false;
    for (let i = 0; i < 20 * 60; i++) {
      fish.chase(400, flakeY);
      fish.update(1 / 60, tank);
      flakeY += 16.5 / 60;
      const sign = Math.sign(fish.facing);
      if (sign !== prevSign) flips++;
      prevSign = sign;
      if (Math.hypot(fish.mouth.x - 400, fish.mouth.y - flakeY) < 8) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
    expect(flips).toBeLessThanOrEqual(1);
    expect(Math.abs(fish.facing)).toBeGreaterThan(0.8);
  });

  it("stopChasing 하면 쫓기가 끝난다", () => {
    const tank = new Tank();
    const fish = makeFish();
    fish.chase(500, 300);
    fish.stopChasing(tank);
    expect(fish.chasing).toBe(false);
  });
});
