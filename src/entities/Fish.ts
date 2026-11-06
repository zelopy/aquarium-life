import { BALANCE, VIEW } from "../game/balance";
import type { Tank } from "../game/Tank";
import type { SpeciesConfig, VariantConfig } from "./species/types";

/** 쫓는 중 목표와 이 거리 안이면 방향을 바꾸지 않는다 (시각 상수) */
const CHASE_TURN_DEADBAND_PX = 6;

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
  private isChasing = false;
  private chaseX = 0;
  /** 포만감 0~100 */
  fullness: number = BALANCE.feeding.startFullness;

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

  /** 입 위치. 바라보는 방향 몸 끝. */
  get mouth(): { x: number; y: number } {
    return { x: this.x + (this.facing * this.lengthPx) / 2, y: this.y };
  }

  get chasing(): boolean {
    return this.isChasing;
  }

  /** (x, y) 에 입이 닿도록 쫓는다. 매 프레임 불러도 된다. */
  chase(x: number, y: number): void {
    this.isChasing = true;
    this.chaseX = x;
    this.targetX = x - (Math.sign(this.facing || 1) * this.lengthPx) / 2;
    this.targetY = y;
    this.speedFactor = BALANCE.feeding.chaseSpeedFactor;
  }

  /** 쫓기를 끝내고 새 떠돌기 목표를 고른다. */
  stopChasing(tank: Tank): void {
    this.isChasing = false;
    this.pickTarget(tank);
  }

  update(dt: number, tank: Tank): void {
    this.retargetTimer -= dt;
    let dx = this.targetX - this.x;
    let dy = this.targetY - this.y;
    if (!this.isChasing && (Math.hypot(dx, dy) < 8 || this.retargetTimer <= 0)) {
      this.pickTarget(tank);
      dx = this.targetX - this.x;
      dy = this.targetY - this.y;
    }
    const dist = Math.hypot(dx, dy);

    // 목표 지점으로 조향. 가까워지면 감속(arrive).
    // 쫓는 중에는 감속 거리를 줄이고 세로 속도도 줄이지 않아, 가라앉는 먹이를 따라잡는다.
    const arriveRadius = this.isChasing ? BALANCE.feeding.chaseArriveRadiusPx : 60;
    const verticalFactor = this.isChasing ? 1 : 0.6;
    const speed = this.maxSpeed * this.speedFactor * Math.min(1, dist / arriveRadius);
    const desiredVx = dist > 0 ? (dx / dist) * speed : 0;
    const desiredVy = dist > 0 ? (dy / dist) * speed * verticalFactor : 0;
    const steer = Math.min(1, dt * 1.6);
    this.vx += (desiredVx - this.vx) * steer;
    this.vy += (desiredVy - this.vy) * steer;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const half = this.lengthPx / 2;
    this.x = clamp(this.x, tank.wallMargin + half, tank.width - tank.wallMargin - half);
    this.y = clamp(this.y, tank.surfaceY + 10, tank.floorY - 10);

    // 가로 속도 방향으로 몸을 돌린다. 쫓는 중에는 목표 쪽을 보고,
    // 목표 근처(오버슈트 구간)에서는 지금 향한 쪽으로 몸을 마저 돌려 입 위치를 안정시킨다.
    let turnDir = 0;
    if (this.isChasing) {
      // 방향은 몸 목표(facing 에 의존)가 아니라 쫓는 지점 기준으로 정해 떨림을 막는다.
      const toChase = this.chaseX - this.x;
      turnDir = Math.abs(toChase) > CHASE_TURN_DEADBAND_PX ? Math.sign(toChase) : Math.sign(this.facing || 1);
    } else if (Math.abs(this.vx) > 3) {
      turnDir = Math.sign(this.vx);
    }
    if (turnDir !== 0) this.facing += (turnDir - this.facing) * Math.min(1, dt * 5);

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
