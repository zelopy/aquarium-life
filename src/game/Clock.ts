import { BALANCE } from "./balance";

/** 게임 시간과 낮/밤 */
export class Clock {
  /** 누적 게임 시간 (게임 시 단위) */
  private totalHours: number;

  constructor(startHour: number = BALANCE.startHour) {
    this.totalHours = startHour;
  }

  update(realDt: number): void {
    this.totalHours += (realDt / BALANCE.realSecondsPerGameDay) * 24;
  }

  get day(): number {
    return Math.floor(this.totalHours / 24) + 1;
  }

  /** 0 ~ 24 */
  get hour(): number {
    return this.totalHours % 24;
  }

  get isNight(): boolean {
    const h = this.hour;
    return h < BALANCE.dayStartHour || h >= BALANCE.nightStartHour;
  }
}
