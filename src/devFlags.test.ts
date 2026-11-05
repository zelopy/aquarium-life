import { describe, expect, it } from "vitest";
import { parseDevFlags } from "./devFlags";

describe("parseDevFlags", () => {
  it("개발 모드에서 ?variants 이면 showcase", () => {
    expect(parseDevFlags("?variants", true)).toEqual({ showcase: true });
  });
  it("개발 모드라도 ?variants 가 없으면 꺼짐", () => {
    expect(parseDevFlags("", true)).toEqual({ showcase: false });
  });
  it("프로덕션에서는 ?variants 가 있어도 꺼짐", () => {
    expect(parseDevFlags("?variants", false)).toEqual({ showcase: false });
  });
});
