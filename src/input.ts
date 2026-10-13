// キーボード＋マウス、タッチ（左手スティック＋攻撃・ダッシュボタン）を Input にまとめる。
import * as THREE from "three";
import type { Input, Vec } from "./game/world";

export class Controls {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, has: false };
  private dashQueued = false;
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private atkHeld = false;
  onToggleBag: () => void = () => {};
  onPause: () => void = () => {};
  /** おもちゃの持ち替え（番号、または -1 で次へ）。 */
  onSwitch: (i: number) => void = () => {};

  constructor(el: HTMLElement, private stickEl: HTMLElement, atkBtn: HTMLElement, dashBtn: HTMLElement) {
    addEventListener("keydown", (e) => {
      if (e.code === "Tab" || e.code === "KeyE") { e.preventDefault(); this.onToggleBag(); return; }
      if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); this.onPause(); return; }
      if (e.code === "KeyQ") { this.onSwitch(-1); return; }
      if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") { this.onSwitch(Number(e.code.slice(5)) - 1); return; }
      if (e.code === "Space" || e.code === "ShiftLeft") { e.preventDefault(); this.dashQueued = true; }
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => { this.keys.clear(); this.mouse.down = false; this.atkHeld = false; });
    el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; } });
    el.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { this.mouse.down = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; } });
    addEventListener("pointerup", (e) => { if (e.pointerType === "mouse") this.mouse.down = false; });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > 20) this.onSwitch(-1); }, { passive: true });

    // 左手: 画面のどこでも、触った所が中心のスティック（ボタン以外）
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (!this.stick) this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
      this.drawStick();
    }, { passive: false });
    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (this.stick?.id === t.identifier) { this.stick.x = t.clientX; this.stick.y = t.clientY; }
      this.drawStick();
    }, { passive: false });
    const end = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (this.stick?.id === t.identifier) this.stick = null; this.drawStick(); };
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);

    // 右手: 攻撃ボタン（押している間）とダッシュボタン
    const hold = (b: HTMLElement, on: (v: boolean) => void) => {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); on(true); b.classList.add("on"); });
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => { on(false); b.classList.remove("on"); });
    };
    hold(atkBtn, (v) => { this.atkHeld = v; });
    hold(dashBtn, (v) => { if (v) this.dashQueued = true; });
  }

  private drawStick() {
    const s = this.stick, el = this.stickEl;
    if (!s) { el.hidden = true; return; }
    el.hidden = false; el.style.left = `${s.ox}px`; el.style.top = `${s.oy}px`;
    const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.min(40, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    (el.firstElementChild as HTMLElement).style.transform = `translate(${Math.cos(a) * l}px, ${Math.sin(a) * l}px)`;
  }

  /** aim が null のときは「一番近い虫を自動で狙う」。 */
  read(camera: THREE.Camera, playerPos: Vec): Input {
    let mx = 0, mz = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz += 1;
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, l = Math.hypot(dx, dy);
      if (l > 6) { const k = Math.min(1, l / 40) / l; mx = dx * k; mz = dy * k; }
    }
    let aim: Vec | null = null, fire = false;
    if (this.atkHeld || this.keys.has("KeyJ") || this.keys.has("KeyK")) fire = true;   // 自動で狙う
    else if (this.mouse.down && this.mouse.has) {
      const ndc = new THREE.Vector2((this.mouse.x / innerWidth) * 2 - 1, -(this.mouse.y / innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit)) aim = { x: hit.x - playerPos.x, z: hit.z - playerPos.z };
      fire = true;
    }
    const dash = this.dashQueued; this.dashQueued = false;
    return { move: { x: mx, z: mz }, aim, fire, dash };
  }
}
