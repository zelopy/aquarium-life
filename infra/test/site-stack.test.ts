import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CertificateStack } from "../lib/certificate-stack.js";
import type { SiteConfig } from "../lib/config.js";
import { SiteStack } from "../lib/site-stack.js";

const config: SiteConfig = {
  domainName: "example.com",
  hostedZoneId: "Z123",
  alertEmail: "a@example.com",
  githubRepo: "owner/repo",
};

describe("SiteStack", () => {
  const app = new App();
  const cert = new CertificateStack(app, "Cert", {
    env: { account: "111111111111", region: "us-east-1" },
    crossRegionReferences: true,
    domainName: config.domainName,
    hostedZoneId: config.hostedZoneId,
  });
  const stack = new SiteStack(app, "Site", {
    env: { account: "111111111111", region: "ap-northeast-2" },
    crossRegionReferences: true,
    config,
    certificate: cert.certificate,
  });
  const template = Template.fromStack(stack);

  it("버킷은 비공개 + 암호화", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.anyValue(),
      }),
    });
  });

  it("OAC 1개, 버킷 정책은 CloudFront 서비스만", () => {
    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Principal: { Service: "cloudfront.amazonaws.com" } }),
        ]),
      },
    });
  });

  it("배포 설정", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["example.com", "www.example.com"],
        DefaultRootObject: "index.html",
        HttpVersion: "http2and3",
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
          Compress: true,
        }),
      }),
    });
  });

  it("캐시 정책", () => {
    template.hasResourceProperties("AWS::CloudFront::CachePolicy", {
      CachePolicyConfig: Match.objectLike({
        MinTTL: 0,
        MaxTTL: 31536000,
        ParametersInCacheKeyAndForwardedToOrigin: Match.objectLike({
          EnableAcceptEncodingGzip: true,
          EnableAcceptEncodingBrotli: true,
          QueryStringsConfig: { QueryStringBehavior: "none" },
          CookiesConfig: { CookieBehavior: "none" },
          HeadersConfig: { HeaderBehavior: "none" },
        }),
      }),
    });
  });

  it("응답 헤더 정책", () => {
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          StrictTransportSecurity: Match.objectLike({
            AccessControlMaxAgeSec: 63072000,
            IncludeSubdomains: true,
          }),
          ContentTypeOptions: Match.objectLike({ Override: true }),
          ReferrerPolicy: Match.objectLike({ ReferrerPolicy: "strict-origin-when-cross-origin" }),
        }),
      }),
    });
  });

  it("루트·www 별칭 A/AAAA 4개", () => {
    template.resourceCountIs("AWS::Route53::RecordSet", 4);
    for (const name of ["example.com.", "www.example.com."]) {
      for (const type of ["A", "AAAA"]) {
        template.hasResourceProperties("AWS::Route53::RecordSet", { Name: name, Type: type });
      }
    }
  });

  it("월 5달러 예산 알림", () => {
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetLimit: { Amount: 5, Unit: "USD" },
        TimeUnit: "MONTHLY",
      }),
      NotificationsWithSubscribers: [
        {
          Notification: Match.objectLike({
            NotificationType: "ACTUAL",
            ComparisonOperator: "GREATER_THAN",
            Threshold: 100,
          }),
          Subscribers: [{ SubscriptionType: "EMAIL", Address: "a@example.com" }],
        },
      ],
    });
  });

  it("출력", () => {
    const outputs = template.toJSON().Outputs;
    expect(Object.keys(outputs)).toEqual(expect.arrayContaining(["BucketName", "DistributionId", "SiteUrl"]));
    expect(outputs.SiteUrl.Value).toBe("https://example.com");
  });
});
