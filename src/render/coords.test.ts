import { describe, expect, it } from "vitest";
import { toLogical } from "./coords";

const rect = { left: 100, top: 50, width: 480, height: 300 };

describe("toLogical", () => {
  it("maps the rect corners and center", () => {
    expect(toLogical(100, 50, rect, 960, 600)).toEqual({ x: 0, y: 0 });
    expect(toLogical(580, 350, rect, 960, 600)).toEqual({ x: 960, y: 600 });
    expect(toLogical(340, 200, rect, 960, 600)).toEqual({ x: 480, y: 300 });
  });
});
