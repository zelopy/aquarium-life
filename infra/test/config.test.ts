import { describe, expect, it } from "vitest";
import { readConfig } from "../lib/config.js";

const ok = { domainName: "example.com", hostedZoneId: "Z123", alertEmail: "a@example.com" };
const get = (o: Record<string, unknown>) => (k: string) => o[k];

describe("readConfig", () => {
  it("필수 값을 읽고 githubRepo 기본값을 채운다", () => {
    expect(readConfig(get(ok))).toEqual({ ...ok, githubRepo: "zelopy/aquarium-life", githubOidcProviderArn: undefined });
  });
  it.each(["domainName", "hostedZoneId", "alertEmail"])("%s 가 없으면 이름을 담아 throw", (key) => {
    expect(() => readConfig(get({ ...ok, [key]: undefined }))).toThrow(key);
  });
  it("빈 문자열도 없는 것으로 본다", () => {
    expect(() => readConfig(get({ ...ok, domainName: "" }))).toThrow("domainName");
  });
});
