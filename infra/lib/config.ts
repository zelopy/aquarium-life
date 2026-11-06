export interface SiteConfig {
  domainName: string;
  alertEmail: string;
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
    githubRepo: typeof repo === "string" && repo !== "" ? repo : "zelopy/aquarium-life",
    githubOidcProviderArn: typeof arn === "string" && arn !== "" ? arn : undefined,
  };
}
