# 먹이 주기 + HUD 설계

> 작성일: 2026-11-06
> 범위: MVP "다음 할 일" 1번 — HUD + 먹이 주기 (수면 먹이)
> 관련 기획서: `docs/design.md` 3장(핵심 조작), 4.1·4.3(게이지·밸런스), 12.1(MVP)

## 1. 목표

수면을 클릭하면 먹이 알갱이가 천천히 가라앉고, 배고픈 구피 두 마리가 서로 먹으러 다가가 먹는다. 배부른 구피는 먹이를 무시하므로, 너무 많이 준 먹이는 바닥에 남았다가 서서히 사라진다. 화면 왼쪽 위에는 날짜와 시간이 보인다.

### 1.1 이번 범위에 넣는 것
- 수면 먹이 (클릭 한 번에 한 꼬집)
- 물고기별 포만감과 시간에 따른 감소
- 배고픈 물고기의 먹이 쫓기와 먹기
- 바닥에 남은 먹이가 서서히 사라짐
- HUD: 날짜·시간 표시

### 1.2 이번 범위에서 빼는 것 (담당 단계)
- 바닥 먹이(타블렛·애호박), 바닥 먹이를 먹는 종 → 4단계 (코리도라스·안시)
- 남은 먹이 때문에 수질이 떨어지는 것 → 2단계 (수질·물갈이). 이번에는 남은 먹이 개수를 셀 수 있게만 둔다.
- 💭·💕 감정 아이콘, "아파요" 상태 → 3단계
- 코인 표시 → v0.2. 물갈이 버튼 → 2단계.
- 저장 → 7단계

## 2. 밸런스 값

`src/game/balance.ts`의 `BALANCE.feeding`에 모은다. 값은 플레이해 보며 조정한다.

| 항목 | 이름 | 값 |
|---|---|---|
| 포만감 감소 | `fullnessDecayPerGameHour` | `100 / 24` (게임 하루 = 현실 5분에 100 → 0) |
| 시작 포만감 | `startFullness` | 60 |
| 한 꼬집 알갱이 수 | `flakesPerPinch` | 4 |
| 흩어지는 범위 | `pinchSpreadPx` | ±20px (클릭 지점 기준 가로) |
| 알갱이 1개 포만감 | `fullnessPerFlake` | 8 |
| 먹지 않는 기준 | `fullThreshold` | 90 (포만감이 이 값 이상이면 쫓지도 먹지도 않음) |
| 가라앉는 속도 | `flakeSinkCm` | 1.5cm/초 (× `pxPerCm`, 수면→바닥 약 30초) |
| 바닥에 남는 시간 | `settledLifeGameHours` | 6 (현실 약 75초, 이 동안 점점 투명해짐) |
| 최대 알갱이 수 | `maxFlakes` | 40 |
| 쫓을 때 속도 배율 | `chaseSpeedFactor` | 1.3 |
| 먹었다고 보는 거리 | `eatRadiusPx` | 8 (입 위치 기준) |
| 먹이 주는 수면 띠 깊이 | `feedingZoneDepthPx` | 60 (구현 중 추가. 수면 아래 이 깊이까지 누르면 먹이를 줌) |
| 쫓을 때 감속 거리 | `chaseArriveRadiusPx` | 20 (구현 중 추가. 떠돌기 값 60px·세로 ×0.6로는 가라앉는 알갱이에 약 23px 뒤처져 eatRadius 8px 안에 못 들어 못 먹었음. 쫓는 중에는 20px 안에서만 감속하고 세로 ×0.6도 적용하지 않음) |

기획서 4.3의 "포만감 -10/게임 1시간"은 현실 약 2분 만에 배고파져 아이와 하기에 너무 빠르므로 위 값으로 바꾼다. 기획서 4.3 표도 함께 고친다.

## 3. 구조

CLAUDE.md 원칙에 따라 판단은 `systems/`, 개체 상태는 `entities/`, 그리기는 `render/`, HTML UI는 `ui/`에 둔다.

```
main.ts ── pointerdown ─▶ Renderer.toLogical() ─▶ Game.dropFood(x)
                                                     │
Game.update(dt)                                      ▼
  ├─ clock.update            Game.foods: Food[]
  ├─ food.update (가라앉기·사라지기)
  ├─ feeding.update  ── 포만감 감소, 목표 지정(Fish.chase), 먹기
  └─ fish.update (헤엄)
Renderer.render ─ 배경 → 빛줄기 → 먹이 → 물고기 → 수면 → 유리
Hud.update(clock)  ─ HTML 텍스트 갱신
```

### 3.1 `Food` (`src/entities/Food.ts`)
- 필드: `x`, `y`, `state: "sinking" | "settled"`, `settledHoursLeft`, `spin`(회전 연출용), 흔들림 위상
- `update(dt, tank)`
  - `sinking`: `flakeSinkCm × pxPerCm`로 아래로 이동하고, 가로로 살짝 흔들린다. `tank.floorY - 2`에 닿으면 `settled`가 되고 그 자리에 멈춘다. 모래 경계선이 ±6px 물결 모양이라 일부는 모래에 살짝 묻혀 보일 수 있는데, 이는 허용한다.
  - `settled`: `settledHoursLeft`를 게임 시간만큼 줄인다.
- `get expired`: `settled`이고 남은 시간이 0 이하
- `get opacity`: `sinking`이면 1. `settled`이면 남은 시간 비율에 따라 1 → 0.
- 게임 시간 변환은 `src/game/Clock.ts`에 공용 함수 `gameHours(realSeconds)`로 내보낸다. `Clock.update`도 이 함수를 쓰도록 바꾼다.

### 3.2 `Fish` 변경 (`src/entities/Fish.ts`)
- `fullness: number`: 생성 시 `startFullness`
- `chase(x, y)`: (x, y)는 **입이 닿아야 할 지점**이다. 몸 중심 목표를 `x - facing부호 × lengthPx / 2`, `y`로 잡아서 몸 중심이 아니라 입이 알갱이에 닿게 한다. 속도 배율은 `chaseSpeedFactor`로 둔다.
  - 몸 중심을 알갱이로 보내면, 위아래에서 다가갈 때 입이 가로로 22px 떨어진 채 알갱이 위에 멈춰 영영 먹지 못한다. 그래서 입 기준으로 잡는다.
  - 쫓는 중에는 떠돌기 목표 재선정(목표 도착 `dist < 8`, `retargetTimer` 만료)이 일어나지 않는다.
- `stopChasing(tank)`: 쫓기를 끝내고 바로 새 떠돌기 목표를 고른다. 목표를 고르려면 어항이 필요해 `tank`를 받는다.
- 쫓는 중 방향 전환은 입 보정 목표가 아니라 알갱이가 몸 중심의 어느 쪽에 있는지로 정한다 (6px 데드밴드). 알갱이가 바로 위·아래일 때 좌우로 계속 뒤집히는 것을 막는다.
- `get chasing: boolean`
- `get mouth: { x, y }`: 머리 끝 위치. `x + facing × lengthPx / 2`. `facing`은 방향을 바꾸는 동안 -1~1 사이의 연속값이고, 그림도 이 값으로 좌우가 눌려 그려지므로(`drawGuppy`의 `flip`) 화면상 머리 위치와 맞는다.
- 쫓는 중에는 서식 위치(`zone`) 세로 제한을 받지 않는다. 지금 위치 제한은 수면 아래 10px부터 바닥 위 10px까지다.

### 3.3 `FeedingSystem` (`src/systems/FeedingSystem.ts`)
`update(dt, fishes, foods, tank)`. 상태를 갖지 않는 순수 로직이다.
1. 모든 물고기의 `fullness`를 `fullnessDecayPerGameHour × gameHours(dt)`만큼 줄인다 (최소 0).
2. 각 물고기에 대해:
   - `fullness ≥ fullThreshold`이면 쫓던 중일 때 `stopChasing(tank)`을 부르고 넘어간다.
   - 먹을 수 있는 알갱이 중 입에서 가장 가까운 것을 고른다. 없으면 쫓던 중일 때 `stopChasing(tank)`.
   - 있으면 `chase(알갱이 위치)`를 부른다. 입과 알갱이의 거리가 `eatRadiusPx` 이하이면 알갱이를 목록에서 빼고 `fullness += fullnessPerFlake`를 더한다 (최대 100).
3. "먹을 수 있는 알갱이": 구피는 `state === "sinking"`인 것만 먹는다. 4단계에서 종 `traits`(예: 바닥 먹이를 먹는 종)로 넓힌다.
4. 두 마리가 같은 알갱이를 노려도 괜찮다. 먼저 닿는 쪽이 먹고, 다른 쪽은 다음 프레임에 새 목표를 고른다.

### 3.4 `Game` 변경 (`src/game/Game.ts`)
- `foods: Food[]`, `feeding = new FeedingSystem()`
- `dropFood(x)`: 수면(`tank.surfaceY`)에서 `flakesPerPinch`개의 알갱이를 `x ± pinchSpreadPx` 범위에 만든다. x는 어항 안쪽으로 제한한다. 합계가 `maxFlakes`를 넘으면 `settled` 중 가장 오래된 것부터 지운다. 그래도 넘으면 가라앉는 것 중 가장 오래된 것부터 지운다.
- `update`: `clock` → `foods` 갱신(만료된 것 제거) → `feeding` → `fishes`
- `?variants` 모드에서도 먹이 주기는 동작한다.

### 3.5 입력 (`src/main.ts`, `src/render/Renderer.ts`)
- `Renderer.toLogical(clientX, clientY)`: 캔버스의 `getBoundingClientRect`로 논리 좌표(960×600)를 구한다.
- `Tank.isFeedingZone(y)`: `y < surfaceY + 60`이면 참. 그 아래 물속 클릭은 비워 둔다 (3단계 물고기 클릭, 이후 "유리 톡톡"용).
- 캔버스 `pointerdown`: 수면 띠이면 `game.dropFood(x)`. 마우스와 터치 모두 받는다.
- 캔버스 `pointermove`: 수면 띠 위이면 `cursor: pointer`, 아니면 기본 커서.

### 3.6 그리기 (`src/render/Renderer.ts`)
- 먹이는 배경·빛줄기 다음, 물고기 앞에 그린다. 그래서 물고기가 먹이 앞을 지나가며 먹는 것처럼 보인다.
- 알갱이: 지름 약 4px의 갈색·주황 타원. `spin`으로 살짝 돈다. `opacity`를 알파로 쓴다.
- 그리기 함수는 `src/render/drawFood.ts`로 분리한다 (`drawGuppy.ts`와 같은 방식).

### 3.7 HUD (`src/ui/Hud.ts`)
- 캔버스 위에 겹친 HTML 요소로 만든다. 이후 물갈이 버튼과 이름 입력 칸도 같은 방식으로 붙인다.
- `index.html`: 캔버스를 `#stage`(position: relative) 컨테이너로 감싼다. HUD는 그 안 왼쪽 위에 놓는다.
- 표시 형식: `"{day}일차 {☀️|🌙} {오전|오후} {h}시"`
  - `hour`는 소수일 수 있으므로 내림한다
  - 0시는 "오전 12시", 12시는 "오후 12시", 13시는 "오후 1시"
  - 🌙는 `clock.isNight`일 때
- 문자열 생성은 순수 함수 `formatClock(day, hour, isNight)`로 분리한다. `Hud`는 값이 바뀔 때만 DOM 텍스트를 바꾼다.
- **HUD는 수면 띠 위에 겹치므로 `pointer-events: none`으로 둔다.** 그러지 않으면 HUD 상자 아래 수면을 눌러도 먹이가 떨어지지 않는다. 이후 버튼을 넣을 때는 버튼에만 이벤트를 켠다.
- 글꼴 크기: `Renderer.resize`가 화면 배율(`scale`)을 돌려주고, `main.ts`의 `fit()`이 `hud.resize(scale)`로 넘긴다. 기본 16px × 배율.
- 모양: 반투명 어두운 배경의 둥근 상자에 흰 글씨.

## 4. 테스트

### 4.1 단위 테스트 (vitest)
- `Food.test.ts`: 가라앉음, 바닥에서 `settled`로 바뀜, 게임 6시간 뒤 `expired`, `opacity` 감소
- `FeedingSystem.test.ts`
  - 게임 하루 경과 시 포만감 100 → 0, 0 아래로 내려가지 않음
  - 배고픈 물고기가 가장 가까운 가라앉는 알갱이를 쫓음 (`chasing`과 목표 위치)
  - 바로 위나 아래에 있는 알갱이도 실제로 먹음 (시뮬레이션 루프로 몇 초 돌려 확인, 입 기준 목표 회귀 방지)
  - 입이 닿으면 알갱이가 사라지고 +8, 100을 넘지 않음
  - 포만감 90 이상이면 쫓지 않고, 쫓던 중이면 멈춤
  - `settled` 알갱이는 구피가 먹지 않음
- `Game.test.ts`: `dropFood`로 알갱이 4개 생성, 40개 초과 시 바닥의 오래된 것부터 제거, 시작 포만감 60
- `formatClock.test.ts`: 오전 8시 낮, 밤 🌙, 자정·정오·오후 1시 표기

### 4.2 직접 확인 (Playwright, 개발 서버)
- 수면 클릭 → 알갱이 4개가 떨어지고 구피 두 마리가 먹으러 감
- 배부른 뒤 더 주면 바닥에 남았다가 서서히 사라짐
- 수면 띠에서 커서가 손가락 모양으로 바뀜, HUD 표시, 콘솔 오류 0
- HUD 상자 바로 아래 수면을 눌러도 먹이가 떨어짐
- 스크린샷으로 확인

## 5. 함께 고칠 문서
- `docs/design.md` 4.3: 포만감 감소 값을 "게임 하루에 100 → 0 (약 -4.2 / 게임 1시간)"으로 바꾼다.
- `docs/progress.md`: 체크리스트, 파일별 상태, 결정 사항, 작업 로그
