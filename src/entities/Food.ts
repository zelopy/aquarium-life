// 먹이 (수면 먹이 플레이크)
import { gameHours } from "../game/Clock";
import { BALANCE, VIEW } from "../game/balance";
import type { Tank } from "../game/Tank";

export type FoodState = "sinking" | "settled";

/** 가로 흔들림 폭 (px) */
const WOBBLE_AMPLITUDE_PX = 1.5;
/** 흔들림 위상 속도 (rad/s) */
const WOBBLE_SPEED = 3;
/** 회전 속도 (rad/s) */
const SPIN_SPEED = 2;
/** 바닥에 놓였을 때 모래에 살짝 박히는 깊이 (px) */
const SETTLE_DEPTH_PX = 2;

export class Food {
  x: number;
  y: number;
  state: FoodState = "sinking";
  settledHoursLeft: number = BALANCE.feeding.settledLifeGameHours;
  spin = 0;

  private readonly baseX: number;
  private phase: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt: number, tank: Tank): void {
    if (this.state === "sinking") {
      this.y += BALANCE.feeding.flakeSinkCm * VIEW.pxPerCm * dt;
      this.phase += WOBBLE_SPEED * dt;
      this.x = this.baseX + Math.sin(this.phase) * WOBBLE_AMPLITUDE_PX;
      this.spin += SPIN_SPEED * dt;
      if (this.y >= tank.floorY - SETTLE_DEPTH_PX) {
        this.y = tank.floorY - SETTLE_DEPTH_PX;
        this.state = "settled";
      }
    } else {
      this.settledHoursLeft = Math.max(0, this.settledHoursLeft - gameHours(dt));
    }
  }

  get expired(): boolean {
    return this.state === "settled" && this.settledHoursLeft <= 0;
  }

  get opacity(): number {
    if (this.state === "sinking") return 1;
    return this.settledHoursLeft / BALANCE.feeding.settledLifeGameHours;
  }
}
