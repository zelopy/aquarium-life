import { describe, expect, it } from "vitest";
import { Clock, gameHours } from "./Clock";

describe("gameHours", () => {
  it("현실 초를 게임 시로 바꾼다", () => {
    expect(gameHours(300)).toBe(24);
    expect(gameHours(12.5)).toBe(1);
  });
});

describe("Clock.update", () => {
  it("gameHours만큼 시각이 흐른다", () => {
    const clock = new Clock(8);
    clock.update(12.5);
    expect(clock.hour).toBeCloseTo(9);
  });
});
