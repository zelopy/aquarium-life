import type { Food } from "../entities/Food";

const FOOD_FILL = "#c8742c";
const FOOD_OUTLINE = "#8f4f1c";
/** 타원 반지름 (px). 지름 약 4px */
const FOOD_RADIUS_X = 2.2;
const FOOD_RADIUS_Y = 1.5;

export function drawFood(ctx: CanvasRenderingContext2D, food: Food): void {
  ctx.save();
  ctx.globalAlpha = food.opacity;
  ctx.fillStyle = FOOD_FILL;
  ctx.strokeStyle = FOOD_OUTLINE;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(food.x, food.y, FOOD_RADIUS_X, FOOD_RADIUS_Y, food.spin, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
