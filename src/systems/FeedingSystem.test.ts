import { describe, expect, it } from "vitest";
import { Fish } from "../entities/Fish";
import { Food } from "../entities/Food";
import { SPECIES } from "../entities/species";
import { Tank } from "../game/Tank";
import { FeedingSystem } from "./FeedingSystem";

const makeFish = (x: number, y: number) =>
  new Fish(SPECIES.guppy, SPECIES.guppy.variants[0], "테스트", x, y);

describe("FeedingSystem", () => {
  const tank = new Tank();
  const feeding = new FeedingSystem();

  it("포만감은 시간이 지나면 줄고 0 아래로 내려가지 않는다", () => {
    const fish = makeFish(400, 300);
    feeding.update(300, [fish], [], tank);
    expect(fish.fullness).toBe(0);
    fish.fullness = 100;
    feeding.update(150, [fish], [], tank);
    expect(fish.fullness).toBeCloseTo(50);
  });

  it("배고픈 물고기는 가까운 알갱이를 쫓는다", () => {
    const fish = makeFish(400, 300);
    const foods = [new Food(700, 300), new Food(350, 300)];
    feeding.update(1 / 60, [fish], foods, tank);
    expect(fish.chasing).toBe(true);
    const startX = fish.x;
    for (let i = 0; i < 30; i++) fish.update(1 / 60, tank);
    expect(fish.x).toBeLessThan(startX);
  });

  it("입 위치의 알갱이를 먹고 포만감이 늘어난다", () => {
    const fish = makeFish(400, 300);
    const m = fish.mouth;
    const foods = [new Food(m.x, m.y)];
    const before = fish.fullness;
    feeding.update(0, [fish], foods, tank);
    expect(foods.length).toBe(0);
    expect(fish.fullness).toBe(before + 8);
  });

  it("문턱 바로 아래에서 먹으면 문턱을 넘어 멈춘다", () => {
    const fish = makeFish(400, 300);
    fish.fullness = 89;
    const foods = [new Food(fish.mouth.x, fish.mouth.y), new Food(fish.mouth.x, fish.mouth.y)];
    feeding.update(0, [fish], foods, tank);
    feeding.update(0, [fish], foods, tank);
    expect(fish.fullness).toBe(97);
    expect(foods.length).toBe(1);
  });

  it("배부르면 알갱이가 있어도 쫓지 않는다", () => {
    const fish = makeFish(400, 300);
    fish.fullness = 90;
    const foods = [new Food(450, 300)];
    feeding.update(0, [fish], foods, tank);
    expect(fish.chasing).toBe(false);
    expect(foods.length).toBe(1);
  });

  it("쫓던 중 배가 부르면 쫓기를 멈춘다", () => {
    const fish = makeFish(400, 300);
    const foods = [new Food(600, 300)];
    feeding.update(0, [fish], foods, tank);
    expect(fish.chasing).toBe(true);
    fish.fullness = 90;
    feeding.update(0, [fish], foods, tank);
    expect(fish.chasing).toBe(false);
  });

  it("바닥에 내려앉은 알갱이는 쫓지 않는다", () => {
    const fish = makeFish(400, 300);
    const food = new Food(450, 300);
    food.state = "settled";
    feeding.update(0, [fish], [food], tank);
    expect(fish.chasing).toBe(false);
  });

  it("바로 위의 알갱이를 시뮬레이션으로 먹는다", () => {
    const fish = makeFish(400, 300);
    const foods = [new Food(400, 200)];
    const dt = 1 / 60;
    for (let i = 0; i < 20 * 60 && foods.length > 0; i++) {
      for (const f of foods) f.update(dt, tank);
      feeding.update(dt, [fish], foods, tank);
      fish.update(dt, tank);
    }
    expect(foods.length).toBe(0);
  });

  it("두 마리가 한 알갱이를 노리면 한 마리만 먹는다", () => {
    const a = makeFish(300, 250);
    const b = makeFish(600, 250);
    const foods = [new Food(450, 150)];
    const dt = 1 / 60;
    for (let i = 0; i < 20 * 60 && foods.length > 0; i++) {
      for (const f of foods) f.update(dt, tank);
      feeding.update(dt, [a, b], foods, tank);
      a.update(dt, tank);
      b.update(dt, tank);
    }
    expect(foods.length).toBe(0);
    // 둘 다 같은 만큼 줄어드므로 차이가 정확히 알갱이 하나(+8)여야 한다
    expect(Math.abs(a.fullness - b.fullness)).toBeCloseTo(8);
    feeding.update(dt, [a, b], foods, tank);
    expect(a.chasing).toBe(false);
    expect(b.chasing).toBe(false);
  });

  it("바로 아래로 가라앉는 알갱이도 따라잡아 먹는다", () => {
    const fish = makeFish(400, 200);
    const food = new Food(400, 260);
    const foods = [food];
    for (let i = 0; i < 60 * 20 && foods.length > 0 && food.state === "sinking"; i++) {
      food.update(1 / 60, tank);
      feeding.update(1 / 60, [fish], foods, tank);
      fish.update(1 / 60, tank);
    }
    expect(foods.length).toBe(0);
  });
});
