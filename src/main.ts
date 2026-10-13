import { World } from "./game/world";
import { GameView } from "./render/view";
import { Controls } from "./input";
import { Hud } from "./ui/hud";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
let world = new World(Number(params.get("seed")) || Date.now() % 100000);
const view = new GameView(canvas);
const hud = new Hud(
  () => world,
  () => { world = new World(Date.now() % 100000); world.start(); hud.bagOpen = false; },
  () => { world = new World(Date.now() % 100000); },
);
const controls = new Controls(canvas, document.getElementById("stick")!, document.getElementById("atkBtn")!, document.getElementById("dashBtn")!);
controls.onToggleBag = () => hud.toggleBag();
controls.onPause = () => hud.togglePause();
controls.onSwitch = (i) => { if (hud.bagOpen || hud.paused) return; world.switchToy(i < 0 ? (world.cur + 1) % world.toys.length : i); };

const fit = () => view.resize(innerWidth, innerHeight);
addEventListener("resize", fit); fit();

await view.init(import.meta.env.BASE_URL);
document.getElementById("loading")!.remove();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const input = controls.read(view.camera, world.player.pos);
  if (!hud.bagOpen && !hud.paused) world.update(dt, input);
  view.render(world, dt);
  hud.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 自動テスト・撮影用のフック
(window as unknown as { __game: unknown }).__game = { get world() { return world; }, view };
