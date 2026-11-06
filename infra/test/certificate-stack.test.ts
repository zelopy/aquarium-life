import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CertificateStack } from "../lib/certificate-stack.js";

describe("CertificateStack", () => {
  const app = new App();
  const stack = new CertificateStack(app, "Cert", {
    env: { account: "111111111111", region: "us-east-1" },
    domainName: "example.com",
  });
  const template = Template.fromStack(stack);

  it("DNS 검증 인증서를 apex 단일 도메인으로 만들고 자동 검증은 붙이지 않는다", () => {
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "example.com",
      SubjectAlternativeNames: Match.absent(),
      DomainValidationOptions: Match.absent(),
      ValidationMethod: "DNS",
    });
    template.resourceCountIs("AWS::Route53::RecordSet", 0);
  });
});
