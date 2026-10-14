import { World } from "./game/world";
import { GameView } from "./render/view";
import { Controls } from "./input";
import { Hud } from "./ui/hud";
import { loadRecord } from "./ui/record";
import { Sound } from "./audio";
import { lockedKeys } from "./core/unlock";
import { clearRun, loadRun, saveRun } from "./ui/save";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const seed = () => Date.now() % 100000;
/** 難易度と、ねこの成長（保存してあるレベル）・解放ずみのもので新しい冒険を作る。 */
const newWorld = (difficulty: number, s = seed(), endless = false) => { const r = loadRecord(); return new World(s, { difficulty: endless ? 1 : difficulty, meta: r.meta, locked: lockedKeys(r.stats), endless }); };
let world = newWorld(1, Number(params.get("seed")) || seed());
const view = new GameView(canvas);
const sound = new Sound();
// スマホは触れるまで音を出せないので、最初の操作で音を使えるようにする
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, () => sound.unlock(), { passive: true });
const hud = new Hud(
  () => world,
  () => { world = newWorld(world.opts.difficulty, seed(), world.opts.endless); world.start(); hud.bagOpen = false; },
  () => { world = newWorld(1); },
  (difficulty, endless) => { world = newWorld(difficulty, Number(params.get("seed")) || seed(), endless); world.start(); },
  () => { const d = loadRun(); if (!d) return; world = World.load(d); world.start(); savedNo = world.saveNo; },
);
/** 途中セーブ: 部屋に入るたびに保存し、冒険が終わったら消す。 */
let savedNo = -1;
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
  const wasOpen = world.doorOpen;
  if (!hud.bagOpen && !hud.paused) world.update(dt, input);
  if (world.phase === "dead" || world.phase === "win") { if (savedNo !== -2) { clearRun(); savedNo = -2; } }
  else if (world.phase !== "intro" && world.checkpoint && world.saveNo !== savedNo) { saveRun(world.checkpoint); savedNo = world.saveNo; }
  // 効果音と曲
  for (const e of world.events) sound.sfx(e);
  if (!wasOpen && world.doorOpen && world.room.kind !== "shop" && world.room.kind !== "special") sound.sfx("door");
  const r = world.room;
  sound.play(world.phase === "intro" ? "title" : r.kind === "final" ? "final" : r.kind === "shop" || r.kind === "special" ? "shop" : r.kind === "boss" ? "boss" : r.season);
  view.render(world, dt);
  hud.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 自動テスト・撮影用のフック
(window as unknown as { __game: unknown }).__game = { get world() { return world; }, view, sound };
hud.onMute = () => { sound.unlock(); sound.toggleMute(); return sound.muted; };
hud.muted = () => sound.muted;
