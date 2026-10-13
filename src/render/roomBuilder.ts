// 部屋の見た目を作る（床・壁・家具・扉）。テーマと季節で色や家具が変わる。
import * as THREE from "three";
import { Cell, cellCenter, cellValue, OUTDOOR, type Layout, type Prop, type Season, type Theme } from "../game/stage";

const mat = (color: THREE.ColorRepresentation, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y + h / 2, z); b.castShadow = true; b.receiveShadow = true; return b;
};
const ball = (r: number, m: THREE.Material, x = 0, y = 0, z = 0, sy = 1) => {
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
  b.position.set(x, y, z); b.scale.y = sy; b.castShadow = true; return b;
};
const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m);
  b.position.set(x, y + h / 2, z); b.castShadow = true; b.receiveShadow = true; return b;
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const speckle = (g: CanvasRenderingContext2D, n: number, color: (i: number) => string, size = 2) => {
  for (let i = 0; i < n; i++) { g.fillStyle = color(i); g.fillRect(Math.random() * 256, Math.random() * 256, size, size); }
};

const GRASS: Record<Season, [string, string]> = {
  spring: ["#9fd36a", "#7fbf4a"], summer: ["#6fbf4a", "#4f9f32"], autumn: ["#c9b25a", "#a88a3a"], winter: ["#f3f6fb", "#dfe6f0"],
};
const LEAF: Record<Season, number> = { spring: 0xffb3cf, summer: 0x4f9f32, autumn: 0xe8772b, winter: 0xf3f6fb };

/** 床のテクスチャ（1マス＝テクスチャ1枚分）。 */
function floorTexture(theme: Theme, season: Season) {
  if (theme === "veggie") return canvasTex(256, 256, (g) => {   // 畑の土と草
    g.fillStyle = season === "winter" ? "#eef2f7" : "#a9744a"; g.fillRect(0, 0, 256, 256);
    speckle(g, 700, () => (season === "winter" ? "#d5dce6" : "#8a5a32"), 3);
    speckle(g, 120, () => GRASS[season][1], 4);
  });
  if (theme === "kitchen") return canvasTex(256, 256, (g) => {   // 市松のタイル
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? "#f1f3f5" : "#d0bfa8"; g.fillRect(x * 128, y * 128, 128, 128); }
    speckle(g, 300, () => "rgba(0,0,0,.05)", 2);
  });
  if (theme === "bath") return canvasTex(256, 256, (g) => {   // 小さな水色タイル
    g.fillStyle = "#c5e6f5"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#ffffff"; g.lineWidth = 4; for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  });
  if (theme === "entrance") return canvasTex(256, 256, (g) => {   // 石の土間
    g.fillStyle = "#9a9590"; g.fillRect(0, 0, 256, 256);
    speckle(g, 900, (i) => (i % 2 ? "#85807b" : "#b0aba5"), 3);
    g.strokeStyle = "rgba(60,55,50,.4)"; g.lineWidth = 3; g.strokeRect(2, 2, 252, 252);
  });
  if (theme === "garden" || theme === "pond") return canvasTex(256, 256, (g) => {
    const [a, b] = GRASS[season];
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    speckle(g, 900, () => b, 3);
    if (season === "spring") speckle(g, 40, (i) => (i % 2 ? "#ffffff" : "#ffd6e5"), 5);
    if (season === "autumn") speckle(g, 50, (i) => (i % 2 ? "#e8772b" : "#c0392b"), 6);
  });
  if (theme === "washitsu") return canvasTex(256, 256, (g) => {
    g.fillStyle = "#cdd29a"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(90,100,40,.18)"; g.lineWidth = 2; for (let x = 0; x < 256; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    g.fillStyle = "#3d5a3a"; g.fillRect(0, 0, 256, 10); g.fillRect(0, 246, 256, 10);       // 畳のへり
  });
  if (theme === "western") return canvasTex(256, 256, (g) => {
    g.fillStyle = "#8c3b3b"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#d9a441"; g.lineWidth = 6; g.strokeRect(14, 14, 228, 228);
    g.fillStyle = "#d9a441"; g.beginPath(); g.moveTo(128, 70); g.lineTo(186, 128); g.lineTo(128, 186); g.lineTo(70, 128); g.closePath(); g.fill();
    speckle(g, 400, () => "rgba(0,0,0,.08)", 2);
  });
  const wood: Record<string, [string, string]> = { living: ["#d9a066", "#b9804a"], bedroom: ["#e8c9a0", "#cfa878"], study: ["#9c6b43", "#7c5030"] };
  const [a, b] = wood[theme] ?? wood.living;
  return canvasTex(256, 256, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) { g.fillStyle = b; g.fillRect(0, y, 256, 3); g.fillRect(((y / 64) % 2) * 128 + 60, y, 3, 64); }
    speckle(g, 500, () => "rgba(80,40,10,.08)", 2);
  });
}

function wallStyle(theme: Theme, season: Season) {
  if (OUTDOOR.includes(theme)) return { side: mat(season === "winter" ? 0x7aa37a : 0x3f8f45), top: mat(season === "winter" ? 0xffffff : 0x5aa85f), h: 0.75 };
  if (theme === "bath") return { side: mat(0xe3f4fb), top: mat(0x7fb8d1), h: 1.0 };
  if (theme === "kitchen") return { side: mat(0xfff4e0), top: mat(0x8a6f5a), h: 1.0 };
  if (theme === "entrance") return { side: mat(0xd8cfc4), top: mat(0x5a4636), h: 1.0 };
  if (theme === "washitsu") return { side: mat(0xf4efe2), top: mat(0x8a6a48), h: 1.0 };
  const c: Record<string, number> = { living: 0xe8d8b8, bedroom: 0xd8e0ef, study: 0x8a6f5a, western: 0xe9d8c8 };
  return { side: mat(c[theme] ?? 0xe8d8b8), top: mat(0x6b4f3a), h: 1.0 };
}

/** 家具 1つ（w×d マスに収まる大きさ）。 */
function buildProp(p: Prop, season: Season): THREE.Group {
  const g = new THREE.Group(), w = p.w * 0.92, d = p.d * 0.92, s = Math.min(w, d);
  const wood = mat(0x9a6a40), dark = mat(0x5a3a22), white = mat(0xf8f4ec), black = mat(0x2a2a2e, 0.4);
  switch (p.kind) {
    case "bush": for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) g.add(ball(0.55, mat(season === "winter" ? 0xe9f0f5 : season === "autumn" ? 0xc98a3a : 0x4f9f45), i - (p.w - 1) / 2, 0.45, j - (p.d - 1) / 2, 0.85)); break;
    case "flowerbed": {
      g.add(box(w, 0.3, d, mat(0x8a5a3a)));
      const colors = season === "spring" ? [0xff8fab, 0xffd43b, 0xffffff] : season === "summer" ? [0xffd43b, 0xff922b] : season === "autumn" ? [0xe64980, 0xffa8a8] : [0xffffff];
      for (let i = 0; i < p.w * p.d * 4; i++) g.add(ball(0.11, mat(colors[i % colors.length]), (Math.random() - 0.5) * w * 0.85, 0.38, (Math.random() - 0.5) * d * 0.85));
      break;
    }
    case "rock": g.add(ball(s * 0.45, mat(0x9a9a9a), 0, s * 0.3, 0, 0.7)); break;
    case "tree": {
      g.add(cyl(0.18, 1.3, mat(0x7a5232)));
      if (season !== "winter") g.add(ball(s * 0.62 + 0.3, mat(LEAF[season]), 0, 1.6, 0, 0.8));
      else { g.add(ball(0.5, mat(0xffffff), 0, 1.4, 0, 0.5)); }
      break;
    }
    case "sofa": case "armchair": {
      const c = mat(p.kind === "sofa" ? 0x4c7a9e : 0xb05a5a);
      g.add(box(w, 0.42, d, c)); g.add(box(w, 0.5, 0.22, c, 0, 0.42, -d / 2 + 0.11));
      g.add(box(0.2, 0.25, d, c, -w / 2 + 0.1, 0.42)); g.add(box(0.2, 0.25, d, c, w / 2 - 0.1, 0.42));
      break;
    }
    case "table": case "desk": {
      g.add(box(w, 0.08, d, wood, 0, 0.7));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.08, 0.7, 0.08, dark, x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08)));
      if (p.kind === "desk") { g.add(box(0.3, 0.06, 0.3, white, -w * 0.2, 0.78, 0)); g.add(box(0.5, 0.35, 0.05, black, w * 0.15, 0.78, -d / 2 + 0.15)); }
      else g.add(cyl(0.12, 0.25, mat(0xffffff), 0, 0.78, 0));
      break;
    }
    case "tvstand": g.add(box(w, 0.45, d * 0.6, dark)); g.add(box(w * 0.85, 0.7, 0.08, black, 0, 0.45, 0)); break;
    case "plant": g.add(cyl(0.22, 0.4, mat(0xc0703a))); g.add(ball(0.42, mat(0x4f9f45), 0, 0.8, 0, 1.1)); break;
    case "bed": {
      g.add(box(w, 0.32, d, wood)); g.add(box(w * 0.96, 0.16, d * 0.96, white, 0, 0.32));
      const blanket = { spring: 0xffc9de, summer: 0x9ad1ff, autumn: 0xe8a75a, winter: 0x8c7ae6 }[season];
      const long = w >= d;
      g.add(box(long ? w * 0.62 : w * 0.98, 0.08, long ? d * 0.98 : d * 0.62, mat(blanket), long ? w * 0.18 : 0, 0.48, long ? 0 : d * 0.18));
      g.add(box(long ? 0.4 : w * 0.6, 0.12, long ? d * 0.6 : 0.4, white, long ? -w / 2 + 0.3 : 0, 0.48, long ? 0 : -d / 2 + 0.3));
      break;
    }
    case "dresser": case "tansu": case "chest": {
      const h = p.kind === "chest" ? 0.6 : 1.1, m = p.kind === "tansu" ? mat(0x7a4a2a) : wood;
      g.add(box(w, h, d, m));
      for (let k = 1; k < 4 && p.kind !== "chest"; k++) g.add(box(w * 0.94, 0.03, 0.02, dark, 0, (h * k) / 4, d / 2 + 0.01));
      for (let k = 0; k < 3 && p.kind !== "chest"; k++) g.add(box(0.12, 0.05, 0.04, mat(0xd4af37, 0.3), 0, (h * (k + 0.5)) / 4, d / 2 + 0.02));
      break;
    }
    case "nightstand": g.add(box(w * 0.8, 0.55, d * 0.8, wood)); g.add(cyl(0.12, 0.3, mat(0xfff3bf), 0, 0.55, 0)); break;
    case "bookshelf": {
      g.add(box(w, 1.6, d, dark));
      const cols = [0xe03131, 0x1c7ed6, 0x2f9e44, 0xf08c00, 0x7048e8, 0xf8f4ec];
      const front = d >= w ? { ax: "x" as const } : { ax: "z" as const };
      for (let shelf = 0; shelf < 3; shelf++) for (let k = 0; k < Math.max(3, Math.round(Math.max(w, d) * 5)); k++) {
        const len = Math.max(w, d), t = -len / 2 + 0.1 + k * 0.2;
        if (t > len / 2 - 0.1) break;
        const b = box(front.ax === "z" ? 0.14 : 0.06, 0.38, front.ax === "z" ? 0.06 : 0.14, mat(cols[(k + shelf * 2) % cols.length]));
        if (front.ax === "z") b.position.set(t, 0.15 + shelf * 0.5 + 0.19, d / 2 + 0.02); else b.position.set(w / 2 + 0.02, 0.15 + shelf * 0.5 + 0.19, t);
        g.add(b);
      }
      break;
    }
    case "boxes": g.add(box(w * 0.9, 0.45, d * 0.9, mat(0xc8a06a))); g.add(box(w * 0.6, 0.35, d * 0.6, mat(0xd9b27a), 0.05, 0.45, -0.05)); break;
    case "chabudai": g.add(cyl(s * 0.45, 0.32, mat(0x8a5a32))); break;
    case "kotatsu": {
      const futon = { spring: 0xf783ac, summer: 0x74c0fc, autumn: 0xe8590c, winter: 0xc92a2a }[season];
      g.add(box(w, 0.3, d, mat(futon))); g.add(box(w * 0.86, 0.06, d * 0.86, mat(0x9a6a40), 0, 0.3));
      g.add(ball(0.12, mat(0xff922b), 0.15, 0.45, 0.1)); g.add(ball(0.12, mat(0xff922b), -0.1, 0.45, -0.05));   // みかん
      break;
    }
    case "piano": g.add(box(w, 0.95, d, black)); g.add(box(w * 0.9, 0.04, 0.18, white, 0, 0.62, d / 2 - 0.05)); break;
    case "fridge": g.add(box(Math.min(w, 1.1), 1.9, Math.min(d, 0.9), white)); g.add(box(0.06, 0.4, 0.04, mat(0xadb5bd), Math.min(w, 1.1) / 2 - 0.15, 1.1, Math.min(d, 0.9) / 2 + 0.02)); break;
    case "counter": g.add(box(w, 0.9, d, mat(0xe9ecef))); g.add(box(w, 0.06, d, mat(0x868e96), 0, 0.9)); g.add(cyl(0.18, 0.15, mat(0x495057), w * 0.2, 0.96, 0)); break;
    case "dining": {
      g.add(box(w, 0.08, d, wood, 0, 0.72));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.08, 0.72, 0.08, dark, x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08)));
      g.add(ball(0.14, mat(0xff6b6b), -0.15, 0.86, 0)); g.add(ball(0.12, mat(0xfab005), 0.15, 0.85, 0.1));
      break;
    }
    case "tub": g.add(box(w, 0.6, d, white)); g.add(box(w * 0.86, 0.05, d * 0.8, mat(0x74c0fc, 0.2), 0, 0.5)); break;
    case "washer": g.add(box(Math.min(w, 0.95), 0.95, Math.min(d, 0.95), white)); g.add(cyl(0.28, 0.04, mat(0x495057), 0, 0.95, 0)); break;
    case "shoerack": g.add(box(w, 0.9, d * 0.8, mat(0x8a5a32))); for (let k = 0; k < Math.max(2, Math.round(Math.max(w, d) * 2)); k++) g.add(box(0.28, 0.12, 0.18, mat([0xe03131, 0x1c7ed6, 0xf8f4ec][k % 3]), -Math.max(w, d) / 2 + 0.3 + k * 0.4, 0.9, 0)); break;
    case "umbrella": g.add(cyl(0.2, 0.5, mat(0x495057))); g.add(cyl(0.03, 0.9, mat(0xe64980), 0.05, 0.3, 0)); g.add(cyl(0.03, 0.85, mat(0x4dabf7), -0.06, 0.3, 0.03)); break;
    case "pond": {   // 池（水面は低く、石で囲む）
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 28), mat(season === "winter" ? 0xdbe9f5 : 0x4dabf7, 0.15));
      water.scale.set(w / 2, 1, d / 2); water.position.y = 0.04; g.add(water);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; g.add(ball(0.18, mat(0x9a9a9a), Math.cos(a) * w / 2, 0.1, Math.sin(a) * d / 2, 0.7)); }
      if (season !== "winter") for (const [x, z] of [[0.2, 0.1], [-0.3, -0.2]]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), mat(0x40c057)).translateX(x * w).translateZ(z * d).translateY(0.09));
      break;
    }
    case "lantern": g.add(box(0.5, 0.2, 0.5, mat(0x868e96))); g.add(box(0.18, 0.6, 0.18, mat(0x868e96), 0, 0.2)); g.add(box(0.45, 0.3, 0.45, mat(0xadb5bd), 0, 0.8)); g.add(box(0.55, 0.12, 0.55, mat(0x868e96), 0, 1.1)); break;
    case "vegrow": {   // 野菜の畝
      g.add(box(w, 0.22, d, mat(0x7a4a2a)));
      const veg = season === "winter" ? 0xffffff : season === "autumn" ? 0xe8590c : season === "summer" ? 0xe03131 : 0x69db7c;
      for (let i = 0; i < Math.max(2, p.w * p.d * 2); i++) { const x = ((i % (p.w * 2)) + 0.5) / (p.w * 2) - 0.5, z = (Math.floor(i / (p.w * 2)) + 0.5) / Math.max(1, p.d) - 0.5; g.add(ball(0.16, mat(0x2f9e44), x * w, 0.36, z * d * 0.8)); g.add(ball(0.1, mat(veg), x * w + 0.08, 0.42, z * d * 0.8)); }
      break;
    }
    case "scarecrow": g.add(cyl(0.05, 1.4, wood)); g.add(box(0.9, 0.08, 0.08, wood, 0, 1.0)); g.add(ball(0.22, mat(0xf8f4ec), 0, 1.5)); g.add(cyl(0.3, 0.1, mat(0xd9a441), 0, 1.65, 0)); break;
    case "shed": g.add(box(w, 1.2, d, mat(0xc49a6c))); g.add(box(w * 1.05, 0.14, d * 1.05, mat(0xc0392b), 0, 1.2)); g.add(box(0.5, 0.8, 0.04, mat(0x8a5a32), 0, 0, d / 2 + 0.02)); break;
  }
  const c = { x: p.c + p.w / 2, z: p.r + p.d / 2 };
  g.userData.center = c;
  return g;
}

export interface BuiltRoom { group: THREE.Group; doors: THREE.Object3D[]; light: THREE.Color }

/** 部屋全体を作る。 */
export function buildRoom(L: Layout, theme: Theme, season: Season): BuiltRoom {
  const group = new THREE.Group();
  const ox = -L.cols / 2, oz = -L.rows / 2;
  // 床
  const ft = floorTexture(theme, season); ft.repeat.set(L.cols, L.rows);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L.cols, L.rows), new THREE.MeshStandardMaterial({ map: ft, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  // 壁（インスタンス）
  const ws = wallStyle(theme, season);
  const walls: [number, number][] = [];
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) if (cellValue(L, c, r) === Cell.Wall) walls.push([c, r]);
  const wallGeo = new THREE.BoxGeometry(1, ws.h, 1); wallGeo.translate(0, ws.h / 2, 0);
  const inst = new THREE.InstancedMesh(wallGeo, [ws.side, ws.side, ws.top, ws.side, ws.side, ws.side], walls.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([c, r], i) => { m4.makeTranslation(ox + c + 0.5, 0, oz + r + 0.5); inst.setMatrixAt(i, m4); });
  inst.castShadow = true; inst.receiveShadow = true; group.add(inst);
  // 家具
  for (const p of L.props) {
    const g = buildProp(p, season);
    g.position.set(ox + g.userData.center.x, 0, oz + g.userData.center.z);
    group.add(g);
  }
  // 扉（閉じているときの板）
  const doors: THREE.Object3D[] = L.exits.map((e) => {
    const p = cellCenter(L, e.c, e.r);
    const d = box(1, ws.h * 0.95, 1, mat(0x8a5a32));
    d.position.set(p.x, (ws.h * 0.95) / 2, p.z);
    group.add(d); return d;
  });
  const light = new THREE.Color({ spring: 0xfff4f0, summer: 0xffffff, autumn: 0xffe2c0, winter: 0xe3ecff }[season]);
  return { group, doors, light };
}
