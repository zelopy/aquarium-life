import { Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import type { Construct } from "constructs";

export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: StackProps & { domainName: string }) {
    const { domainName, ...stackProps } = props;
    super(scope, id, stackProps);
    // 호스팅 영역 없이 DNS 검증 = 수동 검증. 배포 중 출력되는 CNAME 을 도메인 서비스에 직접 등록한다.
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName,
      validation: acm.CertificateValidation.fromDns(),
    });
  }
}
