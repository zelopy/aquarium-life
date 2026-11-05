import { VIEW } from "../game/balance";
import type { Tank } from "../game/Tank";
import type { SpeciesConfig, VariantConfig } from "./species/types";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** 모든 종이 공유하는 물고기 클래스. 종별 차이는 SpeciesConfig 로 표현한다. */
export class Fish {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** -1(왼쪽) ~ 1(오른쪽). 방향 전환 시 부드럽게 바뀌어 몸이 뒤집히는 연출에 쓴다. */
  facing = 1;
  /** 꼬리 흔들림 위상 */
  tailPhase = Math.random() * Math.PI * 2;
  /** 개체마다 고정된 무늬 배치를 만들기 위한 시드 */
  readonly patternSeed = Math.floor(Math.random() * 0x7fffffff);

  private targetX: number;
  private targetY: number;
  private speedFactor = 1;
  private retargetTimer = 0;

  constructor(
    readonly species: SpeciesConfig,
    readonly variant: VariantConfig,
    public name: string,
    x: number,
    y: number,
  ) {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
  }

  /** 화면상 몸길이(px). 성장 단계는 이후 GrowthSystem 에서 반영 */
  get lengthPx(): number {
    return this.species.sizeCm.adult * VIEW.pxPerCm;
  }

  get maxSpeed(): number {
    return this.species.swimSpeedCm * VIEW.pxPerCm;
  }

  update(dt: number, tank: Tank): void {
    this.retargetTimer -= dt;
    let dx = this.targetX - this.x;
    let dy = this.targetY - this.y;
    if (Math.hypot(dx, dy) < 8 || this.retargetTimer <= 0) {
      this.pickTarget(tank);
      dx = this.targetX - this.x;
      dy = this.targetY - this.y;
    }
    const dist = Math.hypot(dx, dy);

    // 목표 지점으로 조향. 가까워지면 감속(arrive).
    const speed = this.maxSpeed * this.speedFactor * Math.min(1, dist / 60);
    const desiredVx = dist > 0 ? (dx / dist) * speed : 0;
    const desiredVy = dist > 0 ? (dy / dist) * speed * 0.6 : 0;
    const steer = Math.min(1, dt * 1.6);
    this.vx += (desiredVx - this.vx) * steer;
    this.vy += (desiredVy - this.vy) * steer;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const half = this.lengthPx / 2;
    this.x = clamp(this.x, tank.wallMargin + half, tank.width - tank.wallMargin - half);
    this.y = clamp(this.y, tank.surfaceY + 10, tank.floorY - 10);

    // 가로 속도 방향으로 몸을 돌린다.
    if (Math.abs(this.vx) > 3) {
      const dir = Math.sign(this.vx);
      this.facing += (dir - this.facing) * Math.min(1, dt * 5);
    }

    // 빠를수록 꼬리를 빠르게 흔든다.
    const speedRatio = Math.hypot(this.vx, this.vy) / this.maxSpeed;
    this.tailPhase += dt * (3 + speedRatio * 9);
  }

  private pickTarget(tank: Tank): void {
    const zone = this.species.zone[Math.floor(Math.random() * this.species.zone.length)];
    const range = tank.zoneRange(zone);
    const half = this.lengthPx / 2;
    const minX = tank.wallMargin + half;
    const maxX = tank.width - tank.wallMargin - half;

    if (Math.random() < 0.25) {
      // 근처에서 잠깐 머뭇거리기
      this.targetX = clamp(this.x + rand(-60, 60), minX, maxX);
      this.targetY = clamp(this.y + rand(-20, 20), range.top, range.bottom);
      this.speedFactor = rand(0.25, 0.45);
    } else {
      this.targetX = rand(minX, maxX);
      this.targetY = rand(range.top, range.bottom);
      this.speedFactor = rand(0.6, 1.1);
    }
    this.retargetTimer = rand(4, 9);
  }
}
