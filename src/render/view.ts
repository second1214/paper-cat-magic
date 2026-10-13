// three.js での描画。World の状態を毎フレーム写すだけで、ゲームの判断はしない。
import * as THREE from "three";
import { ELITE_INFO, ENEMY, type AltarKind, type World, type EnemyType, type Room } from "../game/world";
import { CatDoll, type CatState } from "./catDoll";
import { canvasTexture, enemyTexture, glowTexture, orbTexture } from "./stickers";
import { buildRoom, type BuiltRoom } from "./roomBuilder";
import { elementCanvas, INK, kibbleCanvas, rewardCanvas, stickerCanvas, techCanvas } from "../art/items";
import type { Element, TechFx } from "../core/spells";
import type { Season } from "../game/stage";

/** 紙人形をカメラ側へ少し倒して、見下ろしでも潰れて見えないようにする。 */
const LEAN = 0.42;
const ENEMY_H: Record<EnemyType, number> = {
  roach: 0.95, mosquito: 0.95, spider: 1.0, hornet: 2.4, stinkbug: 0.95, camel: 1.0, ant: 0.7, caterpillar: 0.95,
  stinkKing: 3.4, camelKing: 3.4, queen: 3.2,   // 王冠のぶん絵が縦長なので大きめ
  mama: 3.8,
};
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

/** 主人公の絵をグレーの猫にしたテクスチャ（友達猫）。 */
async function grayCat(url: string) {
  const img = await new THREE.ImageLoader().loadAsync(url);
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], gg = a[i + 1], b = a[i + 2], l = 0.3 * r + 0.55 * gg + 0.15 * b;
    const warm = r - b > 60;   // 茶色い毛だけグレーに、白い毛はそのまま
    if (warm) { const v = l * 0.62 + 40; a[i] = v; a[i + 1] = v + 4; a[i + 2] = v + 14; }
  }
  g.putImageData(d, 0, 0);
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
  private elemTex = new Map<Element, THREE.Texture>();
  /** 床に寝かせて置く板（糸・ビーム・電撃・衝撃波の輪・爪とぎ）。 */
  private flats: Record<string, THREE.Mesh[]> = {};
  private ringGeo = new THREE.RingGeometry(0.86, 1, 48);
  private planeGeo = new THREE.PlaneGeometry(1, 1);
  private kibble!: THREE.Texture;
  /** 友達猫の歩きコマ（主人公の絵をグレーにしたもの）。 */
  private friendTex: THREE.Texture[] = [];
  private doorIcons: THREE.Sprite[] = [];
  private particles: { s: THREE.Sprite; v: THREE.Vector3; ph: number }[] = [];
  private targetMark: THREE.Mesh;
  private aimMark: THREE.Mesh;
  private shake = 0;
  private camX = 0;
  private camZ = 0;
  private camRoom: Room | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x2b2433);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.position.set(-4, 12, 6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 4; this.sun.shadow.bias = -0.0005;
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 11, bottom: -11, far: 40 });
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
    for (const t of Object.keys(ENEMY) as EnemyType[]) if (t !== "mama") this.enemyTex.set(t, enemyTexture(t));
    const mamaTex = await new THREE.TextureLoader().loadAsync(`${base}mama/walk.png`);   // ニコニコでキャリーを持って歩いてくるママ
    mamaTex.colorSpace = THREE.SRGBColorSpace; this.enemyTex.set("mama", mamaTex);
    this.kibble = canvasTexture(kibbleCanvas());
    for (const t of ["claw", "bite", "hairball", "hiss", "swing", "yarn", "laser", "pounce", "punch", "post", "friend", "roomba", "squirt", "duck", "hammer", "bubble", "flash", "pumpkin", "box", "roller"] as const) this.techTex.set(t, canvasTexture(techCanvas(t)));
    this.friendTex = await Promise.all([1, 2, 3, 4].map((i) => grayCat(`${base}cat/A01_walk_${i}.png`)));
    for (const e of ["static", "wet", "sticky", "repel"] as const) this.elemTex.set(e, canvasTexture(elementCanvas(e)));
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

  private altarTexs = new Map<AltarKind, THREE.Texture>();
  private altarTex(k: AltarKind) {
    let t = this.altarTexs.get(k);
    if (!t) { t = canvasTexture(rewardCanvas(k)); this.altarTexs.set(k, t); }
    return t;
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
  private hideRest(kind: string, n: number) {
    for (const s of (this.pools[kind] ?? []).slice(n)) s.visible = false;
    for (const m of (this.flats[kind] ?? []).slice(n)) m.visible = false;
  }

  /** 床に寝かせた板。geo を変えると輪にもなる。 */
  private flat(kind: string, i: number, make: () => THREE.Mesh) {
    const pool = (this.flats[kind] ??= []);
    if (!pool[i]) { const m = make(); m.rotation.order = "YXZ"; this.scene.add(m); pool[i] = m; }
    pool[i].visible = true;
    return pool[i];
  }

  /** a から b へ床の上に引く帯（糸・ビーム・電撃）。 */
  private ribbon(kind: string, i: number, a: { x: number; z: number }, b: { x: number; z: number }, width: number, color: string, y: number, additive = false) {
    const m = this.flat(kind, i, () => new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })));
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    m.rotation.set(-Math.PI / 2, Math.atan2(-dz, dx), 0);
    m.scale.set(Math.max(0.01, len), width, 1);
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    return m;
  }

  private numberTexture(v: number, color = "#ffffff") {
    const key = `${v}|${color}`;
    let t = this.numTex.get(key);
    if (!t) {
      const c = document.createElement("canvas"); c.width = 128; c.height = 64;
      const g = c.getContext("2d")!;
      g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 9; g.strokeStyle = "#3a1d12"; g.strokeText(String(v), 64, 34); g.fillStyle = color === "#ffffff" ? "#fff4c2" : color; g.fillText(String(v), 64, 34);
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
    if (p.pounce > 0) state = "jump";
    if (p.hurt > 0) state = "hurt";
    if (world.phase === "reward" || world.phase === "win") state = "happy";
    if (world.phase === "dead") state = "down";
    this.cat.group.position.set(p.pos.x, 0, p.pos.z);
    this.cat.group.rotation.x = -LEAN;
    this.cat.update(world.time + 0.0001, state, p.facing, speed, p.iframes > 0 && world.phase === "play" && p.hurt <= 0, 1 - p.pounce / 0.4);
    this.aimMark.position.set(p.pos.x + p.aim.x * 1.6, 0.03, p.pos.z + p.aim.z * 1.6);
    this.aimMark.visible = world.phase === "play";
    const tgt = world.enemies.find((e) => e.id === p.target);
    this.targetMark.visible = !!tgt && world.phase === "play";
    if (tgt) { this.targetMark.position.set(tgt.pos.x, 0.04, tgt.pos.z); const k = tgt.radius * 1.4 + Math.sin(world.time * 8) * 0.05; this.targetMark.scale.set(k, k, k); }

    // 虫
    const alive = new Set<number>();
    let nStat = 0, nAura = 0;
    for (const e of world.enemies) {
      alive.add(e.id);
      let g = this.enemyMeshes.get(e.id);
      if (!g) { g = this.enemyCard(e.type); this.enemyMeshes.set(e.id, g); }
      const fly = FLY[e.type] ?? 0;
      const hop = (e.type === "camel" || e.type === "camelKing") && e.phase > 0 ? Math.sin((e.phase / (e.type === "camel" ? 0.35 : 0.6)) * Math.PI) * (e.type === "camel" ? 0.8 : 1.6) : 0;
      const bob = hop || (fly ? fly + Math.sin(e.t * 8 + e.id) * 0.08 : e.type === "roach" && Math.hypot(e.vel.x, e.vel.z) > 0.5 ? Math.abs(Math.sin(e.t * 30)) * 0.03 : 0);
      g.position.set(e.pos.x, bob, e.pos.z);
      g.rotation.x = -LEAN;
      const face = (e.vel.x < -0.1 ? -1 : 1) * (e.type === "mama" ? -1 : 1);   // ママの絵は左向き
      g.rotation.z = e.type === "mama" && Math.hypot(e.vel.x, e.vel.z) > 0.2 ? Math.sin(e.t * 9) * 0.05 : 0;   // てくてく揺れる
      const appear = e.spawn > 0 ? Math.max(0.05, 1 - e.spawn / 1.0) : 1;
      const squash = e.hurt > 0 ? 0.88 : 1, big = e.elite ? 1.3 : 1;   // 強い虫は大きく、足元が光る
      g.scale.set(face * (2 - squash) * appear * big, squash * appear * big, 1);
      if (e.elite) {
        const a = this.sprite("aura", nAura++, () => new THREE.SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const r = ENEMY_H[e.type] * 1.5 * (1 + Math.sin(world.time * 6 + e.id) * 0.08);
        a.position.set(e.pos.x, ENEMY_H[e.type] * 0.5, e.pos.z - 0.05); a.scale.set(r, r, 1); a.material.color.set(ELITE_INFO[e.elite].color); a.material.opacity = 0.85 * appear;
      }
      const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.set(e.type === "mama" ? (e.hurt > 0 ? 0xffe0e6 : 0xffffff) : e.spawn > 0 ? 0x888888 : e.hurt > 0 ? 0xff9999 : e.sticky > 0 ? 0xe6cf8a : e.wet > 0 ? 0xa8dcff : e.repel > 0 ? 0xc4f0b4 : e.slow > 0 ? 0xc9b6ff : 0xffffff);
      // 属性のしるし（頭の上に並べる）
      const marks: Element[] = [];
      if (e.wet > 0) marks.push("wet");
      if (e.sticky > 0) marks.push("sticky");
      if (e.repel > 0) marks.push("repel");
      marks.forEach((el, k) => {
        const s = this.sprite("status", nStat++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 }));
        const tex = this.elemTex.get(el)!;
        if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
        s.position.set(e.pos.x + (k - (marks.length - 1) / 2) * 0.38, bob + ENEMY_H[e.type] * 0.95 + 0.25, e.pos.z - 0.2); s.scale.set(0.36, 0.36, 1);
      });
    }
    this.hideRest("status", nStat); this.hideRest("aura", nAura);
    for (const [id, g] of this.enemyMeshes) if (!alive.has(id)) { this.scene.remove(g); this.enemyMeshes.delete(id); }

    // 弾: 猫の技はその絵（爪・牙・毛糸玉など）が、技ごとの動きで出る。虫の攻撃は縁取りのある玉。
    let nGlow = 0, nTech = 0, nOrb = 0, nRib = 0, nRing = 0, nPost = 0, nRoomba = 0, nFriend = 0;
    const techSprite = (tech: TechFx, x: number, y: number, z: number, size: number, rot: number, opacity = 1) => {
      const tex = this.techTex.get(tech);
      if (!tex) return;
      const s = this.sprite("tech", nTech++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 }));
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      s.position.set(x, y, z); s.scale.set(size, size, 1); s.material.rotation = rot; s.material.opacity = opacity;
    };
    for (const pr of world.projectiles) {
      if (pr.owner === "enemy") {
        const s = this.sprite("orb", nOrb++, () => new THREE.SpriteMaterial({ map: this.orb, transparent: true, depthWrite: false }));
        const gas = pr.tech === "gas";
        s.position.set(pr.pos.x, gas ? 0.3 : 0.45, pr.pos.z); const k = pr.radius * (gas ? 2.4 : 2.6) * (gas ? 0.9 + 0.1 * Math.sin(world.time * 4 + pr.id) : 1); s.scale.set(k, k, k); s.material.color.set(pr.color);
        s.material.opacity = gas ? Math.min(0.75, pr.life) : 1;
        continue;
      }
      const fade = Math.min(1, pr.life / 0.15);
      const elColor = { none: null, static: "#ffe066", wet: "#74c0fc", sticky: "#e0b552", repel: "#8ce99a" }[pr.element];
      if (pr.motion !== "trap" && pr.motion !== "ring" && (pr.motion !== "summon" || elColor)) {
        const glow = this.sprite("glow", nGlow++, () => new THREE.SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(pr.pos.x, 0.42, pr.pos.z); const k = pr.radius * 3.2 + (elColor ? 0.35 : 0); glow.scale.set(k, k, k);
        glow.material.color.set(elColor ?? pr.color); glow.material.opacity = 0.6 * fade;
      }
      const size = 0.5 + pr.radius * 1.2;
      switch (pr.motion) {
        case "orbit":   // 猫からのびる竿と、回る先っぽ
          this.ribbon("rib", nRib++, p.pos, pr.pos, 0.05, "#8a5a2b", 0.5);
          techSprite(pr.tech, pr.pos.x, 0.55, pr.pos.z, size + 0.15, -pr.ang - Math.PI / 2, fade);
          break;
        case "beam":
          if (pr.tech === "laser") {
            const a = this.ribbon("rib", nRib++, pr.origin, pr.pos, 0.16, elColor ?? "#ff2020", 0.3); (a.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;
            const b = this.ribbon("rib", nRib++, pr.origin, pr.pos, 0.05, "#ffffff", 0.31); (b.material as THREE.MeshBasicMaterial).opacity = fade;
            techSprite("laser", pr.pos.x, 0.12, pr.pos.z, 0.6, 0, fade);
          } else {   // 毛糸: ころがる玉と、のびた糸
            const r = this.ribbon("rib", nRib++, pr.origin, pr.pos, 0.12 + pr.radius * 0.2, elColor ?? "#e64980", 0.08); (r.material as THREE.MeshBasicMaterial).opacity = fade;
            techSprite(pr.tech, pr.pos.x, 0.35 + pr.radius * 0.6, pr.pos.z, size, -pr.t * 12 * Math.sign(pr.dir.x || 1), fade);
          }
          break;
        case "ring": {
          const R = pr.reach * Math.min(1, pr.t / (pr.life0 * 0.75));
          const m = this.flat("ring", nRing++, () => new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })));
          m.position.set(pr.origin.x, 0.06, pr.origin.z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(Math.max(0.05, R), Math.max(0.05, R), 1);
          (m.material as THREE.MeshBasicMaterial).color.set(elColor ?? "#ffc078"); (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
          if (pr.t < 0.15) techSprite(pr.tech, pr.origin.x, 0.3, pr.origin.z, 1.2 + pr.t * 4, 0, 1 - pr.t / 0.15);
          break;
        }
        case "melee": {   // ぺしぺし: 肉球が前方のあちこちに出る
          const ph = Math.floor(pr.t / 0.07);
          const side = { x: -pr.dir.z, z: pr.dir.x }, off = Math.sin(ph * 2.3) * pr.reach * 0.35, fwd = 0.5 + (ph % 3) * 0.15 * pr.reach;
          techSprite(pr.tech, p.pos.x + pr.dir.x * fwd + side.x * off, 0.6, p.pos.z + pr.dir.z * fwd + side.z * off, 0.55 + pr.radius * 0.6, Math.atan2(-pr.dir.z, pr.dir.x), fade);
          break;
        }
        case "summon": {
          const leave = Math.min(1, pr.life / 0.6);   // 消えるときは小さくなる
          if (pr.tech === "roomba") {
            const m = this.flat("roomba", nRoomba++, () => new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: this.techTex.get("roomba"), transparent: true, alphaTest: 0.1 })));
            const k = pr.radius * 2.8 * leave;
            m.position.set(pr.pos.x, 0.12, pr.pos.z); m.rotation.set(-Math.PI / 2, Math.atan2(-pr.vel.z, pr.vel.x), 0); m.scale.set(k, k, 1);
            (m.material as THREE.MeshBasicMaterial).color.set(elColor ? new THREE.Color(elColor).lerp(new THREE.Color("#ffffff"), 0.5) : "#ffffff");
          } else {
            const sp = this.sprite("friend", nFriend++, () => { const m = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.4 }); return m; });
            sp.center.set(0.5, 0);
            const moving = Math.hypot(pr.vel.x, pr.vel.z) > 0.3, ph = (world.time * 3.5 + pr.id) % 4;
            const tex = this.friendTex[moving ? Math.floor(ph) : 0];
            if (tex && sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true; }
            const h = 1.05 * (0.66 + pr.radius) * leave, face = (moving ? pr.vel.x : pr.dir.x) < 0 ? -1 : 1;
            sp.position.set(pr.pos.x, moving ? Math.abs(Math.sin(ph * Math.PI)) * 0.06 : 0, pr.pos.z);
            sp.scale.set(face * h * 1.04, h, 1);
            sp.material.color.set(elColor ? new THREE.Color(elColor).lerp(new THREE.Color("#ffffff"), 0.55) : "#ffffff");
          }
          break;
        }
        case "trap": {   // 床に置いた爪とぎ
          const m = this.flat("post", nPost++, () => new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, depthWrite: false })));
          const ptex = this.techTex.get(pr.tech)!, pm = m.material as THREE.MeshBasicMaterial;
          if (pm.map !== ptex) { pm.map = ptex; pm.needsUpdate = true; }
          const k = pr.radius * 3;
          m.position.set(pr.pos.x, 0.05, pr.pos.z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(k, k, 1);
          (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, pr.life / 0.8);
          (m.material as THREE.MeshBasicMaterial).color.set(elColor ?? "#ffffff");
          break;
        }
        default:
          techSprite(pr.tech, pr.pos.x, 0.55, pr.pos.z, size, pr.tech === "hairball" || pr.tech === "pumpkin" ? world.time * 8 : pr.tech === "bubble" || pr.tech === "duck" ? 0 : Math.atan2(-pr.vel.z, pr.vel.x));
      }
    }

    // カリカリ（お金）とお店のボス猫
    let nKib = 0;
    for (const c of world.pickups) {
      const s = this.sprite("kib", nKib++, () => new THREE.SpriteMaterial({ map: this.kibble, transparent: true, depthWrite: false, alphaTest: 0.1 }));
      s.position.set(c.pos.x, 0.25 + Math.abs(Math.sin(world.time * 5 + c.id)) * 0.12, c.pos.z); s.scale.set(0.42, 0.42, 1);
    }
    this.hideRest("kib", nKib);
    const shop = world.shop;
    const boss = this.sprite("merchant", 0, () => new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.4 }));
    boss.visible = !!shop && !!this.friendTex[0];
    if (shop && this.friendTex[0]) {
      if (boss.material.map !== this.friendTex[0]) { boss.material.map = this.friendTex[0]; boss.material.needsUpdate = true; }
      boss.center.set(0.5, 0); boss.position.set(shop.pos.x, 0, shop.pos.z); boss.scale.set(-1.9, 1.6, 1);
      const sign = this.sprite("sign", 0, () => new THREE.SpriteMaterial({ map: canvasTexture(signCanvas()), transparent: true, depthWrite: false }));
      sign.position.set(shop.pos.x, 2.0 + Math.sin(world.time * 2) * 0.05, shop.pos.z); sign.scale.set(1.9, 0.6, 1);
    } else this.hideRest("sign", 0);
    // 特別な部屋の置き物（使ったものは薄く）
    const al = world.room.altar;
    if (al) {
      const s = this.sprite("altar", 0, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.05 }));
      const tex = this.altarTex(al.kind);
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      s.center.set(0.5, 0); s.position.set(al.pos.x, 0.05 + (al.used && al.kind !== "fusion" ? 0 : Math.abs(Math.sin(world.time * 2.5)) * 0.15), al.pos.z);
      s.scale.set(1.7, 1.7, 1); s.material.opacity = al.used && al.kind !== "fusion" ? 0.45 : 1;
    } else this.hideRest("altar", 0);

    // エフェクト: 当たった技の絵・ダメージの数字・光
    let nHit = 0, nNum = 0, nFx = 0;
    for (const f of world.fx) {
      const k = f.t / f.life;
      if (f.kind === "num" && f.value !== undefined) {
        const s = this.sprite("num", nNum++, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
        const tex = this.numberTexture(f.value, f.color);
        if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
        s.position.set(f.pos.x + Math.sin(f.value) * 0.2, 1.2 + k * 0.8, f.pos.z); s.scale.set(0.9, 0.45, 1); s.renderOrder = 10;
        s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        continue;
      }
      if (f.kind === "zap" && f.to) {   // ビリビリが飛び移る線
        const m = this.ribbon("rib", nRib++, f.pos, f.to, 0.14, "#ffc400", 0.5); (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        const c = this.ribbon("rib", nRib++, f.pos, f.to, 0.05, "#ffffff", 0.51); (c.material as THREE.MeshBasicMaterial).opacity = 1 - k;
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
    this.hideRest("rib", nRib); this.hideRest("ring", nRing); this.hideRest("post", nPost);
    this.hideRest("roomba", nRoomba); this.hideRest("friend", nFriend);
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

    // カメラ: 見える広さを決めて（横持ちは約22マス、縦持ちは約12マス）、猫を追う。部屋の端より外は映しすぎない
    const aspect = this.camera.aspect, tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = Math.min(room.w + 0.3, aspect >= 1 ? 11 : 6.5);
    const halfD = Math.min(room.d + 1.0, aspect >= 1 ? 7.2 : 9);
    const distance = Math.max(halfW / (tanV * aspect), halfD / tanV / 0.92);
    const pitch = THREE.MathUtils.degToRad(56);
    const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
    const tx = clamp(p.pos.x, Math.max(0, room.w + 0.3 - halfW)), tz = clamp(p.pos.z, Math.max(0, room.d + 1.0 - halfD));
    // なめらかに追う
    this.camX += (tx - this.camX) * Math.min(1, dt * 6); this.camZ += (tz - this.camZ) * Math.min(1, dt * 6);
    if (room !== this.camRoom) { this.camRoom = room; this.camX = tx; this.camZ = tz; }
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    this.camera.position.set(this.camX + sh, Math.sin(pitch) * distance, this.camZ + 0.5 + Math.cos(pitch) * distance);
    this.camera.lookAt(this.camX, 0, this.camZ + 0.5);
    this.renderer.render(this.scene, this.camera);
  }
}

/** お店の看板。 */
function signCanvas() {
  return stickerCanvas(320, 100, (g) => {
    g.fillStyle = "#fab005"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(10, 10, 300, 80, 16); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = "bold 38px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ボス猫のお店", 160, 52);
  }, 0.03);
}
