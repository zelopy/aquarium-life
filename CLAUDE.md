# aquarium-life

물고기 키우기 수족관 웹 게임. 전체 기획은 `docs/design.md` 참고.

## 개발 현황
- 진행 상황·주요 결정·다음 할 일은 `docs/progress.md`에 있다. **작업 시작 전에 먼저 읽는다.**
- 작업을 마치면 `docs/progress.md`의 체크리스트와 작업 로그를 갱신한다.
- 개발용: `http://localhost:5173/?variants` 로 열면 구피 변이 전체를 이름표와 함께 볼 수 있다.

## 기술 스택
- HTML5 Canvas 2D + TypeScript
- Vite (개발 서버 / 빌드)
- 저장: localStorage (MVP)

## 명령어
- `npm install`
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm test` — 단위 테스트 (`src/**/*.test.ts`)
- `npm run test:deploy` — 배포 스크립트 테스트

## 배포
- 사이트: https://aquarium-life.n-e.kr (S3 + CloudFront, 서울 리전). 설계는 `docs/superpowers/specs/2026-11-05-web-deploy-and-rewarded-ads-design.md`.
- **`main`에 push하면 GitHub Actions가 자동 배포한다.** PR에서는 테스트만 돈다.
- 로컬 수동 배포: `S3_BUCKET=... CLOUDFRONT_DISTRIBUTION_ID=... npm run deploy` (AWS 로그인 필요).
- 인프라 변경: `cd infra && npm test && npx cdk deploy --all`. `alertEmail`은 git에 올라가지 않는 `infra/cdk.context.json`에 있다 (공개 금지).
- AWS 작업은 IAM 사용자 `aquarium-operator`로 `aws login` 해서 한다 (루트 사용 금지). 권한: CDK 부트스트랩 역할 맡기, 사이트 버킷 배포·캐시 무효화, 콘솔 조회(정책 `AquariumOperatorAccess`). IAM 변경이 필요하면 루트로 따로 한다.
- DNS는 무료 도메인 서비스에서 직접 관리한다 (Route 53 없음). 인증서를 바꿀 때는 새 인증서의 검증 CNAME을 먼저 넣고 발급된 뒤 교체한다.

## 구조 원칙
- 디렉터리 구조는 `docs/design.md` 13.1을 따른다.
- 물고기 종은 `src/entities/species/`에 데이터(`SpeciesConfig`)로 정의하고, 종별 동작 차이는 `traits`로 표현한다. 종마다 클래스를 만들지 않는다.
- 게임 로직(`game/`, `systems/`)과 렌더링(`render/`), UI(`ui/`)를 분리한다.
- 밸런스 수치는 한곳(`src/game/balance.ts`)에 모아 조정하기 쉽게 한다.

## 현재 목표: MVP (v0.1)
- 어항 1개, 물고기 3종(구피, 코리도라스, 안시)
- 먹이(수면 / 바닥), 물갈이, 수질·이끼 게이지
- 낮/밤 전환 (안시 야행성)
- 유목 장식, 물고기 클릭 시 상태 표시
- 물고기 이름 짓기, 감정 표현 아이콘
- localStorage 저장

## 규칙
- 아이와 함께 플레이하므로 기본 모드에서 물고기는 죽지 않고 "아파요" 상태가 된다.
- UI 텍스트는 한국어.
