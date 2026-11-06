import { Game } from "./game/Game";
import { Renderer } from "./render/Renderer";
import { Hud } from "./ui/Hud";
import { parseDevFlags } from "./devFlags";

const canvas = document.querySelector<HTMLCanvasElement>("#tank");
if (!canvas) throw new Error("#tank 캔버스를 찾을 수 없습니다.");

// 개발 모드 전용: ?variants 를 붙이면 모든 구피 변이를 이름표와 함께 보여 준다.
const { showcase } = parseDevFlags(location.search, import.meta.env.DEV);

const stage = document.querySelector<HTMLElement>("#stage");
if (!stage) throw new Error("#stage 요소를 찾을 수 없습니다.");

const game = new Game({ showcase });
const renderer = new Renderer(canvas, { showLabels: showcase });

// 개발 모드에서만 콘솔 디버깅용으로 노출
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

const hud = new Hud(stage);

const fit = () => hud.resize(renderer.resize(game.tank.width, game.tank.height));
fit();
window.addEventListener("resize", fit);

// 수면 띠를 누르면 먹이를 준다.
canvas.addEventListener("pointerdown", (e) => {
  const { x, y } = renderer.toLogical(e.clientX, e.clientY);
  if (game.tank.isFeedingZone(y)) game.dropFood(x);
});
canvas.addEventListener("pointermove", (e) => {
  const { y } = renderer.toLogical(e.clientX, e.clientY);
  canvas.style.cursor = game.tank.isFeedingZone(y) ? "pointer" : "";
});

let last = performance.now();
function frame(now: number): void {
  // 탭 전환 등으로 프레임이 크게 밀려도 물고기가 순간이동하지 않도록 제한
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.render(game);
  hud.update(game.clock);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
