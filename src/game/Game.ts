import { Clock } from "./Clock";
import { Tank } from "./Tank";
import { BALANCE } from "./balance";
import { Fish } from "../entities/Fish";
import { Food } from "../entities/Food";
import { FeedingSystem } from "../systems/FeedingSystem";
import { SPECIES, rollVariant } from "../entities/species";
import type { VariantConfig } from "../entities/species";

export interface GameOptions {
  /** 개발용: 구피의 모든 변이를 한 마리씩 풀어 놓는다. */
  showcase?: boolean;
}

/** 전체 게임 상태와 시간 흐름 */
export class Game {
  readonly clock = new Clock();
  readonly tank = new Tank();
  readonly fishes: Fish[] = [];
  readonly foods: Food[] = [];
  private readonly feeding = new FeedingSystem();
  /** 연출용 누적 현실 시간(초) */
  elapsed = 0;

  constructor(options: GameOptions = {}) {
    const guppy = SPECIES.guppy;
    const variants = options.showcase
      ? guppy.variants
      : Array.from({ length: BALANCE.startGuppyCount }, () => rollVariant(guppy));
    for (const variant of variants) this.addGuppy(variant);
  }

  private addGuppy(variant: VariantConfig): void {
    const t = this.tank;
    const range = t.zoneRange("middle");
    const x = t.wallMargin + 40 + Math.random() * (t.width - t.wallMargin * 2 - 80);
    const y = range.top + Math.random() * (range.bottom - range.top);
    this.fishes.push(new Fish(SPECIES.guppy, variant, variant.name, x, y));
  }

  /** 수면 x 위치에 먹이 한 꼬집을 뿌린다. 최대 개수를 넘으면 오래된 것부터 지운다. */
  dropFood(x: number): void {
    const t = this.tank;
    const { flakesPerPinch, pinchSpreadPx, maxFlakes } = BALANCE.feeding;
    for (let i = 0; i < flakesPerPinch; i++) {
      const fx = x + (Math.random() * 2 - 1) * pinchSpreadPx;
      const clamped = Math.min(t.width - t.wallMargin, Math.max(t.wallMargin, fx));
      this.foods.push(new Food(clamped, t.surfaceY));
    }
    // 바닥에 가라앉은 것부터, 그다음 떠 있는 것 순으로 오래된 것을 지운다
    for (const state of ["settled", "sinking"] as const) {
      for (let i = 0; i < this.foods.length && this.foods.length > maxFlakes; ) {
        if (this.foods[i].state === state) this.foods.splice(i, 1);
        else i++;
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.clock.update(dt);
    for (const food of this.foods) food.update(dt, this.tank);
    for (let i = this.foods.length - 1; i >= 0; i--) {
      if (this.foods[i].expired) this.foods.splice(i, 1);
    }
    this.feeding.update(dt, this.fishes, this.foods, this.tank);
    for (const fish of this.fishes) fish.update(dt, this.tank);
  }
}
