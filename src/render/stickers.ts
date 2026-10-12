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

// 虫は苦手な人でも見られるよう、まんまるの体・大きな目・短い足のぬいぐるみ風デフォルメ。右向きに描く。
function cuteEyes(g: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, mood: "plain" | "grumpy" = "plain") {
  for (const dx of [0, gap]) {
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = r * 0.22;
    g.beginPath(); g.ellipse(x + dx, y, r, r * 1.15, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(x + dx + r * 0.2, y + r * 0.1, r * 0.55, r * 0.68, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x + dx + r * 0.38, y - r * 0.22, r * 0.22, 0, 7); g.fill();
    if (mood === "grumpy") { g.strokeStyle = INK; g.lineWidth = r * 0.3; g.beginPath(); g.moveTo(x + dx - r, y - r * 1.15); g.lineTo(x + dx + r, y - r * 0.75); g.stroke(); }
  }
}
function blush(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = "rgba(255,130,150,.55)"; g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, 7); g.fill();
}
function stubs(g: CanvasRenderingContext2D, xs: number[], y: number, len: number, w: number, color = INK) {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round";
  for (const x of xs) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
}

export function enemyTexture(type: EnemyType): THREE.CanvasTexture {
  if (type === "roach") return sticker(300, 240, (g) => {   // まるいおまんじゅう型のゴキちゃん
    stubs(g, [95, 150, 205], 175, 30, 12);
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = "round";                          // くるんとした触角
    g.beginPath(); g.moveTo(235, 85); g.quadraticCurveTo(255, 30, 285, 40); g.moveTo(245, 95); g.quadraticCurveTo(290, 70, 290, 100); g.stroke();
    const gr = g.createRadialGradient(130, 100, 10, 150, 130, 130); gr.addColorStop(0, "#c98a52"); gr.addColorStop(1, "#8a5228");
    g.fillStyle = gr; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(150, 135, 120, 72, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#6b3c1a"; g.lineWidth = 5; g.beginPath(); g.moveTo(150, 68); g.lineTo(150, 205); g.stroke();
    g.fillStyle = "rgba(255,240,215,.6)"; g.beginPath(); g.ellipse(105, 100, 30, 14, -0.4, 0, 7); g.fill();
    cuteEyes(g, 195, 125, 17, 38); blush(g, 205, 165, 12);
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(222, 158, 9, 0.2, Math.PI - 0.2); g.stroke();
  });
  if (type === "mosquito") return sticker(280, 260, (g) => {   // ちびっこ蚊。ストローみたいな口
    g.fillStyle = "rgba(225,240,255,.9)"; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.ellipse(105, 70, 55, 30, -0.6, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(155, 70, 50, 27, 0.5, 0, 7); g.fill(); g.stroke();
    stubs(g, [100, 130, 160], 185, 40, 6);
    g.fillStyle = "#9aa3c7"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(80, 150, 50, 34, 0.2, 0, 7); g.fill(); g.stroke();                 // おしり
    g.strokeStyle = "#cfd5ee"; g.lineWidth = 5; for (const x of [62, 85]) { g.beginPath(); g.moveTo(x, 122); g.lineTo(x - 6, 178); g.stroke(); }
    g.fillStyle = "#b8c0e0"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(165, 140, 50, 0, 7); g.fill(); g.stroke();                              // あたま
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(212, 152); g.lineTo(262, 170); g.stroke();
    g.fillStyle = "#ff8fa3"; g.beginPath(); g.arc(264, 171, 7, 0, 7); g.fill();
    cuteEyes(g, 150, 132, 13, 30); blush(g, 186, 165, 10);
  });
  if (type === "spider") return sticker(300, 260, (g) => {   // ふわふわ毛玉クモ
    g.strokeStyle = INK; g.lineWidth = 10; g.lineCap = "round";
    for (const [x0, y0, x1, y1] of [[90, 150, 30, 120], [90, 170, 25, 200], [210, 150, 270, 120], [210, 170, 275, 200]]) {
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 - 30, x1, y1); g.stroke();
    }
    stubs(g, [120, 180], 205, 30, 10);
    g.fillStyle = "#6b5a8e"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath();
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, r = k % 2 ? 92 : 82; g.lineTo(150 + Math.cos(a) * r, 145 + Math.sin(a) * r * 0.85); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(115, 100, 26, 14, -0.4, 0, 7); g.fill();
    cuteEyes(g, 128, 135, 18, 44); blush(g, 116, 178, 12); blush(g, 186, 178, 12);
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(150, 170, 10, 0.2, Math.PI - 0.2); g.stroke();
  });
  return sticker(420, 360, (g) => {   // ボス: ぷっくりハチ（ちょっとむっとした顔）
    g.fillStyle = "rgba(230,240,255,.92)"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(170, 80, 85, 50, -0.5, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(250, 80, 80, 46, 0.45, 0, 7); g.fill(); g.stroke();
    stubs(g, [150, 210, 270], 290, 40, 14);
    g.save(); g.beginPath(); g.ellipse(210, 200, 175, 115, 0, 0, 7); g.clip();
    g.fillStyle = "#ffcf3a"; g.fillRect(0, 0, 420, 360);
    g.fillStyle = "#4a3418"; for (const x of [70, 135]) g.fillRect(x, 60, 34, 300);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.ellipse(210, 200, 175, 115, 0, 0, 7); g.stroke();
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 6;                                 // 丸い針
    g.beginPath(); g.moveTo(38, 195); g.lineTo(8, 210); g.lineTo(40, 222); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(300, 100); g.quadraticCurveTo(310, 40, 345, 45); g.moveTo(330, 110); g.quadraticCurveTo(360, 60, 390, 75); g.stroke();
    g.fillStyle = "#ff9a3c"; g.beginPath(); g.arc(347, 45, 10, 0, 7); g.arc(392, 76, 10, 0, 7); g.fill();
    cuteEyes(g, 270, 180, 26, 62, "grumpy"); blush(g, 262, 238, 18); blush(g, 352, 238, 18);
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(290, 250); g.quadraticCurveTo(310, 238, 330, 250); g.stroke();
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
