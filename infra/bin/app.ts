import { App } from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack.js";
import { readConfig } from "../lib/config.js";
import { GithubDeployStack } from "../lib/github-deploy-stack.js";
import { SiteStack } from "../lib/site-stack.js";

const app = new App();
const config = readConfig((k) => app.node.tryGetContext(k));
const account = process.env.CDK_DEFAULT_ACCOUNT;

// CloudFront 용 인증서는 반드시 us-east-1 에 있어야 한다.
const certStack = new CertificateStack(app, "AquariumCertificate", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  domainName: config.domainName,
});

const siteStack = new SiteStack(app, "AquariumSite", {
  env: { account, region: "ap-northeast-2" },
  crossRegionReferences: true,
  config,
  certificate: certStack.certificate,
});

new GithubDeployStack(app, "AquariumGithubDeploy", {
  env: { account, region: "ap-northeast-2" },
  bucket: siteStack.bucket,
  distribution: siteStack.distribution,
  githubRepo: config.githubRepo,
  oidcProviderArn: config.githubOidcProviderArn,
});
