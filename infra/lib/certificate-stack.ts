import { Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: StackProps & { domainName: string; hostedZoneId: string }) {
    const { domainName, hostedZoneId, ...stackProps } = props;
    super(scope, id, stackProps);
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId,
      zoneName: domainName,
    });
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
