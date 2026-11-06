import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import type { SiteConfig } from "../lib/config.js";
import { CertificateStack } from "../lib/certificate-stack.js";
import { GithubDeployStack } from "../lib/github-deploy-stack.js";
import { SiteStack } from "../lib/site-stack.js";

const config: SiteConfig = {
  domainName: "example.com",
  alertEmail: "a@example.com",
  githubRepo: "zelopy@33337013/aquarium-life@1447069009",
};

function build(oidcProviderArn?: string) {
  const app = new App();
  const cert = new CertificateStack(app, "Cert", {
    env: { account: "111111111111", region: "us-east-1" },
    crossRegionReferences: true,
    domainName: config.domainName,
  });
  const site = new SiteStack(app, "Site", {
    env: { account: "111111111111", region: "ap-northeast-2" },
    crossRegionReferences: true,
    config,
    certificate: cert.certificate,
  });
  const stack = new GithubDeployStack(app, "Deploy", {
    env: { account: "111111111111", region: "ap-northeast-2" },
    bucket: site.bucket,
    distribution: site.distribution,
    githubRepo: config.githubRepo,
    oidcProviderArn,
  });
  return Template.fromStack(stack);
}

const PROVIDER = "token.actions.githubusercontent.com";

describe("GithubDeployStack", { timeout: 30000 }, () => {
  it("공급자 ARN이 없으면 OIDC 공급자를 만든다", () => {
    const t = build();
    t.resourceCountIs("Custom::AWSCDKOpenIdConnectProvider", 1);
    t.hasResourceProperties("Custom::AWSCDKOpenIdConnectProvider", {
      Url: `https://${PROVIDER}`,
      ClientIDList: ["sts.amazonaws.com"],
    });
  });

  it("공급자 ARN이 있으면 새로 만들지 않고 그 ARN을 신뢰한다", () => {
    const arn = `arn:aws:iam::111111111111:oidc-provider/${PROVIDER}`;
    const t = build(arn);
    t.resourceCountIs("Custom::AWSCDKOpenIdConnectProvider", 0);
    t.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [{ Principal: { Federated: arn } }],
      },
    });
  });

  it("신뢰 정책은 main 브랜치 + sts 대상만 허용 (StringLike 없음)", () => {
    const t = build();
    const role = Object.values(t.findResources("AWS::IAM::Role")).find((r) =>
      JSON.stringify(r.Properties.AssumeRolePolicyDocument).includes(
        "AssumeRoleWithWebIdentity",
      ),
    )!;
    const cond = role.Properties.AssumeRolePolicyDocument.Statement[0].Condition;
    expect(cond).toEqual({
      StringEquals: {
        [`${PROVIDER}:aud`]: "sts.amazonaws.com",
        [`${PROVIDER}:sub`]: "repo:zelopy@33337013/aquarium-life@1447069009:ref:refs/heads/main",
      },
    });
    expect(cond.StringLike).toBeUndefined();
  });

  it("권한은 정확히 4개 액션, 와일드카드 리소스 없음", () => {
    const t = build();
    const policies = Object.values(t.findResources("AWS::IAM::Policy"));
    const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
    const actions = new Set<string>(
      statements.flatMap((s: { Action: string | string[] }) => [s.Action].flat()),
    );
    expect([...actions].sort()).toEqual([
      "cloudfront:CreateInvalidation",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:PutObject",
    ]);
    for (const s of statements) {
      expect([s.Resource].flat()).not.toContain("*");
    }
  });

  it("세션 3600초, DeployRoleArn 출력", () => {
    const t = build();
    t.hasResourceProperties("AWS::IAM::Role", { MaxSessionDuration: 3600 });
    t.hasOutput("DeployRoleArn", {});
  });
});
