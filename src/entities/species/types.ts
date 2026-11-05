export type ActiveTime = "day" | "night";
export type Zone = "top" | "middle" | "bottom" | "glass";
export type Diet = "flake" | "tablet" | "zucchini" | "algae";
export type DecorationId = "driftwood" | "cave" | "plant";

/** 렌더러가 어떤 모양으로 그릴지 결정하는 키 */
export type BodyShape = "guppy" | "corydoras" | "ancistrus";

// ── 변이 ─────────────────────────────────────────────

export type Rarity = "normal" | "rare" | "unique";

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: "노멀",
  rare: "레어",
  unique: "유니크",
};

/**
 * 무늬 종류
 * - spots: 큼직한 반점 몇 개 (야생형)
 * - leopard: 촘촘한 표범 무늬
 * - grass: 잔 점이 흩뿌려진 무늬 (그라스)
 * - mosaic: 지느러미 뿌리 쪽 얼룩 무늬 (모자이크)
 * - halfBlack: 몸 뒤쪽 절반이 검은색 (하프 블랙)
 */
export type Pattern = "none" | "spots" | "leopard" | "grass" | "mosaic" | "halfBlack";

/** 꼬리 모양: 둥근형 / 부채형(델타) / 위아래로 길게 뻗은 더블소드 */
export type TailShape = "round" | "delta" | "doubleSword";

export interface VariantAppearance {
  bodyColor: string;
  bellyColor: string;
  /** 지느러미 그라데이션 색 (뿌리 → 끝) */
  finColors: [string, string];
  bodyPattern: Pattern;
  tailPattern: Pattern;
  /** 무늬에 쓰는 색 (여러 개면 번갈아 사용) */
  patternColors: string[];
  tailShape: TailShape;
  /** 지느러미 크기 배율 (1 = 기본) */
  finScale: number;
  /** 크게 펄럭이는 가슴지느러미 (덤보 이어) */
  bigPectoral?: boolean;
  /** 금속성 광택 */
  metallic?: boolean;
  /** 알비노: 빨간 눈, 검은 색소 없음 */
  albino?: boolean;
}

export interface VariantConfig {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  appearance: VariantAppearance;
}

// ── 종 ───────────────────────────────────────────────

export interface SpeciesConfig {
  id: string;
  name: string;
  price: number;
  activeTime: ActiveTime;
  zone: Zone[];
  diet: Diet[];
  wasteMultiplier: number;
  requires?: { decoration?: DecorationId[] };
  breeding?: { requires?: DecorationId[]; parentalCare?: "male" | "female"; hatchDays?: number };
  sizeCm: { juvenile: number; adult: number };
  /** 평균 유영 속도 (cm/초) */
  swimSpeedCm: number;
  traits: string[];
  shape: BodyShape;
  variants: VariantConfig[];
}
