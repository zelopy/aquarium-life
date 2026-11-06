import { App } from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack.js";
import { readConfig } from "../lib/config.js";

const app = new App();
const config = readConfig((k) => app.node.tryGetContext(k));
const account = process.env.CDK_DEFAULT_ACCOUNT;

// CloudFront 용 인증서는 반드시 us-east-1 에 있어야 한다.
new CertificateStack(app, "AquariumCertificate", {
  env: { account, region: "us-east-1" },
  domainName: config.domainName,
  hostedZoneId: config.hostedZoneId,
});
