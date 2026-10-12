// キーボード＋マウス、タッチ（左右2本のスティック）を Input にまとめる。
import * as THREE from "three";
import type { Input, Vec } from "./game/world";

export class Controls {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, has: false };
  private dashQueued = false;
  private touchMove: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private touchAim: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  touchMode = false;
  onToggleBag: () => void = () => {};

  constructor(private el: HTMLElement, private stickL: HTMLElement, private stickR: HTMLElement) {
    addEventListener("keydown", (e) => {
      if (e.code === "Tab" || e.code === "KeyE") { e.preventDefault(); this.onToggleBag(); return; }
      if (e.code === "Space" || e.code === "ShiftLeft") { e.preventDefault(); this.dashQueued = true; }
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => { this.keys.clear(); this.mouse.down = false; });
    el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; } });
    el.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { this.mouse.down = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; } });
    addEventListener("pointerup", (e) => { if (e.pointerType === "mouse") this.mouse.down = false; });
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    el.addEventListener("touchstart", (e) => {
      e.preventDefault(); this.touchMode = true;
      for (const t of Array.from(e.changedTouches)) {
        const s = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
        if (t.clientX < innerWidth / 2) { if (!this.touchMove) this.touchMove = s; }
        else if (!this.touchAim) this.touchAim = s;
      }
      this.drawSticks();
    }, { passive: false });
    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        for (const s of [this.touchMove, this.touchAim]) if (s && s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; }
      }
      this.drawSticks();
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.touchMove?.id === t.identifier) this.touchMove = null;
        if (this.touchAim?.id === t.identifier) {
          // 右スティックを軽くはじいたらダッシュ
          const s = this.touchAim; if (Math.hypot(s.x - s.ox, s.y - s.oy) < 12) this.dashQueued = true;
          this.touchAim = null;
        }
      }
      this.drawSticks();
    };
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
  }

  private drawSticks() {
    const put = (el: HTMLElement, s: typeof this.touchMove) => {
      if (!s) { el.hidden = true; return; }
      el.hidden = false; el.style.left = `${s.ox}px`; el.style.top = `${s.oy}px`;
      const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.min(40, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      (el.firstElementChild as HTMLElement).style.transform = `translate(${Math.cos(a) * l}px, ${Math.sin(a) * l}px)`;
    };
    put(this.stickL, this.touchMove); put(this.stickR, this.touchAim);
  }

  /** カメラと自分の位置から、マウスの指す床の方向を求める。 */
  read(camera: THREE.Camera, playerPos: Vec): Input {
    let mx = 0, mz = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz += 1;
    let aim: Vec | null = null, fire = false;
    if (this.touchMove) {
      const dx = this.touchMove.x - this.touchMove.ox, dy = this.touchMove.y - this.touchMove.oy, l = Math.hypot(dx, dy);
      if (l > 6) { const k = Math.min(1, l / 40) / l; mx = dx * k; mz = dy * k; }
    }
    if (this.touchAim) {
      const dx = this.touchAim.x - this.touchAim.ox, dy = this.touchAim.y - this.touchAim.oy;
      if (Math.hypot(dx, dy) > 12) { aim = { x: dx, z: dy }; fire = true; }
    } else if (this.mouse.has && !this.touchMode) {
      const ndc = new THREE.Vector2((this.mouse.x / innerWidth) * 2 - 1, -(this.mouse.y / innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit)) aim = { x: hit.x - playerPos.x, z: hit.z - playerPos.z };
      fire = this.mouse.down;
    }
    if (this.keys.has("KeyJ") || this.keys.has("KeyK")) fire = true;
    const dash = this.dashQueued; this.dashQueued = false;
    return { move: { x: mx, z: mz }, aim, fire, dash };
  }
}
