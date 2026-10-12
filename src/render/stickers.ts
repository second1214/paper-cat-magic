// 敵などの紙ステッカーを canvas で描く（白いダイカット縁＋茶色の主線）。
import * as THREE from "three";
import type { EnemyType } from "../game/world";

const INK = "#4a2a16";

function sticker(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const art = document.createElement("canvas"); art.width = w; art.height = h;
  const ga = art.getContext("2d")!;
  ga.lineJoin = "round"; ga.lineCap = "round";
  draw(ga);
  // 白い縁: シルエットを全方向にずらして重ねる
  const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
  const gs = sil.getContext("2d")!;
  gs.drawImage(art, 0, 0); gs.globalCompositeOperation = "source-in"; gs.fillStyle = "#fffdf8"; gs.fillRect(0, 0, w, h);
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const go = out.getContext("2d")!;
  const B = Math.round(w * 0.035);
  for (let a = 0; a < 24; a++) go.drawImage(sil, Math.cos(a / 24 * Math.PI * 2) * B, Math.sin(a / 24 * Math.PI * 2) * B);
  go.drawImage(art, 0, 0);
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// 虫は「猫と同じ画風で少しリアル」: 茶色の主線、塗り＋ハイライト、白いダイカット縁。右向きに描く。
function legs(g: CanvasRenderingContext2D, pts: [number, number, number, number, number, number][], w: number) {
  g.strokeStyle = INK; g.lineWidth = w;
  for (const [x0, y0, x1, y1, x2, y2] of pts) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
}

export function enemyTexture(type: EnemyType): THREE.CanvasTexture {
  if (type === "roach") return sticker(340, 220, (g) => {
    // 脚（とげのある6本）と長い触角
    legs(g, [[150, 120, 120, 180, 80, 205], [185, 125, 185, 185, 160, 212], [215, 120, 250, 175, 290, 195],
             [150, 100, 115, 50, 70, 30], [185, 95, 190, 40, 165, 15], [215, 100, 255, 55, 300, 45]], 7);
    g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(285, 100); g.quadraticCurveTo(320, 60, 335, 20); g.moveTo(285, 112); g.quadraticCurveTo(325, 130, 338, 175); g.stroke();
    // 体（つやのある茶色の楕円）
    const gr = g.createLinearGradient(0, 60, 0, 160); gr.addColorStop(0, "#9a5a2c"); gr.addColorStop(1, "#5a3014");
    g.fillStyle = gr; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(170, 110, 115, 52, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#7a4520"; g.beginPath(); g.ellipse(268, 108, 34, 38, 0, 0, 7); g.fill(); g.stroke();   // 前胸
    g.strokeStyle = "#3b1d0a"; g.lineWidth = 4; g.beginPath(); g.moveTo(240, 110); g.lineTo(60, 110); g.stroke();   // 翅の合わせ目
    g.strokeStyle = "rgba(255,230,190,.55)"; g.lineWidth = 6; g.beginPath(); g.ellipse(160, 92, 70, 16, -0.05, Math.PI * 1.1, Math.PI * 1.85); g.stroke();
    g.fillStyle = "#1a0d05"; g.beginPath(); g.arc(288, 98, 6, 0, 7); g.fill();
  });
  if (type === "mosquito") return sticker(300, 240, (g) => {
    legs(g, [[150, 130, 110, 190, 60, 230], [160, 132, 160, 200, 140, 236], [170, 130, 215, 190, 265, 225],
             [150, 120, 100, 150, 40, 160], [175, 118, 230, 140, 285, 150]], 4);
    g.fillStyle = "rgba(220,235,255,.75)"; g.strokeStyle = INK; g.lineWidth = 4;   // 翅
    g.beginPath(); g.ellipse(130, 70, 70, 26, -0.5, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(175, 72, 60, 22, 0.35, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#3d3a44"; g.lineWidth = 6;
    g.beginPath(); g.ellipse(100, 125, 62, 16, 0.25, 0, 7); g.fill(); g.stroke();                       // 腹
    g.strokeStyle = "#cfc8b8"; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(70 + k * 18, 112 + k * 4); g.lineTo(66 + k * 18, 136 + k * 4); g.stroke(); }
    g.fillStyle = "#4a4652"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.ellipse(170, 118, 26, 20, 0, 0, 7); g.fill(); g.stroke();                          // 胸
    g.beginPath(); g.arc(205, 112, 13, 0, 7); g.fill(); g.stroke();                                     // 頭
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(215, 115); g.lineTo(270, 132); g.stroke();   // 口
    g.fillStyle = "#c02020"; g.beginPath(); g.arc(208, 108, 4, 0, 7); g.fill();
  });
  if (type === "spider") return sticker(320, 260, (g) => {
    const L: [number, number, number, number, number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = -0.9 + k * 0.6;
      L.push([190, 130, 190 + Math.cos(a) * 70, 130 - 60 - k * 6, 190 + Math.cos(a) * 125, 135 + (k - 1.5) * 18]);
      L.push([190, 140, 190 - Math.cos(a) * 60 + 40, 140 + 70, 190 - Math.cos(a) * 110 + 60, 245 - k * 8]);
    }
    legs(g, L, 7);
    g.fillStyle = "#3a2c22"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(115, 135, 75, 62, 0, 0, 7); g.fill(); g.stroke();                           // 腹
    g.strokeStyle = "#c9a36a"; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 115); g.lineTo(150, 115); g.moveTo(80, 145); g.lineTo(145, 145); g.stroke();
    g.fillStyle = "#4e3a2c"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(215, 132, 42, 36, 0, 0, 7); g.fill(); g.stroke();                           // 頭胸
    g.fillStyle = "#111"; for (const [x, y, r] of [[238, 118, 7], [250, 128, 6], [232, 132, 5], [246, 142, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(236, 115, 2.5, 0, 7); g.fill();
  });
  return sticker(460, 380, (g) => {   // スズメバチ（ボス）
    legs(g, [[220, 220, 200, 290, 170, 330], [250, 225, 255, 300, 240, 345], [280, 220, 310, 290, 340, 320]], 9);
    g.fillStyle = "rgba(225,235,250,.8)"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.ellipse(210, 95, 120, 45, -0.35, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(275, 100, 105, 38, 0.2, 0, 7); g.fill(); g.stroke();
    g.save(); g.beginPath(); g.ellipse(140, 200, 120, 78, 0.12, 0, 7); g.clip();                          // 腹（黄と黒のしま）
    g.fillStyle = "#f2b705"; g.fillRect(0, 0, 460, 380);
    g.fillStyle = "#2a1a08"; for (let k = 0; k < 4; k++) g.fillRect(40 + k * 52, 100, 24, 200);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 9; g.beginPath(); g.ellipse(140, 200, 120, 78, 0.12, 0, 7); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(25, 210); g.lineTo(0, 225); g.lineTo(28, 232); g.fill();     // 針
    g.fillStyle = "#6b3a12"; g.beginPath(); g.ellipse(285, 185, 55, 50, 0, 0, 7); g.fill(); g.stroke();       // 胸
    g.fillStyle = "#e88a1a"; g.beginPath(); g.ellipse(365, 180, 58, 54, 0, 0, 7); g.fill(); g.stroke();      // 頭
    g.fillStyle = "#2a1a08"; g.beginPath(); g.ellipse(385, 165, 18, 26, 0.3, 0, 7); g.fill();               // 複眼
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(410, 200); g.lineTo(440, 215); g.moveTo(405, 212); g.lineTo(430, 232); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(370, 130); g.quadraticCurveTo(395, 80, 430, 70); g.stroke();
  });
}

/** おもちゃの先（飛んでいくもの）。右向き。 */
export function lureTexture(lure: "feather" | "dragonfly" | "tissue"): THREE.CanvasTexture {
  if (lure === "feather") return sticker(200, 110, (g) => {
    g.fillStyle = "#ff9ec4"; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(20, 55); g.quadraticCurveTo(90, 0, 185, 50); g.quadraticCurveTo(90, 110, 20, 55); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(25, 55); g.lineTo(180, 51); g.stroke();
    g.strokeStyle = "#e0709a"; g.lineWidth = 2; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(45 + k * 18, 53); g.lineTo(35 + k * 18, 30 + (k % 2) * 4); g.moveTo(45 + k * 18, 56); g.lineTo(35 + k * 18, 80 - (k % 2) * 4); g.stroke(); }
  });
  if (lure === "dragonfly") return sticker(220, 160, (g) => {
    g.fillStyle = "rgba(210,235,255,.85)"; g.strokeStyle = INK; g.lineWidth = 4;
    for (const [x, y, r] of [[105, 45, -0.35], [105, 115, 0.35], [140, 50, -0.15], [140, 110, 0.15]] as const) { g.beginPath(); g.ellipse(x, y, 42, 14, r, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#2f80d0"; g.lineWidth = 5; g.beginPath(); g.roundRect(20, 72, 130, 16, 8); g.fill(); g.stroke();
    g.fillStyle = "#1f5fa0"; g.beginPath(); g.ellipse(165, 80, 26, 20, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#7fd0ff"; g.beginPath(); g.arc(180, 72, 9, 0, 7); g.arc(180, 90, 9, 0, 7); g.fill();
  });
  return sticker(150, 140, (g) => {   // ティッシュを丸めた玉
    g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath();
    for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2, r = 55 + (k % 2 ? 8 : -4); g.lineTo(75 + Math.cos(a) * r, 70 + Math.sin(a) * r * 0.92); }
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#b8b8c8"; g.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[45, 50, 80, 70], [90, 40, 70, 90], [100, 80, 60, 100], [50, 85, 85, 55]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  });
}

/** 技が当たったときの絵（爪あと・かみつき・毛玉・シャー）。 */
export function techTexture(tech: "claw" | "bite" | "hairball" | "hiss"): THREE.CanvasTexture {
  if (tech === "claw") return sticker(200, 200, (g) => {
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = INK; g.lineWidth = 20; g.beginPath(); g.moveTo(50 + k * 38, 30); g.quadraticCurveTo(30 + k * 38, 100, 60 + k * 38, 175); g.stroke();
      g.strokeStyle = "#ff5a4a"; g.lineWidth = 11; g.stroke();
    }
  });
  if (tech === "bite") return sticker(220, 200, (g) => {
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const up of [true, false]) {
      g.beginPath();
      const y = up ? 70 : 130, s = up ? 1 : -1;
      g.moveTo(25, y - s * 25); g.quadraticCurveTo(110, y - s * 70, 195, y - s * 25);
      for (let k = 6; k >= 0; k--) { const x = 30 + k * 27; g.lineTo(x + 13, y + s * (k === 1 || k === 5 ? 34 : 18)); g.lineTo(x, y); }
      g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = "#ff6b6b"; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.fillText("ガブッ", 110, 112);
  });
  if (tech === "hairball") return sticker(220, 220, (g) => {
    g.fillStyle = "#e0a060"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath();
    for (let k = 0; k <= 22; k++) { const a = (k / 22) * Math.PI * 2, r = k % 2 ? 100 : 70; g.lineTo(110 + Math.cos(a) * r, 110 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff4e0"; g.beginPath(); g.arc(110, 110, 42, 0, 7); g.fill();
    g.strokeStyle = "#b07a3c"; g.lineWidth = 3; for (let k = 0; k < 8; k++) { const a = k * 0.8; g.beginPath(); g.moveTo(110, 110); g.lineTo(110 + Math.cos(a) * 38, 110 + Math.sin(a) * 38); g.stroke(); }
  });
  return sticker(240, 160, (g) => {
    g.fillStyle = "#c9a6ff"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath();
    for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2, r = k % 2 ? 100 : 70; g.lineTo(120 + Math.cos(a) * r, 80 + Math.sin(a) * r * 0.62); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#3b1d6e"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.fillText("シャー", 120, 98);
  });
}

/** 光る弾・エフェクト用の放射グラデーション。 */
export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** 紙っぽい床のテクスチャ。 */
export function paperTexture(base: string, line: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(80,60,40,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  g.strokeStyle = line; g.lineWidth = 2;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(512, x); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** 敵の弾: 白い芯＋濃い縁取りの玉（色は SpriteMaterial.color で付ける）。 */
export function orbTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a1d12"; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(32, 32, 23, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(25, 25, 7, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
