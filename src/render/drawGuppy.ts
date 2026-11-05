import type { Fish } from "../entities/Fish";
import type { Pattern, TailShape } from "../entities/species/types";
import { seeded, shade } from "./util";

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// 아래 모든 좌표는 "머리가 +x 방향, 몸 중심이 원점, L = 몸길이" 기준이다.

function bodyPath(L: number): Path2D {
  const p = new Path2D();
  p.moveTo(L * 0.38, 0);
  p.bezierCurveTo(L * 0.34, -L * 0.13, L * 0.0, -L * 0.14, -L * 0.2, -L * 0.05);
  p.lineTo(-L * 0.2, L * 0.05);
  p.bezierCurveTo(L * 0.0, L * 0.14, L * 0.34, L * 0.12, L * 0.38, 0);
  p.closePath();
  return p;
}

/** 꼬리 경로. 원점은 꼬리 뿌리, 꼬리는 -x 방향으로 뻗는다. */
function tailPath(shape: TailShape, L: number, scale: number, sway: number) {
  const p = new Path2D();
  const root = L * 0.04;
  const tip = sway * L * 0.03; // 꼬리 끝이 살짝 늦게 따라오는 느낌
  switch (shape) {
    case "round": {
      const len = L * 0.32 * scale;
      const h = L * 0.15 * scale;
      p.moveTo(0, -root);
      p.quadraticCurveTo(-len * 0.4, -h, -len * 0.85, -h * 0.9 - tip);
      p.quadraticCurveTo(-len * 1.12, 0, -len * 0.85, h * 0.9 - tip);
      p.quadraticCurveTo(-len * 0.4, h, 0, root);
      p.closePath();
      return { path: p, len, h };
    }
    case "delta": {
      const len = L * 0.5 * scale;
      const h = L * 0.24 * scale;
      p.moveTo(0, -root);
      p.quadraticCurveTo(-len * 0.5, -h * 0.5, -len, -h - tip);
      p.quadraticCurveTo(-len * 1.12, 0, -len, h - tip);
      p.quadraticCurveTo(-len * 0.5, h * 0.5, 0, root);
      p.closePath();
      return { path: p, len, h };
    }
    case "doubleSword": {
      const len = L * 0.55 * scale;
      const h = L * 0.15 * scale;
      p.moveTo(0, -root);
      p.quadraticCurveTo(-len * 0.5, -h * 0.9, -len, -h * 1.3 - tip); // 위쪽 칼
      p.quadraticCurveTo(-len * 0.6, -h * 0.6, -len * 0.42, -h * 0.25);
      p.quadraticCurveTo(-len * 0.52, 0, -len * 0.42, h * 0.25);
      p.quadraticCurveTo(-len * 0.6, h * 0.6, -len, h * 1.3 - tip); // 아래쪽 칼
      p.quadraticCurveTo(-len * 0.5, h * 0.9, 0, root);
      p.closePath();
      return { path: p, len, h };
    }
  }
}

function between(rand: () => number, a: number, b: number): number {
  return a + rand() * (b - a);
}

/** 이미 clip 된 영역 안에 무늬를 그린다. */
function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: Pattern,
  colors: string[],
  box: Box,
  L: number,
  rand: () => number,
): void {
  if (pattern === "none" || colors.length === 0) return;
  const color = (i: number) => colors[i % colors.length];
  const blob = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  switch (pattern) {
    case "spots":
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = color(i);
        const r = L * between(rand, 0.03, 0.05);
        blob(between(rand, box.x0, box.x1), between(rand, box.y0 * 0.5, box.y1 * 0.5), r, r * 0.7);
      }
      break;
    case "leopard": {
      ctx.globalAlpha = 0.85;
      const area = (box.x1 - box.x0) * (box.y1 - box.y0);
      const count = Math.round(area / (L * L * 0.0022));
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = color(i);
        const r = L * between(rand, 0.012, 0.026);
        blob(between(rand, box.x0, box.x1), between(rand, box.y0, box.y1), r, r * 0.8);
      }
      break;
    }
    case "grass": {
      ctx.globalAlpha = 0.8;
      const area = (box.x1 - box.x0) * (box.y1 - box.y0);
      const count = Math.round(area / (L * L * 0.0009));
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = color(i);
        const r = L * between(rand, 0.007, 0.013);
        blob(between(rand, box.x0, box.x1), between(rand, box.y0, box.y1), r, r);
      }
      break;
    }
    case "mosaic":
      // 꼬리 뿌리(x1 쪽)에 몰리도록 배치
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = color(i);
        const x = box.x1 - Math.pow(rand(), 1.6) * (box.x1 - box.x0) * 0.85;
        const r = L * between(rand, 0.03, 0.06);
        blob(x, between(rand, box.y0, box.y1), r, r * 0.6);
      }
      break;
    case "halfBlack": {
      const grad = ctx.createLinearGradient(L * 0.1, 0, -L * 0.02, 0);
      grad.addColorStop(0, "rgba(0, 0, 0, 0)");
      grad.addColorStop(1, color(0));
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = grad;
      ctx.fillRect(box.x0, box.y0, L * 0.1 - box.x0, box.y1 - box.y0);
      break;
    }
  }
  ctx.restore();
}

export function drawGuppy(ctx: CanvasRenderingContext2D, fish: Fish): void {
  const L = fish.lengthPx;
  const look = fish.variant.appearance;
  const s = look.finScale;
  const [finRoot, finTip] = look.finColors;

  // 방향 전환 시 납작해졌다가 뒤집히되, 완전히 사라지지 않게 최소 폭 유지
  const flip = (fish.facing < 0 ? -1 : 1) * Math.max(0.15, Math.abs(fish.facing));
  const pitch = Math.atan2(fish.vy, Math.abs(fish.vx) + 20) * 0.6;
  const sway = Math.sin(fish.tailPhase);

  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.scale(flip, 1);
  ctx.rotate(pitch);

  // ── 꼬리지느러미 ──
  ctx.save();
  ctx.translate(-L * 0.18, 0);
  ctx.rotate(sway * 0.3);
  const tail = tailPath(look.tailShape, L, s, sway);
  const tailGrad = ctx.createLinearGradient(0, 0, -tail.len, 0);
  tailGrad.addColorStop(0, finRoot);
  tailGrad.addColorStop(1, finTip);
  ctx.shadowColor = "rgba(0, 20, 40, 0.25)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = tailGrad;
  ctx.fill(tail.path);
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.clip(tail.path);
  drawPattern(
    ctx,
    look.tailPattern,
    look.patternColors,
    { x0: -tail.len * 1.15, x1: 0, y0: -tail.h * 1.4, y1: tail.h * 1.4 },
    L,
    seeded(fish.patternSeed + 1),
  );
  // 지느러미 결
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-tail.len * 0.1, 0);
    ctx.lineTo(-tail.len * 1.1, i * tail.h * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // ── 등지느러미 ──
  ctx.fillStyle = finRoot;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(L * 0.05, -L * 0.1);
  ctx.quadraticCurveTo(-L * 0.08, -L * (0.1 + 0.14 * s) + sway * L * 0.015, -L * (0.12 + 0.08 * s), -L * 0.13);
  ctx.lineTo(-L * 0.12, -L * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── 몸통 ──
  const body = bodyPath(L);
  const bodyGrad = ctx.createLinearGradient(0, -L * 0.13, 0, L * 0.13);
  bodyGrad.addColorStop(0, shade(look.bodyColor, look.albino ? -0.08 : -0.25));
  bodyGrad.addColorStop(0.45, look.bodyColor);
  bodyGrad.addColorStop(1, look.bellyColor);
  ctx.shadowColor = "rgba(0, 20, 40, 0.25)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = bodyGrad;
  ctx.fill(body);
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.clip(body);
  const bodyBox: Box = { x0: -L * 0.22, x1: look.bodyPattern === "spots" ? L * 0.1 : L * 0.24, y0: -L * 0.14, y1: L * 0.14 };
  drawPattern(ctx, look.bodyPattern, look.patternColors, bodyBox, L, seeded(fish.patternSeed + 2));
  if (look.metallic) {
    // 헤엄칠 때 살짝 일렁이는 금속 광택
    const shimmer = Math.sin(fish.tailPhase * 0.5) * L * 0.01;
    const sheen = ctx.createLinearGradient(0, -L * 0.13 + shimmer, 0, L * 0.03 + shimmer);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
    sheen.addColorStop(0.45, "rgba(255, 255, 255, 0.65)");
    sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(-L * 0.25, -L * 0.15, L * 0.65, L * 0.2);
  }
  // 아가미 선
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(L * 0.3, 0, L * 0.09, Math.PI * 0.7, Math.PI * 1.3);
  ctx.stroke();
  ctx.restore();

  // ── 가슴지느러미 (덤보는 크게) ──
  const pec = look.bigPectoral ? 2.6 : 1;
  ctx.save();
  ctx.translate(L * 0.17, L * 0.05);
  ctx.rotate(-0.5 + Math.sin(fish.tailPhase * 0.8) * 0.35);
  ctx.fillStyle = finRoot;
  ctx.globalAlpha = look.bigPectoral ? 0.8 : 0.4;
  ctx.beginPath();
  ctx.ellipse(-L * 0.05 * pec, 0, L * 0.05 * pec, L * 0.022 * pec, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.bigPectoral) {
    // 흰 지느러미도 몸과 구분되도록 옅은 윤곽
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = shade(finTip, -0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // ── 눈 (알비노는 빨간 눈) ──
  ctx.fillStyle = look.albino ? "#ffe4e4" : "#ffffff";
  ctx.beginPath();
  ctx.arc(L * 0.27, -L * 0.025, L * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.albino ? "#d4142c" : "#1a1a1a";
  ctx.beginPath();
  ctx.arc(L * 0.28, -L * 0.025, L * 0.024, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
