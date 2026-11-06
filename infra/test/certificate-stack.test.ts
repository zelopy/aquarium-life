import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CertificateStack } from "../lib/certificate-stack.js";

describe("CertificateStack", () => {
  const app = new App();
  const stack = new CertificateStack(app, "Cert", {
    env: { account: "111111111111", region: "us-east-1" },
    domainName: "example.com",
    hostedZoneId: "Z123",
  });
  const template = Template.fromStack(stack);

  it("DNS 검증 인증서를 apex + www 로 만든다", () => {
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "example.com",
      SubjectAlternativeNames: ["www.example.com"],
      ValidationMethod: "DNS",
    });
  });
});
