import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import type * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

const PROVIDER_HOST = "token.actions.githubusercontent.com";

export interface GithubDeployStackProps extends StackProps {
  readonly bucket: s3.IBucket;
  readonly distribution: cloudfront.IDistribution;
  /** "owner/repo" */
  readonly githubRepo: string;
  /** 계정에 이미 있는 GitHub OIDC 공급자 ARN. 없으면 새로 만든다. */
  readonly oidcProviderArn?: string;
}

export class GithubDeployStack extends Stack {
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
    super(scope, id, props);

    const provider = props.oidcProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          "GithubProvider",
          props.oidcProviderArn,
        )
      : new iam.OpenIdConnectProvider(this, "GithubProvider", {
          url: `https://${PROVIDER_HOST}`,
          clientIds: ["sts.amazonaws.com"],
        });

    this.role = new iam.Role(this, "DeployRole", {
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          [`${PROVIDER_HOST}:aud`]: "sts.amazonaws.com",
          [`${PROVIDER_HOST}:sub`]: `repo:${props.githubRepo}:ref:refs/heads/main`,
        },
      }),
    });

    // grant* 헬퍼는 불필요한 액션을 붙이므로 최소 권한을 직접 적는다.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [props.bucket.bucketArn],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:DeleteObject"],
        resources: [props.bucket.arnForObjects("*")],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          `arn:${this.partition}:cloudfront::${this.account}:distribution/${props.distribution.distributionId}`,
        ],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: this.role.roleArn });
  }
}
