import { Clock } from "./Clock";
import { Tank } from "./Tank";
import { Fish } from "../entities/Fish";
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
  /** 연출용 누적 현실 시간(초) */
  elapsed = 0;

  constructor(options: GameOptions = {}) {
    const guppy = SPECIES.guppy;
    const variants = options.showcase ? guppy.variants : [rollVariant(guppy)];
    for (const variant of variants) this.addGuppy(variant);
  }

  private addGuppy(variant: VariantConfig): void {
    const t = this.tank;
    const range = t.zoneRange("middle");
    const x = t.wallMargin + 40 + Math.random() * (t.width - t.wallMargin * 2 - 80);
    const y = range.top + Math.random() * (range.bottom - range.top);
    this.fishes.push(new Fish(SPECIES.guppy, variant, variant.name, x, y));
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.clock.update(dt);
    for (const fish of this.fishes) fish.update(dt, this.tank);
  }
}
