// 먹이 주기와 섭식
import { BALANCE } from "../game/balance";
import { gameHours } from "../game/Clock";
import type { Tank } from "../game/Tank";
import type { Fish } from "../entities/Fish";
import type { Food } from "../entities/Food";

const MAX_FULLNESS = 100;

/** 포만감 감소, 먹이 고르기, 먹기. 상태를 갖지 않는다. */
export class FeedingSystem {
  /** 먹힌 알갱이는 `foods`에서 제자리 제거한다. */
  update(dt: number, fishes: Fish[], foods: Food[], tank: Tank): void {
    const decay = BALANCE.feeding.fullnessDecayPerGameHour * gameHours(dt);
    for (const fish of fishes) {
      fish.fullness = Math.max(0, fish.fullness - decay);

      if (fish.fullness >= BALANCE.feeding.fullThreshold) {
        if (fish.chasing) fish.stopChasing(tank);
        continue;
      }

      const mouth = fish.mouth;
      let nearest = -1;
      let nearestDist = Infinity;
      for (let i = 0; i < foods.length; i++) {
        if (!this.canEat(fish, foods[i])) continue;
        const d = Math.hypot(foods[i].x - mouth.x, foods[i].y - mouth.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }

      if (nearest < 0) {
        if (fish.chasing) fish.stopChasing(tank);
        continue;
      }

      const target = foods[nearest];
      fish.chase(target.x, target.y);
      if (nearestDist <= BALANCE.feeding.eatRadiusPx) {
        foods.splice(nearest, 1);
        fish.fullness = Math.min(MAX_FULLNESS, fish.fullness + BALANCE.feeding.fullnessPerFlake);
      }
    }
  }

  private canEat(fish: Fish, food: Food): boolean {
    return fish.species.diet.includes("flake") && food.state === "sinking";
  }
}
