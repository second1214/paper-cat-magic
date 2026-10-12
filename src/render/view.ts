// three.js での描画。World の状態を毎フレーム写すだけで、ゲームの判断はしない。
import * as THREE from "three";
import type { World, EnemyType, Room } from "../game/world";
import { CatDoll, type CatState } from "./catDoll";
import { enemyTexture, glowTexture, orbTexture, paperTexture } from "./stickers";

/** 紙人形をカメラ側へ少し倒して、見下ろしでも潰れて見えないようにする。 */
const LEAN = 0.42;
const ENEMY_H: Record<EnemyType, number> = { slime: 0.85, bat: 0.75, wisp: 1.0, golem: 2.6 };

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
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
  }

  async init(base: string) {
    this.cat = await CatDoll.load(base);
    this.cat.group.traverse((o) => { o.castShadow = true; });
    this.scene.add(this.cat.group);
    for (const t of ["slime", "bat", "wisp", "golem"] as EnemyType[]) this.enemyTex.set(t, enemyTexture(t));
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

  private sprite(pool: THREE.Sprite[], i: number, solid = false) {
    if (!pool[i]) {
      const s = new THREE.Sprite(solid
        ? new THREE.SpriteMaterial({ map: this.orb, transparent: true, depthWrite: false })
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

    // 敵
    const alive = new Set<number>();
    for (const e of world.enemies) {
      alive.add(e.id);
      let g = this.enemyMeshes.get(e.id);
      if (!g) { g = this.enemyCard(e.type); this.enemyMeshes.set(e.id, g); }
      const hop = e.type === "slime" ? Math.max(0, Math.sin((e.t % 1.1) / 0.45 * Math.PI)) * 0.25 * (e.t % 1.1 < 0.45 ? 1 : 0)
        : e.type === "bat" ? 0.5 + Math.sin(e.t * 9) * 0.08 : e.type === "wisp" ? 0.15 + Math.sin(e.t * 2) * 0.06 : 0;
      g.position.set(e.pos.x, hop, e.pos.z);
      g.rotation.x = -LEAN;
      const face = e.vel.x < -0.1 ? -1 : 1;
      const squash = e.hurt > 0 ? 0.88 : 1;
      g.scale.set(face * (2 - squash), squash, 1);
      const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.set(e.hurt > 0 ? 0xff9999 : e.slow > 0 ? 0xb8e2ff : 0xffffff);
    }
    for (const [id, g] of this.enemyMeshes) if (!alive.has(id)) { this.scene.remove(g); this.enemyMeshes.delete(id); }

    // 弾
    // 弾: 自分の弾は光、敵の弾は縁取りのある玉（見分けやすさ優先）
    let n = 0, m = 0;
    for (const pr of world.projectiles) {
      const enemy = pr.owner === "enemy";
      const s = enemy ? this.sprite(this.enemyShotPool, m++, true) : this.sprite(this.projPool, n++);
      s.position.set(pr.pos.x, 0.45, pr.pos.z);
      const k = pr.radius * (enemy ? 2.6 : 4);
      s.scale.set(k, k, k);
      s.material.color.set(pr.color);
    }
    for (let i = n; i < this.projPool.length; i++) this.projPool[i].visible = false;
    for (let i = m; i < this.enemyShotPool.length; i++) this.enemyShotPool[i].visible = false;

    // エフェクト
    n = 0;
    for (const f of world.fx) {
      const s = this.sprite(this.fxPool, n++), k = f.t / f.life;
      s.position.set(f.pos.x, 0.4, f.pos.z);
      const r = f.radius * 2 * (f.kind === "boom" ? 0.6 + k * 0.6 : 0.5 + k);
      s.scale.set(r, r, r);
      s.material.color.set(f.color); s.material.opacity = 1 - k;
    }
    for (let i = n; i < this.fxPool.length; i++) this.fxPool[i].visible = false;

    // カメラ: 斜め上から主人公を追う（部屋の端では止める）
    const cx = Math.max(-room.w + 4, Math.min(room.w - 4, p.pos.x));
    const cz = Math.max(-room.d + 2, Math.min(room.d - 2, p.pos.z)) * 0.5;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    this.camera.position.set(cx + sh, 8.6, cz + 7.4);
    this.camera.lookAt(cx, 0.3, cz + 0.2);
    this.renderer.render(this.scene, this.camera);
  }
}
