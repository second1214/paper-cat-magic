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

function eyes(g: CanvasRenderingContext2D, cx: number, cy: number, gap: number, r: number, angry = false) {
  for (const s of [-1, 1]) {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(cx + s * gap, cy, r, r * 1.15, 0, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = r * 0.3; g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(cx + s * gap + r * 0.15, cy + r * 0.15, r * 0.5, 0, 7); g.fill();
    if (angry) { g.lineWidth = r * 0.45; g.beginPath(); g.moveTo(cx + s * gap - s * r * 1.2, cy - r * 1.6); g.lineTo(cx + s * gap + s * r * 0.9, cy - r * 0.9); g.stroke(); }
  }
}

export function enemyTexture(type: EnemyType): THREE.CanvasTexture {
  if (type === "slime") return sticker(256, 220, (g) => {
    g.fillStyle = "#8fd16a"; g.strokeStyle = INK; g.lineWidth = 9;
    g.beginPath(); g.moveTo(30, 190); g.bezierCurveTo(20, 60, 236, 60, 226, 190); g.quadraticCurveTo(128, 205, 30, 190); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(85, 100, 22, 12, -0.5, 0, 7); g.fill();
    eyes(g, 128, 140, 34, 17);
  });
  if (type === "bat") return sticker(300, 200, (g) => {
    g.fillStyle = "#7d5ba6"; g.strokeStyle = INK; g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(150, 100); g.lineTo(150 + s * 130, 40); g.lineTo(150 + s * 110, 110); g.lineTo(150 + s * 125, 150); g.lineTo(150 + s * 70, 130); g.closePath(); g.fill(); g.stroke();
    }
    g.beginPath(); g.ellipse(150, 110, 52, 50, 0, 0, 7); g.fill(); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(150 + s * 20, 68); g.lineTo(150 + s * 38, 30); g.lineTo(150 + s * 46, 72); g.fill(); g.stroke(); }
    eyes(g, 150, 105, 20, 12, true);
  });
  if (type === "wisp") return sticker(220, 300, (g) => {
    g.fillStyle = "#4f6fb8"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(110, 20); g.quadraticCurveTo(200, 120, 190, 280); g.lineTo(150, 255); g.lineTo(110, 285); g.lineTo(70, 255); g.lineTo(30, 280); g.quadraticCurveTo(20, 120, 110, 20); g.fill(); g.stroke();
    g.fillStyle = "#1d2440"; g.beginPath(); g.ellipse(110, 135, 52, 46, 0, 0, 7); g.fill();
    g.fillStyle = "#9fe8ff"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(110 + s * 20, 135, 9, 12, 0, 0, 7); g.fill(); }
  });
  return sticker(420, 400, (g) => {   // golem
    g.fillStyle = "#9a8f84"; g.strokeStyle = INK; g.lineWidth = 11;
    g.beginPath(); g.roundRect(90, 120, 240, 230, 40); g.fill(); g.stroke();                  // body
    g.beginPath(); g.roundRect(135, 30, 150, 120, 30); g.fill(); g.stroke();                  // head
    for (const s of [-1, 1]) { g.beginPath(); g.roundRect(210 + s * 150 - 45, 140, 90, 170, 30); g.fill(); g.stroke(); }
    g.fillStyle = "#7d736a"; g.beginPath(); g.roundRect(150, 330, 50, 55, 12); g.roundRect(220, 330, 50, 55, 12); g.fill(); g.stroke();
    g.strokeStyle = "#6b625a"; g.lineWidth = 6; g.beginPath(); g.moveTo(140, 200); g.lineTo(185, 240); g.lineTo(170, 290); g.moveTo(280, 180); g.lineTo(250, 230); g.stroke();
    g.fillStyle = "#ffcf5a"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(210 + s * 32, 90, 16, 10, 0, 0, 7); g.fill(); }
    g.fillStyle = "#ffcf5a"; g.beginPath(); g.arc(210, 225, 22, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
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
