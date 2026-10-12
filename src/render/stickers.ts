// 敵などの紙ステッカーを canvas で描く（白いダイカット縁＋茶色の主線）。
import * as THREE from "three";
import type { EnemyType } from "../game/world";
import { INK, stickerCanvas } from "../art/items";


function sticker(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  return canvasTexture(stickerCanvas(w, h, draw));
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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
