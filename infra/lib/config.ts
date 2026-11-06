export interface SiteConfig {
  domainName: string;
  alertEmail: string;
  // GitHub OIDC 토큰의 sub 접두어에 들어가는 저장소 식별자.
  // 이 저장소는 immutable subject를 쓰므로 "소유자@소유자ID/저장소@저장소ID" 형식이다.
  githubRepo: string;
  githubOidcProviderArn?: string;
}

function required(get: (key: string) => unknown, key: string): string {
  const value = get(key);
  if (typeof value !== "string" || value === "") {
    throw new Error(`CDK context "${key}" 가 필요합니다. infra/cdk.json 또는 -c ${key}=... 로 지정하세요.`);
  }
  return value;
}

export function readConfig(get: (key: string) => unknown): SiteConfig {
  const arn = get("githubOidcProviderArn");
  const repo = get("githubRepo");
  return {
    domainName: required(get, "domainName"),
    alertEmail: required(get, "alertEmail"),
    githubRepo: typeof repo === "string" && repo !== "" ? repo : "zelopy@33337013/aquarium-life@1447069009",
    githubOidcProviderArn: typeof arn === "string" && arn !== "" ? arn : undefined,
  };
}
