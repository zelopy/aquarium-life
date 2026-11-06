# 웹 배포 (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임을 S3 + CloudFront로 공개 배포하고(도메인은 무료 도메인 `aquarium-life.n-e.kr`, DNS는 그 서비스에서 관리), `main` push 때 GitHub Actions가 자동으로 게임 파일을 올리게 한다.

**Architecture:** `infra/`에 독립된 CDK 앱(스택 3개: 인증서·사이트·GitHub 배포 역할)을 둔다. 인프라는 로컬에서 `cdk deploy`로만 바꾸고, 게임 파일은 `scripts/deploy.sh`가 `aws s3 sync` + 캐시 무효화로 올린다. 이 스크립트를 CI(OIDC 역할)와 로컬 `npm run deploy`가 함께 쓴다.

**Tech Stack:** aws-cdk-lib 2.x, constructs, aws-cdk CLI, tsx (CDK 앱 실행), Vitest 5 (루트·infra 테스트), Bash, GitHub Actions, AWS CLI v2

**Spec:** `docs/superpowers/specs/2026-11-05-web-deploy-and-rewarded-ads-design.md` (Part A = 3장)

## Global Constraints

- 사이트 버킷 리전: `ap-northeast-2`. ACM 인증서: `us-east-1`.
- 도메인·호스팅 영역 ID·알림 이메일은 CDK context로 받는다. 코드에 하드코딩하지 않는다.
- S3 퍼블릭 접근 전면 차단. CloudFront만 OAC로 읽는다.
- 캐시: `assets/*` → `public,max-age=31536000,immutable`, 그 밖의 모든 파일 → `no-cache`.
- OIDC 신뢰 조건: `aud = sts.amazonaws.com`, `sub = repo:zelopy/aquarium-life:ref:refs/heads/main` (정확히 일치, 와일드카드 금지).
- 배포 역할 권한: 사이트 버킷 `s3:ListBucket` / `s3:PutObject` / `s3:DeleteObject`, 해당 배포 `cloudfront:CreateInvalidation`. 그 외 없음.
- GitHub 저장소 변수(비밀 아님): `AWS_REGION`, `AWS_ROLE_ARN`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.
- 예산 알림: 월 $5 초과 시 이메일.
- Node 24. 액션은 메이저 태그로 고정 (`@v4` 등).
- UI·문서 텍스트는 한국어. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `docs/design.md`, `docs/progress.md`는 git에서 무시되는 로컬 파일이다. 수정은 하되 `git add` 하지 않는다.

## Review Focus

1. **배포 환경 변수가 비어 있음** → `deploy.sh`가 아무것도 올리지 않고, 어떤 변수가 없는지 말하며 실패해야 한다 (`s3://` 같은 빈 대상으로 sync 금지). Task 5 테스트.
2. **PR·다른 브랜치·포크에서 역할 맡기 시도** → 거부되어야 한다. 신뢰 정책 `sub`가 `main` 한 개와 정확히 일치하는지 Task 4 테스트.
3. **계정에 GitHub OIDC 공급자가 이미 있음** → 새로 만들면 배포가 실패한다. context `githubOidcProviderArn`이 있으면 가져다 쓴다. Task 4 테스트(두 경우).
4. **배포 직후 `index.html`이 옛 버전으로 남음** → 캐시 정책 `minTtl = 0`이어야 `no-cache`가 실제로 재검증된다. Task 3 테스트.
5. **sync 순서가 바뀌어 배포 도중 사이트가 깨짐** → 새 파일 업로드 2회가 끝난 뒤에만 `--delete`, 그 뒤 무효화. Task 5 테스트.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/devFlags.ts` (생성) | URL·빌드 모드로 개발용 기능 켜기 판단 |
| `src/devFlags.test.ts` (생성) | 위 테스트 |
| `src/main.ts` (수정) | `devFlags` 사용 |
| `public/favicon.svg`, `public/privacy.html` (생성) | 공개 사이트용 정적 파일 |
| `index.html` (수정) | favicon 링크, description, 개인정보처리방침 링크 |
| `infra/package.json`, `infra/tsconfig.json`, `infra/cdk.json` (생성) | 독립 CDK 앱 |
| `infra/bin/app.ts` (생성) | 스택 3개 조립 |
| `infra/lib/config.ts` (생성) | context 읽기·검증 |
| `infra/lib/certificate-stack.ts` (생성) | ACM 인증서 (us-east-1) |
| `infra/lib/site-stack.ts` (생성) | S3, CloudFront, Route 53, 예산, 출력 |
| `infra/lib/github-deploy-stack.ts` (생성) | OIDC 공급자 + 배포 역할 |
| `infra/test/*.test.ts` (생성) | CDK assertions 테스트 |
| `scripts/deploy.sh`, `scripts/deploy.test.sh` (생성) | 게임 파일 배포와 그 테스트 |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (생성) | CI·자동 배포 |
| `package.json` (수정) | `test`, `deploy` 스크립트, vitest |
| `.gitignore` (수정) | `infra/cdk.out`, `infra/cdk.context.json` |
| `CLAUDE.md` (수정) | 명령어·배포 절차 |

---

### Task 1: 프로덕션에서 개발용 기능 끄기 + 공개용 정적 파일

**Files:**
- Create: `src/devFlags.ts`, `src/devFlags.test.ts`, `public/favicon.svg`, `public/privacy.html`
- Modify: `src/main.ts:7-8`, `index.html`, `package.json`

**Interfaces:**
- Produces: `parseDevFlags(search: string, isDev: boolean): { showcase: boolean }`, 루트 `npm test`(vitest run)

- [ ] **Step 1: vitest 설치, `package.json`에 `"test": "vitest run"` 추가**

Run: `npm install -D vitest@^5`

- [ ] **Step 2: 실패하는 테스트 작성 (`src/devFlags.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { parseDevFlags } from "./devFlags";

describe("parseDevFlags", () => {
  it("개발 모드에서 ?variants 이면 showcase", () => {
    expect(parseDevFlags("?variants", true)).toEqual({ showcase: true });
  });
  it("개발 모드라도 ?variants 가 없으면 꺼짐", () => {
    expect(parseDevFlags("", true)).toEqual({ showcase: false });
  });
  it("프로덕션에서는 ?variants 가 있어도 꺼짐", () => {
    expect(parseDevFlags("?variants", false)).toEqual({ showcase: false });
  });
});
```

- [ ] **Step 3: `npm test` → FAIL (모듈 없음)**

- [ ] **Step 4: `src/devFlags.ts`에 `parseDevFlags` 구현, `src/main.ts`에서 `parseDevFlags(location.search, import.meta.env.DEV)`로 교체**

`window.game` 노출은 이미 `import.meta.env.DEV` 전용이므로 그대로 둔다.

- [ ] **Step 5: `npm test` → PASS 3개**

- [ ] **Step 6: 정적 파일과 `index.html`**
  - `public/favicon.svg`: 🐟 이모지를 담은 SVG (`<text>` 하나).
  - `index.html` `<head>`: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`, `<meta name="description" content="물고기에게 먹이를 주고 수질을 관리하며 나만의 수족관을 키우는 웹 게임" />`.
  - `index.html` `<body>`: 화면 오른쪽 아래 작은 링크 `<a href="/privacy.html">개인정보처리방침</a>` (반투명, 작은 글씨, 캔버스를 가리지 않게 `position: fixed`).
  - `public/privacy.html`: 한국어 한 페이지. 내용 — 이 게임은 개인정보를 수집하지 않음 / 게임 진행 정보는 이용자 브라우저(localStorage)에만 저장되고 서버로 보내지 않음 / 쿠키·광고 없음 (광고 도입 시 갱신 예정) / 시행일 2026-11-05 / 문의: GitHub 저장소 이슈 `https://github.com/zelopy/aquarium-life/issues`. `<html lang="ko">`, 모바일 viewport, 게임으로 돌아가기 링크(`/`).

- [ ] **Step 7: 빌드 확인**

Run: `npm run build && ls dist`
Expected: 빌드 성공, `dist/`에 `index.html`, `favicon.svg`, `privacy.html`, `assets/` 존재.

Run: `npm run preview`에서 `http://localhost:4173/?variants` 접속 (Playwright)
Expected: 구피 1마리, 이름표 없음, 콘솔 오류 0개 (favicon 404 없음). `/privacy.html` 열림.

- [ ] **Step 8: Commit**

```bash
git add src/devFlags.ts src/devFlags.test.ts src/main.ts public index.html package.json package-lock.json
git commit -m "feat: disable dev showcase in production, add favicon and privacy page"
```

---

### Task 2: CDK 앱 뼈대 + 설정 검증 + 인증서 스택

**Files:**
- Create: `infra/package.json`, `infra/tsconfig.json`, `infra/cdk.json`, `infra/bin/app.ts`, `infra/lib/config.ts`, `infra/lib/certificate-stack.ts`, `infra/test/config.test.ts`, `infra/test/certificate-stack.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  ```ts
  // infra/lib/config.ts
  export interface SiteConfig {
    domainName: string;          // 예: "example.com"
    hostedZoneId: string;        // Route 53 호스팅 영역 ID
    alertEmail: string;
    githubRepo: string;          // 기본값 "zelopy/aquarium-life"
    githubOidcProviderArn?: string;
  }
  export function readConfig(get: (key: string) => unknown): SiteConfig;
  // infra/lib/certificate-stack.ts
  export class CertificateStack extends Stack {
    readonly certificate: acm.ICertificate;
    constructor(scope: Construct, id: string, props: StackProps & { domainName: string; hostedZoneId: string });
  }
  ```

- [ ] **Step 1: 뼈대 만들기**
  - `infra/package.json`: `"private": true`, `"type": "module"`, scripts `"test": "vitest run"`, `"cdk": "cdk"`. 의존성 `aws-cdk-lib`, `constructs`; dev 의존성 `aws-cdk`, `tsx`, `typescript`, `vitest@^5`, `@types/node`.
  - `infra/cdk.json`: `"app": "npx tsx bin/app.ts"`, `"context"`에 `"githubRepo": "zelopy/aquarium-life"`. `domainName`·`hostedZoneId`·`alertEmail`은 도메인 구매 뒤 Task 7에서 채운다.
  - `infra/tsconfig.json`: `strict`, `module`/`moduleResolution` `NodeNext`, `noEmit`, `include: ["bin", "lib", "test"]`.
  - 루트 `.gitignore`에 `infra/cdk.out`, `infra/cdk.context.json` 추가.

- [ ] **Step 2: 실패하는 테스트 (`infra/test/config.test.ts`)**

```ts
const ok = { domainName: "example.com", hostedZoneId: "Z123", alertEmail: "a@example.com" };
const get = (o: Record<string, unknown>) => (k: string) => o[k];

it("필수 값을 읽고 githubRepo 기본값을 채운다", () => {
  expect(readConfig(get(ok))).toEqual({ ...ok, githubRepo: "zelopy/aquarium-life", githubOidcProviderArn: undefined });
});
it.each(["domainName", "hostedZoneId", "alertEmail"])("%s 가 없으면 이름을 담아 throw", (key) => {
  expect(() => readConfig(get({ ...ok, [key]: undefined }))).toThrow(key);
});
it("빈 문자열도 없는 것으로 본다", () => {
  expect(() => readConfig(get({ ...ok, domainName: "" }))).toThrow("domainName");
});
```

- [ ] **Step 3: 실패하는 테스트 (`infra/test/certificate-stack.test.ts`)**

`new CertificateStack(app, "Cert", { env: { account: "111111111111", region: "us-east-1" }, domainName: "example.com", hostedZoneId: "Z123" })`를 합성해서:
- `AWS::CertificateManager::Certificate`가 1개, `DomainName: "example.com"`, `SubjectAlternativeNames: ["www.example.com"]`, `ValidationMethod: "DNS"`.

- [ ] **Step 4: `cd infra && npm test` → FAIL**

- [ ] **Step 5: 구현**
  - `readConfig`: 필수 값이 문자열이 아니거나 비어 있으면 `` `CDK context "${key}" 가 필요합니다. infra/cdk.json 또는 -c ${key}=... 로 지정하세요.` ``로 throw.
  - `CertificateStack`: `HostedZone.fromHostedZoneAttributes`(zoneName = domainName) + `acm.Certificate`(`CertificateValidation.fromDns(zone)`).
  - `bin/app.ts`: `readConfig(k => app.node.tryGetContext(k))`, 인증서 스택을 `us-east-1`에, 계정은 `process.env.CDK_DEFAULT_ACCOUNT`. Task 3·4의 스택은 각 태스크에서 추가한다.

- [ ] **Step 6: `cd infra && npm test` → PASS**

- [ ] **Step 7: `cd infra && npx cdk synth -c domainName=example.com -c hostedZoneId=Z123 -c alertEmail=a@example.com`** → 오류 없이 템플릿 출력. context 없이 실행하면 `domainName` 안내 메시지로 실패.

- [ ] **Step 8: Commit**

```bash
git add infra .gitignore
git commit -m "feat(infra): scaffold CDK app with config validation and ACM certificate stack"
```

---

### Task 3: 사이트 스택 (S3 + CloudFront + Route 53 + 예산)

**Files:**
- Create: `infra/lib/site-stack.ts`, `infra/test/site-stack.test.ts`
- Modify: `infra/bin/app.ts`

**Interfaces:**
- Consumes: `SiteConfig`, `CertificateStack.certificate`
- Produces:
  ```ts
  export class SiteStack extends Stack {
    readonly bucket: s3.IBucket;
    readonly distribution: cloudfront.IDistribution;
    constructor(scope: Construct, id: string, props: StackProps & {
      config: SiteConfig; certificate: acm.ICertificate;
    });
  }
  ```
  CfnOutput 이름: `BucketName`, `DistributionId`, `SiteUrl` (`https://<domainName>`).

- [ ] **Step 1: 실패하는 테스트 (`infra/test/site-stack.test.ts`)**

테스트용 앱에서 `CertificateStack`(us-east-1)과 `SiteStack`(ap-northeast-2, `crossRegionReferences: true`)을 만들고 `SiteStack` 템플릿에 대해:
- `AWS::S3::Bucket`: `PublicAccessBlockConfiguration` 네 항목 모두 `true`, 암호화 설정 있음.
- `AWS::CloudFront::OriginAccessControl` 1개, 버킷 정책 `Principal.Service = "cloudfront.amazonaws.com"`.
- `AWS::CloudFront::Distribution`: `Aliases = ["example.com", "www.example.com"]`, `DefaultRootObject = "index.html"`, `ViewerProtocolPolicy = "redirect-to-https"`, `Compress = true`, `HttpVersion = "http2and3"`.
- `AWS::CloudFront::CachePolicy`: `MinTTL = 0`, `MaxTTL = 31536000`, gzip·brotli 둘 다 `true`, 쿼리 문자열·쿠키·헤더 모두 캐시 키에서 제외.
- `AWS::CloudFront::ResponseHeadersPolicy`: HSTS(`AccessControlMaxAgeSec = 63072000`, `IncludeSubdomains = true`), `ContentTypeOptions`, `ReferrerPolicy = "strict-origin-when-cross-origin"`.
- `AWS::Route53::RecordSet`: `example.com.`과 `www.example.com.` 각각 `A`·`AAAA` 별칭 (총 4개).
- `AWS::Budgets::Budget`: `BudgetLimit.Amount = 5`, `Unit = "USD"`, `TimeUnit = "MONTHLY"`, 알림 `ACTUAL`·`GREATER_THAN`·`100`·이메일 `a@example.com`.
- 출력 `BucketName`, `DistributionId`, `SiteUrl` 존재.

- [ ] **Step 2: `cd infra && npm test` → FAIL**

- [ ] **Step 3: 구현**
  - 버킷: `blockPublicAccess: BLOCK_ALL`, `encryption: S3_MANAGED`, `enforceSSL: true`, `removalPolicy: RETAIN`.
  - 오리진: `S3BucketOrigin.withOriginAccessControl(bucket)`.
  - 캐시 정책: `minTtl 0`, `defaultTtl 1일`, `maxTtl 365일`, `enableAcceptEncodingGzip/Brotli: true`, 쿼리·쿠키·헤더 `none()`. 오리진의 `Cache-Control`이 실제 TTL을 정한다.
  - 응답 헤더 정책: 위 테스트 값. CSP는 넣지 않는다 (Part B).
  - 배포: `domainNames: [domain, "www." + domain]`, `certificate`, `defaultRootObject: "index.html"`, `httpVersion: HTTP2_AND_3`, `priceClass: PRICE_CLASS_200` (한국 포함, 가장 비싼 지역 제외).
  - Route 53: 루트·`www` 각각 `ARecord` + `AaaaRecord`, `CloudFrontTarget`.
  - 예산: `CfnBudget` (L1).
  - `bin/app.ts`에 `SiteStack`을 `ap-northeast-2`, `crossRegionReferences: true`로 추가.

- [ ] **Step 4: `cd infra && npm test` → PASS**

- [ ] **Step 5: Commit**

```bash
git add infra
git commit -m "feat(infra): add site stack with private S3, CloudFront, Route 53 records and budget alert"
```

---

### Task 4: GitHub 배포 역할 스택 (OIDC)

**Files:**
- Create: `infra/lib/github-deploy-stack.ts`, `infra/test/github-deploy-stack.test.ts`
- Modify: `infra/bin/app.ts`

**Interfaces:**
- Consumes: `SiteStack.bucket`, `SiteStack.distribution`, `SiteConfig.githubRepo`, `SiteConfig.githubOidcProviderArn`
- Produces: `GithubDeployStack` (props: `StackProps & { bucket; distribution; githubRepo: string; oidcProviderArn?: string }`), CfnOutput `DeployRoleArn`

- [ ] **Step 1: 실패하는 테스트**
  - `oidcProviderArn` 없음 → OIDC 공급자 리소스 1개 (`Url = https://token.actions.githubusercontent.com`, `ClientIdList = ["sts.amazonaws.com"]`).
  - `oidcProviderArn` 있음 → OIDC 공급자 리소스 0개, 역할 신뢰 정책 `Principal.Federated`가 그 ARN.
  - 역할 신뢰 정책 `Condition.StringEquals`가 정확히 `{ "token.actions.githubusercontent.com:aud": "sts.amazonaws.com", "token.actions.githubusercontent.com:sub": "repo:zelopy/aquarium-life:ref:refs/heads/main" }`이고, `StringLike` 조건은 없음.
  - 역할에 붙은 정책의 `Action` 합집합이 정확히 `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject`, `cloudfront:CreateInvalidation`. `Resource`에 `"*"` 없음.
  - `MaxSessionDuration` 3600, 출력 `DeployRoleArn` 존재.

- [ ] **Step 2: `cd infra && npm test` → FAIL**

- [ ] **Step 3: 구현**
  - 공급자: `oidcProviderArn`이 있으면 `OpenIdConnectProvider.fromOpenIdConnectProviderArn`, 없으면 `new iam.OpenIdConnectProvider`.
  - 역할: `WebIdentityPrincipal(provider.openIdConnectProviderArn, { StringEquals: {...} })`.
  - 권한은 `grant*` 헬퍼 대신 `addToPolicy`로 직접 적는다 (헬퍼는 테스트가 막는 추가 액션을 붙인다). ListBucket은 버킷 ARN, Put/Delete는 `버킷ARN/*`, 무효화는 `arn:aws:cloudfront::<account>:distribution/<id>`.
  - `bin/app.ts`에 `ap-northeast-2`로 추가.

- [ ] **Step 4: `cd infra && npm test` → PASS**

- [ ] **Step 5: Commit**

```bash
git add infra
git commit -m "feat(infra): add GitHub OIDC deploy role limited to main branch"
```

---

### Task 5: 게임 파일 배포 스크립트

**Files:**
- Create: `scripts/deploy.sh`, `scripts/deploy.test.sh`
- Modify: `package.json`

**Interfaces:**
- Consumes: 환경 변수 `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, 선택 `AWS_BIN`(기본 `aws`, 테스트용 대체), 선택 `DIST_DIR`(기본 `dist`)
- Produces: `npm run deploy` = `npm run build && bash scripts/deploy.sh`, `npm run test:deploy` = `bash scripts/deploy.test.sh`

- [ ] **Step 1: 실패하는 테스트 (`scripts/deploy.test.sh`)**

임시 폴더에 가짜 `dist/`(`index.html`, `assets/a.js`)와 인자를 한 줄씩 로그 파일에 적는 가짜 `aws` 스크립트를 만든다. 다음을 확인하고 하나라도 틀리면 `exit 1`:
1. `S3_BUCKET`이 비어 있으면 종료 코드 ≠ 0, stderr에 `S3_BUCKET`, 가짜 aws 호출 0회.
2. `CLOUDFRONT_DISTRIBUTION_ID`가 비어 있을 때도 같은 방식.
3. `DIST_DIR`에 `index.html`이 없으면 종료 코드 ≠ 0, aws 호출 0회.
4. 정상 실행 시 호출이 정확히 4번, 이 순서:
   - `s3 sync <dist>/assets s3://B/assets --cache-control public,max-age=31536000,immutable`
   - `s3 sync <dist> s3://B --exclude assets/* --cache-control no-cache`
   - `s3 sync <dist> s3://B --delete --size-only`
   - `cloudfront create-invalidation --distribution-id D --paths /index.html /`

- [ ] **Step 2: `bash scripts/deploy.test.sh` → FAIL (스크립트 없음)**

- [ ] **Step 3: `scripts/deploy.sh` 구현**

`set -euo pipefail`. 변수 검사 → `index.html` 검사 → 위 4개 호출. `--delete` 단계에 `--size-only`를 붙이는 이유를 주석으로 남긴다: 앞에서 올린 파일을 다시 올려 `Cache-Control` 메타데이터를 잃지 않게. 각 단계 앞에 한 줄 진행 로그.

- [ ] **Step 4: `bash scripts/deploy.test.sh` → PASS**

- [ ] **Step 5: `package.json`에 `deploy`, `test:deploy` 추가 후 Commit**

```bash
git add scripts package.json
git commit -m "feat: add site file deploy script with cache headers and safe delete order"
```

---

### Task 6: GitHub Actions 워크플로

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run build`, `infra`의 `npm test`, `npm run test:deploy`, `scripts/deploy.sh`, 저장소 변수 4개

- [ ] **Step 1: `ci.yml`**
  - `on: pull_request` 하나만. `permissions: contents: read`.
  - Job `test`: `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: 24`, `cache: npm`, `cache-dependency-path` 루트·infra 두 lock 파일) → `npm ci` → `npm test` → `npm run build` → `npm run test:deploy` → `npm ci --prefix infra` → `npm test --prefix infra`.

- [ ] **Step 2: `deploy.yml`**
  - `on: push: branches: [main]`, `workflow_dispatch`.
  - `concurrency: { group: deploy-production, cancel-in-progress: false }`.
  - `permissions: { id-token: write, contents: read }`.
  - 단계: checkout → setup-node(24, npm 캐시) → `npm ci` → `npm test` → `npm run build` → `aws-actions/configure-aws-credentials@v4` (`role-to-assume: ${{ vars.AWS_ROLE_ARN }}`, `aws-region: ${{ vars.AWS_REGION }}`) → `bash scripts/deploy.sh` (env `S3_BUCKET: ${{ vars.S3_BUCKET }}`, `CLOUDFRONT_DISTRIBUTION_ID: ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }}`).
  - infra 테스트는 여기서 돌리지 않는다 (배포 대상이 아님).

- [ ] **Step 3: 문법 확인**

Run: `npx --yes @action-validator/cli .github/workflows/ci.yml && npx --yes @action-validator/cli .github/workflows/deploy.yml`
Expected: 오류 없음. 이 도구를 쓸 수 없으면 건너뛰고, Task 7 Step 8에서 실제 실행으로 확인한다.

- [ ] **Step 4: Commit**

```bash
git add .github
git commit -m "ci: add PR checks and OIDC-based deploy workflow"
```

---

### Task 8: 무료 도메인 대응 — Route 53 제거, 인증서 수동 DNS 검증 (Task 7보다 먼저)

> 2026-11-06 변경. AWS 프리 플랜에서 Route 53 도메인을 쓸 수 없어 무료 도메인 `aquarium-life.n-e.kr`을 쓴다. DNS 레코드는 사용자가 도메인 서비스 화면에 직접 넣는다. 그 서비스가 도메인 자체 CNAME과 `_`로 시작하는 하위 이름 CNAME을 지원함을 확인했다. 스펙 3.1·3.3 참고.

**Files:**
- Modify: `infra/lib/config.ts`, `infra/lib/certificate-stack.ts`, `infra/lib/site-stack.ts`, `infra/bin/app.ts`, `infra/cdk.json`
- Modify tests: `infra/test/config.test.ts`, `infra/test/certificate-stack.test.ts`, `infra/test/site-stack.test.ts`, `infra/test/github-deploy-stack.test.ts`(픽스처만)

**Interfaces (변경 후):**
```ts
export interface SiteConfig {
  domainName: string;          // "aquarium-life.n-e.kr"
  alertEmail: string;          // 비공개: infra/cdk.context.json 또는 -c 로만
  githubRepo: string;          // 기본값 "zelopy/aquarium-life"
  githubOidcProviderArn?: string;
}
export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;
  constructor(scope: Construct, id: string, props: StackProps & { domainName: string });
}
// SiteStack: props 그대로 { config, certificate }. bucket / distribution 필드 그대로.
// CfnOutput: BucketName, DistributionId, DistributionDomainName(새로), SiteUrl
```

- [ ] **Step 1: 테스트를 먼저 고친다 (RED)**
  - config: `hostedZoneId`를 픽스처와 필수 키 목록에서 뺀다. 필수 키는 `domainName`, `alertEmail` 두 개. `hostedZoneId`를 넘겨도 결과에 들어가지 않는다.
  - certificate: `DomainName = "example.com"`, `ValidationMethod = "DNS"`, `SubjectAlternativeNames` 없음, `DomainValidationOptions` 없음(= 호스팅 영역 자동 검증 없음, 수동 검증).
  - site: `Aliases = ["example.com"]`, `AWS::Route53::RecordSet` 0개, `AWS::Route53::HostedZone` 0개, 출력 `DistributionDomainName` 존재. 나머지 단언(S3·OAC·캐시·헤더·예산)은 그대로.
  - github-deploy: 스택을 만드는 픽스처에서 `hostedZoneId`만 뺀다. 단언은 바꾸지 않는다.

- [ ] **Step 2: `cd infra && npm test` → FAIL (위 단언들)**

- [ ] **Step 3: 구현**
  - `readConfig`: `hostedZoneId` 제거.
  - `CertificateStack`: 호스팅 영역 제거, `acm.Certificate({ domainName, validation: CertificateValidation.fromDns() })` (영역 없이 = 수동 검증).
  - `SiteStack`: 호스팅 영역·Route 53 레코드 제거, `domainNames: [domainName]`, `DistributionDomainName` 출력 추가.
  - `bin/app.ts`: 인증서 스택에 `hostedZoneId` 넘기지 않음.
  - `infra/cdk.json` context에 `"domainName": "aquarium-life.n-e.kr"` 추가. `alertEmail`은 넣지 않는다(비공개 — Task 7에서 `infra/cdk.context.json`에 넣는다. 이 파일은 이미 `.gitignore`에 있다).

- [ ] **Step 4: `cd infra && npm test` → PASS (tsc 포함)**

- [ ] **Step 5: synth 확인**

Run: `cd infra && npx cdk synth -c alertEmail=a@example.com`
Expected: 3개 스택 합성 성공. 템플릿에 `Route53` 리소스 없음, 인증서 `DomainName: aquarium-life.n-e.kr`.
Run: `cd infra && npx cdk synth` (alertEmail 없이) → `alertEmail` 안내 메시지로 실패.

- [ ] **Step 6: Commit**

```bash
git add infra
git commit -m "feat(infra): use external DNS with manual ACM validation for free domain"
```

---

### Task 7: 첫 배포 (사용자와 함께) + 문서

이 태스크는 AWS 계정에 실제 리소스를 만든다. 👤 표시는 사용자가 직접 하는 단계다. Task 8이 끝난 뒤에 한다.

**Files:**
- Create: `infra/cdk.context.json` (git 무시 — `alertEmail`만)
- Modify: `CLAUDE.md`, `docs/progress.md`(git 무시 파일)

- [ ] **Step 1: 비공개 설정** — `infra/cdk.context.json`에 `{ "alertEmail": "<사용자가 알려 준 주소>" }`. `git status`에 나타나지 않는지 확인.
- [ ] **Step 2: 👤 `aws login`** 후 확인: `aws sts get-caller-identity` → 계정 ID 출력.
- [ ] **Step 3: 기존 OIDC 공급자 확인** — `aws iam list-open-id-connect-providers`. GitHub 공급자가 있으면 그 ARN을 `cdk.context.json`의 `githubOidcProviderArn`으로.
- [ ] **Step 4: 부트스트랩과 diff**

Run: `cd infra && npx cdk bootstrap aws://<계정>/ap-northeast-2 aws://<계정>/us-east-1`
Run: `npx cdk diff` → 결과를 사용자에게 보여 주고 승인을 받는다.

- [ ] **Step 5: 인증서 스택 배포 + 👤 검증용 CNAME 입력**

Run (백그라운드): `npx cdk deploy AquariumCertificate --require-approval never`
배포가 인증서 발급을 기다리는 동안 `aws acm list-certificates --region us-east-1`과 `aws acm describe-certificate --region us-east-1 --certificate-arn <arn> --query "Certificate.DomainValidationOptions[0].ResourceRecord"`로 검증 레코드(Name, Value)를 읽어 사용자에게 알려 준다.
👤 도메인 서비스의 별칭(CNAME)에: 앞 칸 = Name에서 `.aquarium-life.n-e.kr.`을 뗀 부분(`_…`), 값 = Value에서 끝 점을 뗀 것.
확인: `nslookup -type=CNAME <Name> 8.8.8.8`이 Value를 돌려주고, 스택이 `CREATE_COMPLETE`가 된다.

- [ ] **Step 6: 나머지 스택 배포**

Run: `npx cdk deploy AquariumSite AquariumGithubDeploy`
Expected: `BucketName`, `DistributionId`, `DistributionDomainName`, `SiteUrl`, `DeployRoleArn` 출력.

- [ ] **Step 7: 👤 사이트 CNAME 입력** — 도메인 서비스의 빈 칸 별칭(CNAME) 값을 `example.com`에서 `DistributionDomainName`(예: `d1234abcd.cloudfront.net`)으로 바꾼다. `_acmtest` 시험 레코드가 남아 있으면 지운다. 확인: `nslookup -type=CNAME aquarium-life.n-e.kr 8.8.8.8`.

- [ ] **Step 8: GitHub 저장소 변수 설정**

```bash
gh variable set AWS_REGION --body ap-northeast-2
gh variable set AWS_ROLE_ARN --body <DeployRoleArn>
gh variable set S3_BUCKET --body <BucketName>
gh variable set CLOUDFRONT_DISTRIBUTION_ID --body <DistributionId>
```

- [ ] **Step 9: 문서**
  - `CLAUDE.md` 명령어에 `npm test`, `npm run deploy`(로컬 수동 배포, 환경 변수 필요), `cd infra && npx cdk deploy --all`(인프라 변경 시, `alertEmail`은 `infra/cdk.context.json`) 추가. "`main`에 push하면 자동 배포된다" 한 줄. "DNS는 무료 도메인 서비스에서 관리하고, 인증서를 바꾸려면 새 인증서를 먼저 만들고 검증 CNAME을 넣은 뒤 교체한다" 한 줄.
  - `docs/progress.md`: 작업 로그, 배포 URL, favicon 404 메모 삭제.
  - Commit: `git add CLAUDE.md && git commit -m "docs: document deploy workflow"`

- [ ] **Step 10: 👤 승인 후 `main` 병합·push, 확인 (스펙 3.9)**

Run: `git push` → `gh run watch`
Expected: deploy 워크플로 성공. 그다음:
- `curl -sI https://aquarium-life.n-e.kr/` → `200`, `cache-control: no-cache`, `strict-transport-security` 있음.
- `curl -sI http://aquarium-life.n-e.kr/` → `301`, `location: https://...`.
- `curl -sI https://aquarium-life.n-e.kr/assets/<해시 파일>` → `cache-control: public,max-age=31536000,immutable`.
- `curl -sI https://<BucketName>.s3.ap-northeast-2.amazonaws.com/index.html` → `403`.
- Playwright로 `https://aquarium-life.n-e.kr/?variants` → 구피 1마리, 이름표 없음, 콘솔 오류 0개.
- 작은 문서 변경으로 PR을 열어 `ci.yml`만 돌고 배포는 안 되는지 확인.
