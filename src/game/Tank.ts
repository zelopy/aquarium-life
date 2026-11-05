import { VIEW } from "./balance";
import type { Zone } from "../entities/species/types";

export interface VerticalRange {
  top: number;
  bottom: number;
}

/** 어항: 크기와 수질·수온·이끼 상태 */
export class Tank {
  readonly width = VIEW.width;
  readonly height = VIEW.height;
  readonly surfaceY = VIEW.surfaceY;
  readonly floorY = VIEW.height - VIEW.sandHeight;
  /** 물고기가 유리벽에 붙지 않도록 두는 여백 */
  readonly wallMargin = 30;

  waterQuality = 100;
  temperature = 25;
  algae = 0;

  /** 서식 위치(zone)에 해당하는 세로 범위 */
  zoneRange(zone: Zone): VerticalRange {
    const water = this.floorY - this.surfaceY;
    const at = (ratio: number) => this.surfaceY + water * ratio;
    switch (zone) {
      case "top":
        return { top: at(0.08), bottom: at(0.35) };
      case "middle":
        return { top: at(0.25), bottom: at(0.7) };
      case "bottom":
        return { top: at(0.82), bottom: at(0.95) };
      case "glass":
        return { top: at(0.1), bottom: at(0.95) };
    }
  }
}
