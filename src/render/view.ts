// three.js での描画。World の状態を毎フレーム写すだけで、ゲームの判断はしない。
import * as THREE from "three";
import type { World, EnemyType, Room } from "../game/world";
import { CatDoll, type CatState } from "./catDoll";
import { canvasTexture, enemyTexture, glowTexture, orbTexture } from "./stickers";
import { buildRoom, type BuiltRoom } from "./roomBuilder";
import { rewardCanvas, techCanvas } from "../art/items";
import type { TechFx } from "../core/spells";
import type { Season } from "../game/stage";

/** 紙人形をカメラ側へ少し倒して、見下ろしでも潰れて見えないようにする。 */
const LEAN = 0.42;
const ENEMY_H: Record<EnemyType, number> = { roach: 0.95, mosquito: 0.95, spider: 1.0, hornet: 2.4 };
const FLY: Partial<Record<EnemyType, number>> = { mosquito: 0.55, hornet: 0.35 };

/** 季節の舞うもの（花びら・ほたる・落ち葉・雪）。 */
function particleTexture(season: Season) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  if (season === "spring") { g.fillStyle = "#ffc2d6"; g.beginPath(); g.ellipse(32, 32, 26, 14, 0.5, 0, 7); g.fill(); }
  else if (season === "summer") { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,170,1)"); gr.addColorStop(1, "rgba(200,255,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  else if (season === "autumn") { g.fillStyle = "#e8772b"; g.beginPath(); g.moveTo(32, 4); g.lineTo(46, 30); g.lineTo(60, 26); g.lineTo(44, 44); g.lineTo(32, 60); g.lineTo(20, 44); g.lineTo(4, 26); g.lineTo(18, 30); g.closePath(); g.fill(); }
  else { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(32, 32, 16, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  private cat!: CatDoll;
  private room: BuiltRoom | null = null;
  private roomRef: Room | null = null;
  private sun: THREE.DirectionalLight;
  private enemyTex = new Map<EnemyType, THREE.Texture>();
  private enemyMeshes = new Map<number, THREE.Group>();
  private glow = glowTexture();
  private orb = orbTexture();
  private techTex = new Map<TechFx, THREE.Texture>();
  private pools: Record<string, THREE.Sprite[]> = {};
  private numTex = new Map<string, THREE.Texture>();
  private doorIcons: THREE.Sprite[] = [];
  private particles: { s: THREE.Sprite; v: THREE.Vector3; ph: number }[] = [];
  private targetMark: THREE.Mesh;
  private aimMark: THREE.Mesh;
  private shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x2b2433);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.position.set(-4, 12, 6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 4; this.sun.shadow.bias = -0.0005;
    Object.assign(this.sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, far: 40 });
    this.scene.add(this.sun, new THREE.AmbientLight(0xffffff, 1.1));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; this.aimMark = ring; this.scene.add(ring);
    const tgt = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85 }));
    tgt.rotation.x = -Math.PI / 2; tgt.position.y = 0.04; this.targetMark = tgt; this.scene.add(tgt);
  }

  async init(base: string) {
    this.cat = await CatDoll.load(base);
    this.cat.group.traverse((o) => { o.castShadow = true; });
    this.scene.add(this.cat.group);
    for (const t of ["roach", "mosquito", "spider", "hornet"] as EnemyType[]) this.enemyTex.set(t, enemyTexture(t));
    for (const t of ["claw", "bite", "hairball", "hiss"] as const) this.techTex.set(t, canvasTexture(techCanvas(t)));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  private setRoom(room: Room) {
    if (this.room) this.scene.remove(this.room.group);
    for (const s of this.doorIcons) this.scene.remove(s);
    for (const p of this.particles) this.scene.remove(p.s);
    for (const g of this.enemyMeshes.values()) this.scene.remove(g);
    this.enemyMeshes.clear();
    this.room = buildRoom(room.layout, room.theme, room.season);
    this.scene.add(this.room.group);
    this.sun.color.copy(this.room.light);
    this.scene.background = new THREE.Color({ spring: 0x3a2f3f, summer: 0x23343f, autumn: 0x3a2a22, winter: 0x2a3140 }[room.season]);
    // 扉の上のごほうびアイコン
    this.doorIcons = room.doors.map((d) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(rewardCanvas(d.reward)), transparent: true, depthWrite: false }));
      s.position.set(d.pos.x, 1.6, d.pos.z); s.renderOrder = 5;
      this.scene.add(s); return s;
    });
    // 季節の舞うもの
    const tex = particleTexture(room.season);
    this.particles = Array.from({ length: 50 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, blending: room.season === "summer" ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.position.set((Math.random() - 0.5) * room.layout.cols, Math.random() * 4, (Math.random() - 0.5) * room.layout.rows);
      const k = room.season === "summer" ? 0.25 : 0.18; s.scale.set(k, k, k);
      this.scene.add(s);
      return { s, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, room.season === "summer" ? 0 : -0.5 - Math.random() * 0.4, (Math.random() - 0.5) * 0.3), ph: Math.random() * 6 };
    });
  }

  private enemyCard(type: EnemyType) {
    const tex = this.enemyTex.get(type)!;
    const img = tex.image as HTMLCanvasElement, h = ENEMY_H[type], w = h * img.width / img.height;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }));
    m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: THREE.RGBADepthPacking });
    const g = new THREE.Group(); g.add(m); this.scene.add(g);
    return g;
  }

  /** 使い回すスプライト。kind ごとにプールを分ける。 */
  private sprite(kind: string, i: number, make: () => THREE.SpriteMaterial) {
    const pool = (this.pools[kind] ??= []);
    if (!pool[i]) { const s = new THREE.Sprite(make()); this.scene.add(s); pool[i] = s; }
    pool[i].visible = true;
    return pool[i];
  }
  private hideRest(kind: string, n: number) { for (const s of (this.pools[kind] ?? []).slice(n)) s.visible = false; }

  private numberTexture(v: number) {
    const key = String(v);
    let t = this.numTex.get(key);
    if (!t) {
      const c = document.createElement("canvas"); c.width = 128; c.height = 64;
      const g = c.getContext("2d")!;
      g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 9; g.strokeStyle = "#3a1d12"; g.strokeText(key, 64, 34); g.fillStyle = "#fff4c2"; g.fillText(key, 64, 34);
      t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.numTex.set(key, t);
    }
    return t;
  }

  render(world: World, dt: number) {
    const room = world.room;
    if (room !== this.roomRef) { this.roomRef = room; this.setRoom(room); }
    this.room!.doors.forEach((d) => { d.visible = !world.doorOpen; });
    this.doorIcons.forEach((s, i) => {
      s.position.y = 1.6 + Math.sin(world.time * 3 + i) * 0.08;
      (s.material as THREE.SpriteMaterial).opacity = world.doorOpen ? 1 : 0.35;
      const k = world.doorOpen ? 1.05 + Math.sin(world.time * 5 + i) * 0.05 : 0.8; s.scale.set(k, k, 1);
    });
    if (world.events.includes("hurt")) this.shake = 0.25;
    this.shake = Math.max(0, this.shake - dt);

    // 主人公
    const p = world.player, speed = Math.hypot(p.vel.x, p.vel.z);
    let state: CatState = speed > 0.6 ? "walk" : "idle";
    if (p.dash > 0) state = "dash";
    if (p.hurt > 0) state = "hurt";
    if (world.phase === "reward" || world.phase === "win") state = "happy";
    if (world.phase === "dead") state = "down";
    this.cat.group.position.set(p.pos.x, 0, p.pos.z);
    this.cat.group.rotation.x = -LEAN;
    this.cat.update(world.time + 0.0001, state, p.facing, speed, p.iframes > 0 && world.phase === "play" && p.hurt <= 0);
    this.aimMark.position.set(p.pos.x + p.aim.x * 1.6, 0.03, p.pos.z + p.aim.z * 1.6);
    this.aimMark.visible = world.phase === "play";
    const tgt = world.enemies.find((e) => e.id === p.target);
    this.targetMark.visible = !!tgt && world.phase === "play";
    if (tgt) { this.targetMark.position.set(tgt.pos.x, 0.04, tgt.pos.z); const k = tgt.radius * 1.4 + Math.sin(world.time * 8) * 0.05; this.targetMark.scale.set(k, k, k); }

    // 虫
    const alive = new Set<number>();
    for (const e of world.enemies) {
      alive.add(e.id);
      let g = this.enemyMeshes.get(e.id);
      if (!g) { g = this.enemyCard(e.type); this.enemyMeshes.set(e.id, g); }
      const fly = FLY[e.type] ?? 0;
      const bob = fly ? fly + Math.sin(e.t * 8 + e.id) * 0.08 : e.type === "roach" && Math.hypot(e.vel.x, e.vel.z) > 0.5 ? Math.abs(Math.sin(e.t * 30)) * 0.03 : 0;
      g.position.set(e.pos.x, bob, e.pos.z);
      g.rotation.x = -LEAN;
      const face = e.vel.x < -0.1 ? -1 : 1;
      const appear = e.spawn > 0 ? Math.max(0.05, 1 - e.spawn / 1.0) : 1;
      const squash = e.hurt > 0 ? 0.88 : 1;
      g.scale.set(face * (2 - squash) * appear, squash * appear, 1);
      const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.set(e.spawn > 0 ? 0x888888 : e.hurt > 0 ? 0xff9999 : e.slow > 0 ? 0xc9b6ff : 0xffffff);
    }
    for (const [id, g] of this.enemyMeshes) if (!alive.has(id)) { this.scene.remove(g); this.enemyMeshes.delete(id); }

    // 弾: 猫の技はその絵（爪・牙・毛玉・シャー）が飛ぶ。虫の攻撃は縁取りのある玉。
    let nGlow = 0, nTech = 0, nOrb = 0;
    for (const pr of world.projectiles) {
      if (pr.owner === "enemy") {
        const s = this.sprite("orb", nOrb++, () => new THREE.SpriteMaterial({ map: this.orb, transparent: true, depthWrite: false }));
        s.position.set(pr.pos.x, 0.45, pr.pos.z); const k = pr.radius * 2.6; s.scale.set(k, k, k); s.material.color.set(pr.color);
        continue;
      }
      const glow = this.sprite("glow", nGlow++, () => new THREE.SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(pr.pos.x, 0.42, pr.pos.z); const k = pr.radius * 3.2; glow.scale.set(k, k, k); glow.material.color.set(pr.color); glow.material.opacity = 0.6;
      const tex = this.techTex.get(pr.tech);
      if (!tex) continue;
      const s = this.sprite("tech", nTech++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 }));
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      s.position.set(pr.pos.x, 0.55, pr.pos.z);
      const size = 0.5 + pr.radius * 1.2; s.scale.set(size, size, 1);
      s.material.rotation = pr.tech === "hairball" ? world.time * 8 : Math.atan2(-pr.vel.z, pr.vel.x);
    }

    // エフェクト: 当たった技の絵・ダメージの数字・光
    let nHit = 0, nNum = 0, nFx = 0;
    for (const f of world.fx) {
      const k = f.t / f.life;
      if (f.kind === "num" && f.value !== undefined) {
        const s = this.sprite("num", nNum++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
        const tex = this.numberTexture(f.value);
        if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
        s.position.set(f.pos.x + Math.sin(f.value) * 0.2, 1.2 + k * 0.8, f.pos.z); s.scale.set(0.9, 0.45, 1); s.renderOrder = 10;
        s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        continue;
      }
      if (f.kind === "tech" && f.tech && f.tech !== "enemy") {
        const s = this.sprite("hit", nHit++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 }));
        const tex = this.techTex.get(f.tech)!;
        if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
        s.position.set(f.pos.x, 0.8, f.pos.z);
        const r = Math.max(0.8, f.radius * 1.6) * (k < 0.25 ? 0.7 + k * 1.6 : 1.1);
        s.scale.set(r, r, 1);
        s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        continue;
      }
      const s = this.sprite("fx", nFx++, () => new THREE.SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(f.pos.x, 0.4, f.pos.z);
      const r = f.radius * 2 * (0.5 + k);
      s.scale.set(r, r, r); s.material.color.set(f.color); s.material.opacity = 1 - k;
    }
    this.hideRest("orb", nOrb); this.hideRest("glow", nGlow); this.hideRest("tech", nTech);
    this.hideRest("num", nNum); this.hideRest("hit", nHit); this.hideRest("fx", nFx);

    // 季節の舞うもの
    const L = room.layout;
    for (const q of this.particles) {
      q.ph += dt;
      q.s.position.x += (q.v.x + Math.sin(q.ph * 1.3) * 0.25) * dt;
      q.s.position.y += q.v.y * dt;
      q.s.position.z += q.v.z * dt;
      if (room.season === "summer") q.s.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(q.ph * 1.7));
      if (q.s.position.y < 0) { q.s.position.y = 3.5 + Math.random(); q.s.position.x = (Math.random() - 0.5) * L.cols; q.s.position.z = (Math.random() - 0.5) * L.rows; }
      q.s.material.rotation = q.ph;
    }

    // カメラ: 部屋全体が見える距離から見下ろす（縦持ちでは主人公を追う）
    const aspect = this.camera.aspect, tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = aspect >= 1 ? room.w + 0.3 : Math.min(room.w + 0.3, 6.5);
    const distance = Math.max(halfW / (tanV * aspect), (room.d + 1.0) / tanV / 0.92);
    const pitch = THREE.MathUtils.degToRad(56);
    const cx = aspect >= 1 ? 0 : Math.max(-room.w + halfW - 0.3, Math.min(room.w - halfW + 0.3, p.pos.x));
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    this.camera.position.set(cx + sh, Math.sin(pitch) * distance, 0.5 + Math.cos(pitch) * distance);
    this.camera.lookAt(cx, 0, 0.5);
    this.renderer.render(this.scene, this.camera);
  }
}
