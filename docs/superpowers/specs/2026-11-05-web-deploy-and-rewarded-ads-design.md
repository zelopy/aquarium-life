# 웹 배포 + 보상형 광고 설계

> 작성: 2026-11-05
> 상태: 설계 확정, 구현 계획 작성 전
> 관련 문서: `docs/design.md`(기획서), `docs/progress.md`(진행 현황)

---

## 1. 목표와 합의 사항

### 1.1 목표
- 불특정 다수가 웹 브라우저에서 게임을 플레이할 수 있게 공개 배포한다.
- 광고를 보면 코인이나 랜덤 아이템을 받는 **보상형 광고**를 넣는다.
- 광고는 사용자가 불편하지 않을 정도로만 노출한다.

### 1.2 합의한 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 대상 연령 | 전 연령 캐주얼 (아이도 플레이) | 규제상 "혼합 대상"으로 보고 아동 보호 기준을 적용한다 |
| 광고 목적 | 서버비 충당 + 게임 안의 재미 요소 | 수익 극대화보다 보상 경험을 우선한다 |
| 도메인 | 무료 도메인 `aquarium-life.n-e.kr` (무료 도메인 서비스, DNS는 그 서비스에서 관리) | AWS 프리 플랜에서 Route 53 도메인 구매를 쓸 수 없음. 2026-11-06 변경 |
| 배포 방식 | S3 + CloudFront + ACM | 정적 사이트라 서버가 필요 없고 거의 무료다. EC2 대신 선택 |
| 인프라 코드 | AWS CDK (TypeScript), `infra/` | 게임과 같은 언어. 다시 만들거나 수정하기 쉽다 |

### 1.3 전제
- 계정이나 서버 저장은 없다. 저장은 계속 각 브라우저의 localStorage에 한다.
- 혼자 하는 게임이므로, 클라이언트에서 저장값을 조작하는 치팅은 막지 않는다.

### 1.4 범위 밖
- 배너 광고, 전면 광고, 자동 재생 광고
- 맞춤형(개인화) 광고
- 서버 측 보상 검증, 계정, 클라우드 저장
- CI에서 인프라(CDK) 배포. 인프라 변경은 로컬에서 한다 (3.4)

---

## 2. 진행 순서

1. **배포 (Part A)**: 지금 바로 진행한다. 현재 MVP 상태 그대로 공개한다.
2. **광고 신청**: 배포가 끝나면 AdSense 계정을 만들고 H5 Games Ads를 신청한다. 승인을 기다리는 동안 MVP 개발을 계속한다.
3. **보상형 광고 (Part B)**: v0.2에서 코인 지갑과 아이템 인벤토리가 생긴 뒤 구현한다.

> Part B는 코인·인벤토리가 있어야 하므로 Part A와 따로 구현 계획을 세운다.

---

## 3. Part A — 배포

### 3.1 구성
```
사용자 → 무료 도메인 DNS (CNAME) → CloudFront (HTTPS, CDN) → S3 (비공개 버킷, dist/)
                               └ ACM 인증서 (us-east-1)
```

| 구성 요소 | 설정 |
|---|---|
| S3 버킷 | 퍼블릭 접근 전면 차단. CloudFront만 OAC(Origin Access Control)로 읽음 |
| CloudFront | HTTP→HTTPS 리디렉션, 압축(gzip/brotli), 기본 문서 `index.html`, HTTP/2·HTTP/3 |
| ACM 인증서 | CloudFront용이므로 **us-east-1**에 발급. `aquarium-life.n-e.kr` 하나. **수동 DNS 검증**: `cdk deploy` 중 ACM이 알려 주는 검증용 CNAME(`_….aquarium-life.n-e.kr`)을 사용자가 도메인 서비스에 입력하고, 발급될 때까지 배포가 대기한다 |
| DNS 연결 | 배포 후 출력되는 CloudFront 주소(`d….cloudfront.net`)를 도메인 서비스에서 `aquarium-life.n-e.kr`의 CNAME 값으로 입력. `www`는 쓰지 않는다 |
| 보안 헤더 | CloudFront 응답 헤더 정책 (HSTS, `X-Content-Type-Options`, `Referrer-Policy`). CSP는 Part B에서 광고 스크립트 도메인을 정한 뒤 추가 |

### 3.2 캐시 정책
| 경로 | 캐시 | 이유 |
|---|---|---|
| `index.html` | `no-cache` (매번 재검증) | 배포하면 바로 새 버전이 보이게 |
| `assets/*` | `max-age=31536000, immutable` | Vite가 파일명에 해시를 붙임 |
| 그 밖의 `public/` 파일 (`ads.txt`, `privacy.html` 등) | `no-cache` | 파일이 작아서 매번 재검증해도 부담이 없고, 규칙이 단순해진다 |

### 3.3 인프라 코드 (`infra/`)
- 게임 코드와 분리된 CDK 앱이다. `package.json`도 따로 둔다.
- 스택 구성
  - `CertificateStack` (us-east-1): ACM 인증서
  - `SiteStack`: S3, CloudFront, 예산 알림 (Route 53 없음)
  - `GithubDeployStack`: GitHub OIDC 공급자 + 배포용 IAM 역할 (3.10)
- 게임 파일 업로드는 CDK가 아니라 배포 스크립트가 한다 (3.4). CDK `BucketDeployment`는 쓰지 않는다. 두 곳에서 같은 버킷을 고치면 서로 덮어쓰기 때문이다.
- 스택 출력값: 버킷 이름, CloudFront 배포 ID, 배포 역할 ARN. GitHub 저장소 변수에 넣는다.
- 도메인 이름과 알림 이메일은 CDK context(`cdk.json`)로 받는다. 코드에 하드코딩하지 않는다.
- DNS 레코드(인증서 검증용 CNAME, 사이트 CNAME)는 CDK 밖에서 사용자가 도메인 서비스 관리 화면에 직접 넣는다. 2026-11-06에 이 서비스가 도메인 자체 CNAME과 밑줄로 시작하는 하위 이름 CNAME을 모두 지원함을 확인했다.
- 설정 값: `domainName`(공개, `cdk.json`), `alertEmail`(**비공개**, git에 올라가지 않는 `infra/cdk.context.json`).

### 3.4 배포 명령
배포를 **인프라**와 **게임 파일** 두 가지로 나눈다.

| 종류 | 언제 | 방법 |
|---|---|---|
| 인프라 | 처음 한 번, 그리고 AWS 구성을 바꿀 때 | 로컬에서 `cd infra && npx cdk deploy --all` |
| 게임 파일 | `main`에 push할 때마다 | GitHub Actions가 자동으로 (3.10) |
| 게임 파일 (수동) | CI가 안 될 때 | 로컬에서 `npm run deploy` |

- 게임 파일 배포 스크립트 `scripts/deploy.sh`를 CI와 로컬이 함께 쓴다.
  1. `aws s3 sync dist/assets s3://<버킷>/assets --cache-control "public,max-age=31536000,immutable"`
  2. `aws s3 sync dist s3://<버킷> --exclude "assets/*" --cache-control "no-cache"` (3.2의 "그 밖의 파일"도 여기 포함. `ads.txt`·`privacy.html`도 자주 바뀌지 않으므로 `no-cache`로 단순화한다)
  3. `aws s3 sync dist s3://<버킷> --delete` 로 지운 파일 정리 (새 파일을 먼저 올린 뒤 지워서, 배포 중에 옛 `index.html`이 없는 파일을 가리키는 일이 없게 한다)
  4. `aws cloudfront create-invalidation --paths "/index.html" "/"`
- 버킷 이름과 배포 ID는 환경 변수(`S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`)로 받는다.
- 처음 한 번은 `cdk bootstrap`이 필요하다 (배포 대상 리전과 us-east-1 둘 다).

### 3.5 함께 처리할 것
- **개발용 기능 끄기**: `?variants` 모드와 `window.game` 노출은 `import.meta.env.DEV`일 때만 켠다. `window.game`은 이미 개발 모드 전용인지 확인한다.
- **비용 알림**: AWS Budgets로 월 $5를 넘으면 이메일 알림.
- **`favicon.ico`**: 공개 사이트이므로 추가한다 (현재 404).
- **정적 파일 자리**: `public/ads.txt`(승인 전에는 빈 파일이거나 생략), `public/privacy.html`(3.6).
- **`index.html` 메타**: `lang="ko"`, `<title>`, `description`, 모바일 `viewport` 확인.

### 3.6 개인정보처리방침 (`privacy.html`)
- 한국어 한 페이지. 게임 화면에 작은 링크를 둔다.
- 내용: 수집하는 개인정보 없음(저장은 브라우저 안에서만), 광고 제공자(Google)가 쓰는 쿠키·식별자, 비맞춤형 광고와 아동 대상 처리, 문의처.
- Part A에서는 광고 내용을 빼고 "수집 정보 없음" 버전으로 먼저 올린다. Part B 때 광고 항목을 추가한다.

### 3.7 예상 비용
| 항목 | 비용 |
|---|---|
| 도메인 | 무료 (서비스의 연장 규칙을 지켜야 함) |
| S3 + CloudFront | 트래픽이 적으면 거의 $0 (CloudFront 무료 한도: 월 1TB 전송) |
| ACM 인증서 | 무료 |

### 3.8 사전 준비 (사용자)
- AWS 계정, 로컬 AWS CLI 인증(`aws login`)
- 무료 도메인 등록 (완료: `aquarium-life.n-e.kr`), 도메인 서비스 관리 화면 접근

### 3.9 확인 방법
- `https://aquarium-life.n-e.kr`에서 게임이 뜨고 구피가 헤엄친다.
- `http://`로 접속하면 HTTPS로 넘어간다.
- S3 객체 URL로 직접 접근하면 거부된다(403).
- 응답 헤더: `index.html`은 `no-cache`, `assets/*`는 `immutable`.
- 프로덕션에서 `?variants`가 동작하지 않는다.
- 콘솔 오류가 없다 (favicon 404 포함).
- 다시 배포한 뒤 새로고침하면 바로 새 버전이 보인다.
- `main`에 push하면 Actions가 성공하고, 몇 분 안에 사이트에 반영된다.
- PR에서는 빌드 검사만 돌고 배포는 하지 않는다.

### 3.10 GitHub Actions 자동 배포
- 저장소: `zelopy/aquarium-life`, 기본 브랜치 `main`
- 워크플로 파일
  - `.github/workflows/ci.yml`: `pull_request` 때 `npm ci` + `npm run build`(타입 검사 포함). AWS 권한 없음.
  - `.github/workflows/deploy.yml`: `main` push와 수동 실행(`workflow_dispatch`) 때 빌드 → AWS 인증 → `scripts/deploy.sh`.
- **AWS 인증은 OIDC로 한다.** 액세스 키를 GitHub에 저장하지 않는다.
  - `aws-actions/configure-aws-credentials`로 역할을 맡는다. 워크플로에 `permissions: id-token: write, contents: read`.
  - 역할 신뢰 정책: `token.actions.githubusercontent.com`, `aud = sts.amazonaws.com`, `sub = repo:zelopy/aquarium-life:ref:refs/heads/main`. **`main` 브랜치에서만** 역할을 맡을 수 있다.
  - 역할 권한 (최소): 사이트 버킷에 대한 `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject`, 해당 배포에 대한 `cloudfront:CreateInvalidation`.
- GitHub 저장소 **변수**(비밀 아님): `AWS_REGION`, `AWS_ROLE_ARN`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`. 값은 CDK 출력에서 가져온다.
- 동시 배포 방지: `concurrency: deploy-production`, 진행 중인 배포는 취소하지 않고 순서대로 처리.
- Node 버전: 24 (로컬과 같게). `actions/setup-node`에서 npm 캐시 사용.
- 액션 버전은 메이저 태그로 고정한다 (예: `@v4`).

---

## 4. Part B — 보상형 광고

### 4.1 원칙
- 광고는 **사용자가 버튼을 눌렀을 때만** 나온다.
- 모든 사용자에게 **비맞춤형 광고 + 아동 대상 처리**를 적용한다. 나이 확인 화면은 두지 않는다.
- 보상은 **하루 5회**까지, 한 번 본 뒤 **5분 쿨다운**. 수치는 `balance.ts`에 둔다.
- 물고기는 보상으로 주지 않는다. 번식과 수집의 가치를 지키기 위해서다.

### 4.2 플레이 흐름
1. HUD에 🎁 버튼. 남은 횟수 "오늘 3/5" 표시. 쿨다운 중에는 남은 시간을 보여 준다.
2. 누르면 확인 창: "짧은 광고를 보면 선물을 받아요" [보기] [다음에].
3. 끝까지 보면 → 보물 상자가 열리는 연출 + 보상 카드 (예: "🪙 20을 받았어요!").
4. 중간에 닫으면 → 보상 없음. "다음에 또 선물 받으러 와요". 횟수는 차감하지 않는다.
5. 광고를 불러올 수 없으면(광고 재고 없음, 광고 차단기, 승인 전) → 버튼을 흐리게 하고 "지금은 선물이 없어요". 횟수는 차감하지 않는다.
6. 광고가 나오는 동안 게임 시간은 멈춘다.

### 4.3 보상표 (초안, `balance.ts`)
| 가중치 | 보상 |
|---|---|
| 60 | 🪙 10~30 (균등) |
| 20 | 타블렛 먹이 ×5 |
| 10 | 애호박 조각 ×3 |
| 7 | 치료약 ×1 |
| 3 | 수초 장식 1개 |

- 아이템 종류와 가격은 v0.2 상점 설계(기획서 11장)를 따른다. 상점 아이템이 바뀌면 이 표도 함께 고친다.
- 등장 확률은 변이 확률과 같은 방식으로 1만 회 시뮬레이션해서 확인한다.

### 4.4 코드 구조
| 파일 | 역할 |
|---|---|
| `src/ads/AdProvider.ts` | 인터페이스. `isReady(): boolean`, `showRewarded(): Promise<"rewarded" \| "dismissed" \| "unavailable">` |
| `src/ads/MockAdProvider.ts` | 개발용 가짜 광고. 3초 카운트다운 오버레이. `?ad=dismiss`, `?ad=unavailable`로 다른 결과를 시험 |
| `src/ads/H5GamesAdProvider.ts` | Google H5 Games Ads(Ad Placement API, `adBreak({ type: "reward" })`)를 감싼다. `beforeReward` → `showAdFn` 호출, `adViewed` → rewarded, `adDismissed` → dismissed, 보상 광고 없음 → unavailable |
| `src/ads/index.ts` | 환경에 따라 제공자 선택 (개발 = Mock, 프로덕션 = H5Games, 승인 전에는 프로덕션에서도 unavailable 처리) |
| `src/systems/RewardSystem.ts` | 하루 횟수, 쿨다운, 보상 뽑기, 지급. 광고 SDK를 모르고 `AdProvider`만 받는다 |
| `src/ui/RewardButton.ts` | 🎁 버튼, 남은 횟수, 확인 창 |
| `src/ui/RewardCard.ts` | 보물 상자 연출 + 보상 카드 |

- 로직(`systems/`), 렌더링(`render/`), UI(`ui/`)를 분리하는 원칙(CLAUDE.md)을 따른다.
- `RewardSystem`은 현재 시각과 난수를 주입받아, 날짜 바뀜·쿨다운·확률을 테스트할 수 있게 한다.

### 4.5 저장
- SaveManager 저장 데이터에 다음을 추가한다.
  ```ts
  rewards: {
    date: string;   // 현실 날짜 "YYYY-MM-DD" (로컬 시간대)
    count: number;  // 그날 받은 횟수
    lastAt: number; // 마지막으로 받은 시각 (ms)
  }
  ```
- 날짜가 바뀌면 `count`를 0으로 되돌린다. 게임 날짜가 아니라 **현실 날짜** 기준이다.

### 4.6 광고 설정
- 비맞춤형 광고 요청과 아동 대상 태그를 모든 요청에 적용한다. 정확한 설정 이름은 구현할 때 Google 공식 문서로 확인한다.
- 승인 전 개발은 Mock 또는 H5 Games Ads 테스트 모드(`data-adbreak-test="on"`)로 한다.
- CSP에 광고 스크립트 도메인을 추가한다 (Part A의 보안 헤더 정책 갱신).

### 4.7 승인 준비
- AdSense 계정 생성 → 사이트(도메인) 등록 → H5 Games Ads 별도 신청.
- 공유 무료 도메인(`*.n-e.kr`)의 하위 주소는 AdSense 승인이 어려울 수 있다. 광고를 신청할 때 유료 도메인으로 옮기는 것을 검토한다. 유료 도메인의 루트에는 CNAME을 걸 수 없으므로, 그때는 CNAME 평탄화를 지원하는 DNS나 Route 53 별칭이 필요하다.
- `ads.txt`에 게시자 ID를 넣는다.
- `privacy.html`에 광고 항목을 추가한다 (3.6).

### 4.8 선행 조건
- 코인 지갑 (v0.2 "상점과 코인 시스템")
- 아이템 인벤토리 (타블렛 먹이, 애호박, 치료약, 장식)
- SaveManager 동작 (MVP "localStorage 저장")

### 4.9 확인 방법
- Mock으로 세 가지 결과(rewarded / dismissed / unavailable)가 각각 올바르게 처리된다.
- 5회를 받으면 버튼이 막히고, 날짜가 바뀌면 다시 열린다.
- 쿨다운 5분 동안 버튼이 막히고 남은 시간이 보인다.
- 보상 확률 1만 회 시뮬레이션이 가중치와 맞는다.
- 새로고침해도 횟수와 쿨다운이 유지된다.
- 광고 차단기를 켠 상태에서 오류 없이 "지금은 선물이 없어요"가 나온다.
- 광고가 나오는 동안 게임 시간이 멈춘다.

---

## 5. 열린 질문
- 배포 리전: 서울(`ap-northeast-2`)을 기본으로 한다. S3 버킷 위치만 정하는 것이고, CloudFront는 전 세계에서 서빙한다.
- H5 Games Ads 승인이 거절되면 대안 (Ad Manager 보상형 광고 등)은 그때 검토한다.
