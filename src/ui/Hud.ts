// 수조 위에 겹쳐 보이는 HTML 오버레이 (일차·시각)
import type { Clock } from '../game/Clock';
import { formatClock } from './formatClock';

const BASE_FONT_PX = 16;

export class Hud {
  private readonly el: HTMLDivElement;
  private lastText = '';

  constructor(stage: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.style.fontSize = `${BASE_FONT_PX}px`;
    stage.appendChild(this.el);
  }

  update(clock: Clock): void {
    const text = formatClock(clock.day, clock.hour, clock.isNight);
    if (text !== this.lastText) {
      this.lastText = text;
      this.el.textContent = text;
    }
  }

  resize(scale: number): void {
    this.el.style.fontSize = `${BASE_FONT_PX * scale}px`;
  }
}
