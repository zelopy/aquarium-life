// 밸런스 수치는 모두 여기에서 조정한다. (docs/design.md 4.3)

export const BALANCE = {
  /** 게임 1일에 해당하는 현실 시간(초). 게임 1일 = 현실 5분 */
  realSecondsPerGameDay: 300,
  /** 시작 시각 (게임 시) */
  startHour: 8,
  /** 낮 시작 / 밤 시작 (게임 시) */
  dayStartHour: 6,
  nightStartHour: 19,
  /** 시작할 때 받는 구피 수 (기획서 2장). 변이는 마리마다 따로 뽑는다 */
  startGuppyCount: 2,
  /** 변이 등급별 등장 가중치 (상점·초기 지급 시) */
  variantRarityWeights: { normal: 70, rare: 25, unique: 5 },
  /** 먹이 주기 (수면 플레이크) */
  feeding: {
    /** 포만감이 게임 1시간마다 줄어드는 양 (24게임시에 100 -> 0) */
    fullnessDecayPerGameHour: 100 / 24,
    /** 새로 태어나거나 시작할 때의 포만감 */
    startFullness: 60,
    /** 한 번 뿌릴 때 떨어지는 플레이크 수 */
    flakesPerPinch: 4,
    /** 플레이크가 퍼지는 가로 범위 (px) */
    pinchSpreadPx: 20,
    /** 플레이크 하나를 먹으면 늘어나는 포만감 */
    fullnessPerFlake: 8,
    /** 이 포만감 이상이면 더 먹지 않는다 */
    fullThreshold: 90,
    /** 플레이크가 가라앉는 속도 (cm/초) */
    flakeSinkCm: 1.5,
    /** 바닥에 닿은 플레이크가 사라지기까지 시간 (게임 시) */
    settledLifeGameHours: 6,
    /** 어항 안 플레이크 최대 개수 */
    maxFlakes: 40,
    /** 먹이를 쫓을 때 평소 속도에 곱하는 배율 */
    chaseSpeedFactor: 1.3,
    /** 입이 이 거리(px) 안에 들면 먹는다 */
    eatRadiusPx: 8,
    /** 수면 아래 이 깊이(px)까지 누르면 먹이를 준다 */
    feedingZoneDepthPx: 60,
  },
} as const;

/** 화면 표현 관련 수치 */
export const VIEW = {
  /** 논리 해상도 (캔버스는 이 비율을 유지하며 화면에 맞춰 확대) */
  width: 960,
  height: 600,
  /** 1cm 당 픽셀 수. 물고기 크기 계산에 사용 */
  pxPerCm: 11,
  /** 수면 위치 (위쪽 공기층 높이) */
  surfaceY: 48,
  /** 바닥 모래 두께 */
  sandHeight: 70,
} as const;
