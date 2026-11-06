import { describe, expect, it } from "vitest";
import { Tank } from "./Tank";

describe("Tank.isFeedingZone", () => {
  it("수면 아래 60px 직전까지만 먹이 영역이다", () => {
    const tank = new Tank();
    expect(tank.isFeedingZone(tank.surfaceY + 59)).toBe(true);
    expect(tank.isFeedingZone(tank.surfaceY + 60)).toBe(false);
  });
});
