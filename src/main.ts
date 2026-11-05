import { Game } from "./game/Game";
import { Renderer } from "./render/Renderer";

const canvas = document.querySelector<HTMLCanvasElement>("#tank");
if (!canvas) throw new Error("#tank 캔버스를 찾을 수 없습니다.");

// 개발용: ?variants 를 붙이면 모든 구피 변이를 이름표와 함께 보여 준다.
const showcase = new URLSearchParams(location.search).has("variants");

const game = new Game({ showcase });
const renderer = new Renderer(canvas, { showLabels: showcase });

// 개발 모드에서만 콘솔 디버깅용으로 노출
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

const fit = () => renderer.resize(game.tank.width, game.tank.height);
fit();
window.addEventListener("resize", fit);

let last = performance.now();
function frame(now: number): void {
  // 탭 전환 등으로 프레임이 크게 밀려도 물고기가 순간이동하지 않도록 제한
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
