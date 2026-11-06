import type { Game } from "../game/Game";
import type { Tank } from "../game/Tank";
import type { Fish } from "../entities/Fish";
import { RARITY_LABEL, type Rarity } from "../entities/species/types";
import { drawFood } from "./drawFood";
import { drawGuppy } from "./drawGuppy";
import { toLogical } from "./coords";
import { seeded } from "./util";

const RARITY_COLOR: Record<Rarity, string> = {
  normal: "#e6eef2",
  rare: "#7cc4ff",
  unique: "#ffd24a",
};

export interface RendererOptions {
  /** 개발용: 물고기 위에 등급·변이 이름 표시 */
  showLabels?: boolean;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private logicalWidth = 1;
  private logicalHeight = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RendererOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D 컨텍스트를 만들 수 없습니다.");
    this.ctx = ctx;
  }

  /** 논리 해상도를 유지하며 창 크기에 맞춰 캔버스를 확대한다. */
  resize(logicalWidth: number, logicalHeight: number): number {
    const margin = 24;
    const scale = Math.min(
      (window.innerWidth - margin * 2) / logicalWidth,
      (window.innerHeight - margin * 2) / logicalHeight,
    );
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(logicalWidth * scale));
    const cssH = Math.max(1, Math.floor(logicalHeight * scale));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    const k = (cssW * dpr) / logicalWidth;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    return cssW / logicalWidth;
  }

  /** 화면 좌표를 논리 좌표로 바꾼다. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return toLogical(
      clientX,
      clientY,
      this.canvas.getBoundingClientRect(),
      this.logicalWidth,
      this.logicalHeight,
    );
  }

  render(game: Game): void {
    const { ctx } = this;
    const tank = game.tank;
    if (!this.background) this.background = this.buildBackground(tank);

    ctx.drawImage(this.background, 0, 0, tank.width, tank.height);
    this.drawLightRays(tank, game.elapsed);
    for (const food of game.foods) drawFood(ctx, food);
    for (const fish of game.fishes) this.drawFish(fish);
    this.drawSurface(tank, game.elapsed);
    this.drawGlass(tank);
    if (this.options.showLabels) for (const fish of game.fishes) this.drawLabel(fish);
  }

  // ── 배경 (정적 부분은 한 번만 그려 둔다) ─────────────────────────

  private buildBackground(tank: Tank): HTMLCanvasElement {
    const scale = 2; // 확대해도 선명하도록 2배로 그려 둔다
    const off = document.createElement("canvas");
    off.width = tank.width * scale;
    off.height = tank.height * scale;
    const c = off.getContext("2d")!;
    c.scale(scale, scale);

    // 수면 위 공기층
    const air = c.createLinearGradient(0, 0, 0, tank.surfaceY);
    air.addColorStop(0, "#dfeef2");
    air.addColorStop(1, "#c4e2ea");
    c.fillStyle = air;
    c.fillRect(0, 0, tank.width, tank.surfaceY);

    // 물: 위는 밝고 아래로 갈수록 깊은 색
    const water = c.createLinearGradient(0, tank.surfaceY, 0, tank.floorY);
    water.addColorStop(0, "#4fb6c9");
    water.addColorStop(0.55, "#2a83a6");
    water.addColorStop(1, "#1b5a7e");
    c.fillStyle = water;
    c.fillRect(0, tank.surfaceY, tank.width, tank.floorY - tank.surfaceY + 20);

    // 바닥 가까이 물이 살짝 어두워지도록 (모래보다 먼저 그린다)
    const blend = c.createLinearGradient(0, tank.floorY - 40, 0, tank.floorY + 10);
    blend.addColorStop(0, "rgba(14, 55, 80, 0)");
    blend.addColorStop(1, "rgba(14, 55, 80, 0.35)");
    c.fillStyle = blend;
    c.fillRect(0, tank.floorY - 40, tank.width, 60);

    // 바닥 모래: 완만한 둔덕 모양
    const sandTop = (x: number) =>
      tank.floorY + 6 * Math.sin((x / tank.width) * Math.PI * 2 + 0.8) - 4;
    c.beginPath();
    c.moveTo(0, tank.height);
    for (let x = 0; x <= tank.width; x += 8) c.lineTo(x, sandTop(x));
    c.lineTo(tank.width, tank.height);
    c.closePath();
    const sand = c.createLinearGradient(0, tank.floorY - 10, 0, tank.height);
    sand.addColorStop(0, "#d9c39a");
    sand.addColorStop(1, "#a88a5e");
    c.fillStyle = sand;
    c.fill();

    // 자갈
    const rnd = seeded(20261105);
    const pebbleColors = ["#8d7a62", "#b8a284", "#6f6457", "#cbb796", "#9a8670"];
    for (let i = 0; i < 160; i++) {
      const x = rnd() * tank.width;
      const yTop = sandTop(x) + 6;
      const depth = Math.pow(rnd(), 0.7);
      const y = yTop + depth * (tank.height - yTop - 4);
      const r = 1.5 + rnd() * 3.5 * (depth + 0.4);
      c.fillStyle = pebbleColors[Math.floor(rnd() * pebbleColors.length)];
      c.beginPath();
      c.ellipse(x, y, r * 1.3, r, rnd() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }

    return off;
  }

  /** 수면에서 비스듬히 내려오는 빛줄기 */
  private drawLightRays(tank: Tank, t: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rays = [
      { x: 140, w: 70, phase: 0 },
      { x: 330, w: 45, phase: 1.7 },
      { x: 520, w: 90, phase: 3.1 },
      { x: 760, w: 55, phase: 4.4 },
    ];
    for (const ray of rays) {
      const sway = Math.sin(t * 0.25 + ray.phase) * 25;
      const alpha = 0.05 + 0.035 * Math.sin(t * 0.4 + ray.phase * 2);
      const grad = ctx.createLinearGradient(0, tank.surfaceY, 0, tank.floorY);
      grad.addColorStop(0, `rgba(255, 255, 230, ${alpha})`);
      grad.addColorStop(1, "rgba(255, 255, 230, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(ray.x + sway, tank.surfaceY);
      ctx.lineTo(ray.x + sway + ray.w, tank.surfaceY);
      ctx.lineTo(ray.x + sway * 2 + ray.w * 2.2 - 60, tank.floorY);
      ctx.lineTo(ray.x + sway * 2 - 60, tank.floorY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** 출렁이는 수면 */
  private drawSurface(tank: Tank, t: number): void {
    const { ctx } = this;
    const waveY = (x: number) =>
      tank.surfaceY + Math.sin(x * 0.02 + t * 1.2) * 2 + Math.sin(x * 0.047 - t * 0.8) * 1.2;
    const traceWave = () => {
      ctx.moveTo(0, waveY(0));
      for (let x = 10; x <= tank.width; x += 10) ctx.lineTo(x, waveY(x));
    };

    ctx.save();
    // 수면 아래 밝은 띠
    ctx.beginPath();
    traceWave();
    ctx.lineTo(tank.width, tank.surfaceY + 18);
    ctx.lineTo(0, tank.surfaceY + 18);
    ctx.closePath();
    const band = ctx.createLinearGradient(0, tank.surfaceY, 0, tank.surfaceY + 18);
    band.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    band.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = band;
    ctx.fill();

    // 수면 선
    ctx.beginPath();
    traceWave();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** 유리 반사와 테두리 */
  private drawGlass(tank: Tank): void {
    const { ctx } = this;
    ctx.save();
    const shine = ctx.createLinearGradient(0, 0, tank.width * 0.35, tank.height);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.10)");
    shine.addColorStop(0.4, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, tank.width, tank.height);

    ctx.strokeStyle = "#2c3a44";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, tank.width - 10, tank.height - 10);
    ctx.restore();
  }

  // ── 물고기 ─────────────────────────────────────────────

  private drawFish(fish: Fish): void {
    switch (fish.species.shape) {
      case "guppy":
      default:
        // 코리도라스·안시 모양은 해당 종을 추가할 때 구현
        drawGuppy(this.ctx, fish);
    }
  }

  /** 개발용 이름표: 등급과 변이 이름 */
  private drawLabel(fish: Fish): void {
    const { ctx } = this;
    const { rarity, name } = fish.variant;
    const text = `[${RARITY_LABEL[rarity]}] ${name}`;
    ctx.save();
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillStyle = RARITY_COLOR[rarity];
    const y = fish.y - fish.lengthPx * 0.35;
    ctx.strokeText(text, fish.x, y);
    ctx.fillText(text, fish.x, y);
    ctx.restore();
  }
}
