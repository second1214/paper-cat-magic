// three.js での描画。World の状態を毎フレーム写すだけで、ゲームの判断はしない。
import * as THREE from "three";
import type { World, EnemyType, Room } from "../game/world";
import { CatDoll, type CatState } from "./catDoll";
import { enemyTexture, glowTexture, lureTexture, orbTexture, paperTexture, techTexture } from "./stickers";
import type { Lure } from "../core/wand";
import type { TechFx } from "../core/spells";

/** 紙人形をカメラ側へ少し倒して、見下ろしでも潰れて見えないようにする。 */
const LEAN = 0.42;
const ENEMY_H: Record<EnemyType, number> = { roach: 0.95, mosquito: 0.95, spider: 1.05, hornet: 2.6 };
/** 飛ぶ虫の高さ。 */
const FLY: Partial<Record<EnemyType, number>> = { mosquito: 0.55, hornet: 0.35 };

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  private cat!: CatDoll;
  private roomGroup = new THREE.Group();
  private roomIndex = -1;
  private door!: THREE.Mesh;
  private enemyTex = new Map<EnemyType, THREE.Texture>();
  private enemyMeshes = new Map<number, THREE.Group>();
  private glow = glowTexture();
  private projPool: THREE.Sprite[] = [];
  private enemyShotPool: THREE.Sprite[] = [];
  private orb = orbTexture();
  private fxPool: THREE.Sprite[] = [];
  private techPool: THREE.Sprite[] = [];
  private lurePool: THREE.Sprite[] = [];
  private lureTex = new Map<Lure, THREE.Texture>();
  private techTex = new Map<TechFx, THREE.Texture>();
  private targetMark: THREE.Mesh;
  private aimMark: THREE.Mesh;
  private shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x2b2433);
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(-4, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, far: 40 });
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 1.1));
    this.scene.add(this.roomGroup);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    this.aimMark = ring; this.scene.add(ring);
    // 自動で狙っている虫の足元の印
    const tgt = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85 }));
    tgt.rotation.x = -Math.PI / 2; tgt.position.y = 0.04; this.targetMark = tgt; this.scene.add(tgt);
  }

  async init(base: string) {
    this.cat = await CatDoll.load(base);
    this.cat.group.traverse((o) => { o.castShadow = true; });
    this.scene.add(this.cat.group);
    for (const t of ["roach", "mosquito", "spider", "hornet"] as EnemyType[]) this.enemyTex.set(t, enemyTexture(t));
    for (const l of ["feather", "dragonfly", "tissue"] as Lure[]) this.lureTex.set(l, lureTexture(l));
    for (const t of ["claw", "bite", "hairball", "hiss"] as const) this.techTex.set(t, techTexture(t));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  private buildRoom(room: Room) {
    this.roomGroup.clear();
    const { w, d } = room;
    const floorTex = paperTexture(room.kind === "boss" ? "#d9c7b4" : "#e8dcc6", "rgba(120,90,60,.12)");
    floorTex.repeat.set(w / 2, d / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, d * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.roomGroup.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: room.kind === "boss" ? 0x6d5a7a : 0x8a6f5a, roughness: 0.9 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xf2e6d4, roughness: 1 });
    const wall = (x: number, z: number, sx: number, sz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.9, sz), [wallMat, wallMat, topMat, wallMat, wallMat, wallMat]);
      m.position.set(x, 0.45, z); m.castShadow = true; m.receiveShadow = true; this.roomGroup.add(m);
    };
    const T = 0.5;
    wall(0, -d - T / 2, w * 2 + T * 2, T);          // 奥
    wall(0, d + T / 2, w * 2 + T * 2, T);           // 手前
    wall(-w - T / 2, 0, T, d * 2);                  // 左
    wall(w + T / 2, -(d + 1) / 2, T, d - 1);        // 右（扉の上下）
    wall(w + T / 2, (d + 1) / 2, T, d - 1);
    this.door = new THREE.Mesh(new THREE.BoxGeometry(T * 0.6, 0.9, 2), new THREE.MeshStandardMaterial({ color: 0x5b3a29 }));
    this.door.position.set(w + T / 2, 0.45, 0); this.roomGroup.add(this.door);
    for (const p of room.pillars) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.hw * 2, 1.2, p.hd * 2), [wallMat, wallMat, topMat, wallMat, wallMat, wallMat]);
      m.position.set(p.x, 0.6, p.z); m.castShadow = true; m.receiveShadow = true; this.roomGroup.add(m);
    }
    for (const g of this.enemyMeshes.values()) this.scene.remove(g);
    this.enemyMeshes.clear();
  }

  private enemyCard(type: EnemyType) {
    const tex = this.enemyTex.get(type)!;
    const img = tex.image as HTMLCanvasElement, h = ENEMY_H[type], w = h * img.width / img.height;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: THREE.RGBADepthPacking });
    const g = new THREE.Group(); g.add(m); this.scene.add(g);
    return g;
  }

  private sprite(pool: THREE.Sprite[], i: number, kind: "glow" | "solid" | "sticker" = "glow") {
    if (!pool[i]) {
      const s = new THREE.Sprite(kind === "solid"
        ? new THREE.SpriteMaterial({ map: this.orb, transparent: true, depthWrite: false })
        : kind === "sticker" ? new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 })
        : new THREE.SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.scene.add(s); pool[i] = s;
    }
    pool[i].visible = true;
    return pool[i];
  }

  render(world: World, dt: number) {
    const room = world.room;
    if (room.index !== this.roomIndex) { this.roomIndex = room.index; this.buildRoom(room); }
    this.door.visible = !world.doorOpen;
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
      // 出現中: 小さく半透明から大きくなる
      const appear = e.spawn > 0 ? Math.max(0.05, 1 - e.spawn / 1.0) : 1;
      const squash = e.hurt > 0 ? 0.88 : 1;
      g.scale.set(face * (2 - squash) * appear, squash * appear, 1);
      const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.set(e.spawn > 0 ? 0x888888 : e.hurt > 0 ? 0xff9999 : e.slow > 0 ? 0xc9b6ff : 0xffffff);
    }
    for (const [id, g] of this.enemyMeshes) if (!alive.has(id)) { this.scene.remove(g); this.enemyMeshes.delete(id); }

    // 弾: 猫の技はおもちゃの先の絵＋色の光、虫の攻撃は縁取りのある玉
    let n = 0, m = 0, l = 0;
    const lureTex = this.lureTex.get(world.toy.lure)!;
    for (const pr of world.projectiles) {
      if (pr.owner === "enemy") {
        const s = this.sprite(this.enemyShotPool, m++, "solid");
        s.position.set(pr.pos.x, 0.45, pr.pos.z);
        const k = pr.radius * 2.6; s.scale.set(k, k, k); s.material.color.set(pr.color);
        continue;
      }
      const glow = this.sprite(this.projPool, n++);
      glow.position.set(pr.pos.x, 0.4, pr.pos.z);
      const k = pr.radius * 3.4; glow.scale.set(k, k, k); glow.material.color.set(pr.color); glow.material.opacity = 0.75;
      const lure = this.sprite(this.lurePool, l++, "sticker");
      if (lure.material.map !== lureTex) { lure.material.map = lureTex; lure.material.needsUpdate = true; }
      lure.position.set(pr.pos.x, 0.5, pr.pos.z);
      const img = lureTex.image as HTMLCanvasElement, h = 0.55;
      lure.scale.set(h * img.width / img.height, h, 1);
      lure.material.rotation = Math.atan2(-pr.vel.z, pr.vel.x);   // 飛ぶ向きに回す
    }
    for (let i = n; i < this.projPool.length; i++) this.projPool[i].visible = false;
    for (let i = m; i < this.enemyShotPool.length; i++) this.enemyShotPool[i].visible = false;
    for (let i = l; i < this.lurePool.length; i++) this.lurePool[i].visible = false;

    // エフェクト: 技の絵（爪あと・ガブッ・毛玉・シャー）と光
    n = 0; m = 0;
    for (const f of world.fx) {
      const k = f.t / f.life;
      if (f.kind === "tech" && f.tech && f.tech !== "enemy") {
        const s = this.sprite(this.techPool, m++, "sticker");
        const tex = this.techTex.get(f.tech)!;
        if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
        s.position.set(f.pos.x, 0.8, f.pos.z);
        const pop = k < 0.25 ? 0.6 + k * 2 : 1.1, r = Math.max(0.9, f.radius * 1.3) * pop;
        const img = tex.image as HTMLCanvasElement;
        s.scale.set(r * img.width / img.height, r, 1);
        s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        continue;
      }
      const s = this.sprite(this.fxPool, n++);
      s.position.set(f.pos.x, 0.4, f.pos.z);
      const r = f.radius * 2 * (0.5 + k);
      s.scale.set(r, r, r);
      s.material.color.set(f.color); s.material.opacity = 1 - k;
    }
    for (let i = n; i < this.fxPool.length; i++) this.fxPool[i].visible = false;
    for (let i = m; i < this.techPool.length; i++) this.techPool[i].visible = false;

    // カメラ: 部屋全体が見える距離から見下ろす（縦持ちでは主人公を追う）
    const aspect = this.camera.aspect, tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = aspect >= 1 ? room.w + 0.8 : Math.min(room.w + 0.8, 6.5);
    const dist = Math.max(halfW / (tanV * aspect), (room.d + 1.6) / tanV / 0.92);
    const pitch = THREE.MathUtils.degToRad(56);
    const cx = aspect >= 1 ? 0 : Math.max(-room.w + halfW - 0.8, Math.min(room.w - halfW + 0.8, p.pos.x));
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    this.camera.position.set(cx + sh, Math.sin(pitch) * dist, 0.6 + Math.cos(pitch) * dist);
    this.camera.lookAt(cx, 0, 0.6);
    this.renderer.render(this.scene, this.camera);
  }
}
