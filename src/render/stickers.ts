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

/** 王冠（ボスのしるし）。 */
function crown(g: CanvasRenderingContext2D, cx: number, bottom: number, color: string) {
  g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 7;
  g.beginPath(); g.moveTo(cx - 55, bottom); g.lineTo(cx - 60, bottom - 55); g.lineTo(cx - 28, bottom - 28); g.lineTo(cx, bottom - 70); g.lineTo(cx + 28, bottom - 28); g.lineTo(cx + 60, bottom - 55); g.lineTo(cx + 55, bottom); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#ff6b6b"; for (const dx of [-30, 0, 30]) { g.beginPath(); g.arc(cx + dx, bottom - 14, 7, 0, 7); g.fill(); }
}

/** 季節の虫（右向き、ぬいぐるみ風）。[幅, 高さ, 描画] */
const NEW_BUGS: Record<"stinkbug" | "camel" | "ant" | "caterpillar", [number, number, (g: CanvasRenderingContext2D) => void]> = {
  stinkbug: [300, 250, (g) => {   // カメムシ: 盾形の緑の背中
    stubs(g, [110, 150, 190], 185, 28, 11);
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(245, 110); g.quadraticCurveTo(270, 60, 292, 70); g.moveTo(250, 125); g.quadraticCurveTo(292, 110, 294, 135); g.stroke();
    g.fillStyle = "#74b816"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(40, 120); g.quadraticCurveTo(60, 50, 150, 55); g.lineTo(230, 80); g.quadraticCurveTo(265, 130, 230, 175); g.quadraticCurveTo(140, 220, 60, 185); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#94d82d"; g.beginPath(); g.moveTo(90, 75); g.lineTo(170, 75); g.lineTo(130, 150); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.ellipse(95, 95, 22, 11, -0.4, 0, 7); g.fill();
    cuteEyes(g, 190, 125, 15, 34, "grumpy"); blush(g, 200, 162, 11);
    g.fillStyle = "rgba(169,227,75,.7)"; for (const [x, y, r] of [[25, 70, 14], [12, 100, 10], [30, 45, 9]] as const) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }],
  camel: [320, 260, (g) => {   // カマドウマ: こぶの背中と長い触角・大きな後ろ足
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(250, 120); g.quadraticCurveTo(290, 20, 315, 30); g.moveTo(255, 130); g.quadraticCurveTo(310, 60, 318, 80); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 12; g.beginPath(); g.moveTo(90, 150); g.lineTo(40, 90); g.lineTo(30, 215); g.stroke();
    g.strokeStyle = "#c58a4a"; g.lineWidth = 6; g.stroke();
    stubs(g, [170, 215], 190, 34, 10);
    const gr = g.createLinearGradient(0, 70, 0, 200); gr.addColorStop(0, "#d9a066"); gr.addColorStop(1, "#a0652e");
    g.fillStyle = gr; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(70, 170); g.quadraticCurveTo(80, 70, 170, 70); g.quadraticCurveTo(260, 80, 260, 150); g.quadraticCurveTo(250, 200, 170, 200); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#8a5228"; g.lineWidth = 4; for (const x of [120, 150, 180]) { g.beginPath(); g.moveTo(x, 78); g.lineTo(x - 10, 195); g.stroke(); }
    cuteEyes(g, 205, 130, 15, 32); blush(g, 220, 168, 11);
  }],
  ant: [240, 190, (g) => {   // アリ: 3つの丸
    stubs(g, [90, 120, 150], 135, 30, 8);
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(195, 70); g.quadraticCurveTo(215, 25, 235, 35); g.stroke();
    g.fillStyle = "#e8590c"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(60, 115, 50, 40, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(120, 115, 25, 22, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(180, 100, 40, 0, 7); g.fill(); g.stroke();
    cuteEyes(g, 168, 95, 11, 24); blush(g, 192, 122, 8);
  }],
  caterpillar: [340, 220, (g) => {   // 毛虫: ふわふわの緑の連なり
    stubs(g, [70, 120, 170, 220], 165, 22, 9);
    for (const [x, r] of [[50, 42], [100, 46], [150, 48], [200, 48]] as const) {
      g.fillStyle = "#8ce99a"; g.strokeStyle = INK; g.lineWidth = 7;
      g.beginPath(); for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI * 2, rr = k % 2 ? r : r - 7; g.lineTo(x + Math.cos(a) * rr, 120 + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = "#b2f2bb"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(270, 110, 55, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff8787"; for (const x of [50, 100, 150, 200]) { g.beginPath(); g.arc(x, 85, 7, 0, 7); g.fill(); }
    cuteEyes(g, 255, 100, 14, 32); blush(g, 270, 140, 11);
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(280, 135, 9, 0.2, Math.PI - 0.2); g.stroke();
  }],
};
const KINGS: Record<"stinkKing" | "camelKing" | "queen", ["stinkbug" | "camel" | "caterpillar", string]> = {
  stinkKing: ["stinkbug", "#ffd43b"], camelKing: ["camel", "#ffd43b"], queen: ["caterpillar", "#f783ac"],
};

/**
 * 子ども（仮の絵。public/kids/*.png があればそちらを使う）。右向き。hug は猫をだっこしている絵（猫は描かず、腕で輪を作る）。
 * お兄ちゃん6さい: 短い黒髪・青いTシャツ・半ズボン。妹3さい: 黒髪のボブ・ピンクのワンピース。
 */
export function kidCanvas(type: "boy" | "girl", hug = false): HTMLCanvasElement {
  const girl = type === "girl", W = 220, H = girl ? 300 : 360;
  return stickerCanvas(W, H, (g) => {
    const head = girl ? 62 : 64, hy = head + 14, bodyTop = hy + head - 6, legs = H - 18;
    g.strokeStyle = INK; g.lineWidth = 7;
    // 足
    g.fillStyle = girl ? "#ffe3d3" : "#ffd8be";
    for (const x of [88, 128]) { g.beginPath(); g.roundRect(x - 13, legs - (girl ? 70 : 95), 26, girl ? 70 : 95, 10); g.fill(); g.stroke(); }
    g.fillStyle = girl ? "#ff8fab" : "#495057"; for (const x of [88, 128]) { g.beginPath(); g.ellipse(x + 8, legs, 22, 12, 0, 0, 7); g.fill(); g.stroke(); }
    // 服
    g.fillStyle = girl ? "#ffafcc" : "#4dabf7";
    if (girl) { g.beginPath(); g.moveTo(80, bodyTop); g.lineTo(140, bodyTop); g.lineTo(178, legs - 60); g.lineTo(42, legs - 60); g.closePath(); g.fill(); g.stroke(); }
    else {
      g.beginPath(); g.roundRect(62, bodyTop, 96, legs - 95 - bodyTop + 10, 18); g.fill(); g.stroke();
      g.fillStyle = "#364fc7"; g.beginPath(); g.roundRect(64, legs - 115, 92, 34, 8); g.fill(); g.stroke();
      g.fillStyle = "#fff"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.fillText("★", 110, bodyTop + 50);
    }
    // 腕（だっこは前で輪、ふだんは前へのばす）
    g.strokeStyle = INK; g.lineWidth = 22; g.lineCap = "round";
    const sy = bodyTop + 22;
    if (hug) { g.beginPath(); g.arc(150, sy + 40, 34, -1.6, 1.6); g.stroke(); g.strokeStyle = "#ffd8be"; g.lineWidth = 13; g.stroke(); }
    else { g.beginPath(); g.moveTo(120, sy); g.lineTo(195, sy + 18); g.stroke(); g.strokeStyle = "#ffd8be"; g.lineWidth = 13; g.stroke(); }
    // 頭
    g.fillStyle = "#ffe0c8"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(110, hy, head, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#2b2118";
    if (girl) {
      g.beginPath(); g.arc(110, hy - 6, head, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      for (const x of [40, 180]) { g.beginPath(); g.arc(x, hy - 10, 22, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = "#ff6b9d"; for (const x of [52, 168]) { g.beginPath(); g.arc(x, hy - 22, 9, 0, 7); g.fill(); }
    } else { g.beginPath(); g.arc(110, hy - 8, head, Math.PI * 1.0, Math.PI * 2.0); g.fill(); g.beginPath(); g.moveTo(60, hy - 20); g.lineTo(90, hy - 4); g.lineTo(120, hy - 22); g.lineTo(150, hy - 2); g.lineTo(170, hy - 20); g.fill(); }
    // 顔（にこにこ）
    g.fillStyle = INK; for (const x of [122, 156]) { g.beginPath(); g.ellipse(x, hy + 8, 6, 9, 0, 0, 7); g.fill(); }
    blush(g, 162, hy + 28, 11);
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(142, hy + 26, 12, 0.2, Math.PI - 0.2); g.stroke();
  }, 0.03);
}

/**
 * パパ（仮の絵。public/papa/sleep.png・suck.png があればそちらを使う）。
 * sleep: あおむけに寝ころんでいる（横長）。suck: すわって猫を顔に押しあてて吸っている（猫は描かない）。
 */
export function papaCanvas(suck = false): HTMLCanvasElement {
  if (!suck) return stickerCanvas(380, 170, (g) => {
    g.strokeStyle = INK; g.lineWidth = 7;
    g.fillStyle = "#495057"; g.beginPath(); g.roundRect(215, 95, 150, 46, 20); g.fill(); g.stroke();   // ズボン
    g.fillStyle = "#74c0fc"; g.beginPath(); g.ellipse(170, 105, 85, 50, 0, 0, 7); g.fill(); g.stroke();   // おなか（Tシャツ）
    g.fillStyle = "#ffd8be"; g.beginPath(); g.arc(62, 100, 48, 0, 7); g.fill(); g.stroke();   // 顔
    g.fillStyle = "#2b2118"; g.beginPath(); g.arc(50, 92, 48, Math.PI * 0.7, Math.PI * 1.5); g.fill();   // 髪
    g.strokeStyle = INK; g.lineWidth = 5; for (const y of [88, 112]) { g.beginPath(); g.arc(70, y, 7, 0.2, Math.PI - 0.2); g.stroke(); }   // 寝ている目
    g.fillStyle = INK; g.font = "bold 26px sans-serif"; g.fillText("z", 100, 40); g.font = "bold 34px sans-serif"; g.fillText("Z", 120, 22);
  }, 0.03);
  return stickerCanvas(240, 300, (g) => {
    g.strokeStyle = INK; g.lineWidth = 7;
    g.fillStyle = "#495057"; g.beginPath(); g.roundRect(55, 215, 130, 60, 20); g.fill(); g.stroke();
    g.fillStyle = "#74c0fc"; g.beginPath(); g.roundRect(60, 120, 120, 110, 30); g.fill(); g.stroke();
    g.fillStyle = "#ffd8be"; g.beginPath(); g.arc(120, 80, 52, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#2b2118"; g.beginPath(); g.arc(120, 70, 52, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5; for (const x of [100, 140]) { g.beginPath(); g.arc(x, 82, 7, Math.PI + 0.3, -0.3); g.stroke(); }   // うっとり
    g.strokeStyle = INK; g.lineWidth = 20; g.beginPath(); g.moveTo(70, 150); g.lineTo(95, 110); g.moveTo(170, 150); g.lineTo(145, 110); g.stroke();
    g.strokeStyle = "#ffd8be"; g.lineWidth = 12; g.stroke();
  }, 0.03);
}

export function enemyTexture(type: EnemyType): THREE.CanvasTexture {
  if (type === "papa") return canvasTexture(papaCanvas());
  if (type === "boy" || type === "girl") return canvasTexture(kidCanvas(type));
  if (type === "shrimp") return sticker(300, 220, (g) => {   // エビのけりぐるみ（ピンクの長いぬいぐるみ・しっぽの扇）
    g.strokeStyle = INK; g.lineWidth = 7;
    g.fillStyle = "#ff8787"; g.beginPath(); g.moveTo(40, 120); g.lineTo(10, 80); g.lineTo(15, 160); g.closePath(); g.fill(); g.stroke();   // しっぽ
    g.beginPath(); g.moveTo(40, 120); g.lineTo(5, 120); g.lineTo(30, 185); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffa8a8"; g.beginPath(); g.roundRect(35, 75, 230, 95, 46); g.fill(); g.stroke();   // 体
    g.strokeStyle = "#fff"; g.lineWidth = 5; for (const x of [85, 125, 165, 205]) { g.beginPath(); g.moveTo(x, 80); g.quadraticCurveTo(x - 10, 122, x, 165); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(250, 85); g.quadraticCurveTo(285, 40, 295, 20); g.moveTo(240, 85); g.quadraticCurveTo(260, 30, 250, 10); g.stroke();   // ひげ
    stubs(g, [110, 150, 190], 168, 22, 9, "#ff6b6b");
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.roundRect(70, 100, 60, 26, 6); g.fill(); g.stroke();   // タグ
    cuteEyes(g, 220, 112, 13, 0); blush(g, 238, 140, 10);
    g.lineWidth = 4; g.beginPath(); g.arc(246, 130, 8, 0.2, Math.PI - 0.2); g.stroke();
  });
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
  if (type in NEW_BUGS) { const [w, h, d] = NEW_BUGS[type as keyof typeof NEW_BUGS]; return sticker(w, h, d); }
  if (type in KINGS) {   // ボス: 子分の絵を大きくして王冠をかぶせる
    const [base, color] = KINGS[type as keyof typeof KINGS], [w, h, d] = NEW_BUGS[base];
    return sticker(w + 40, h + 90, (g) => {
      g.save(); g.translate(20, 80); d(g); g.restore();
      crown(g, w * 0.62 + 20, 80, color);
    });
  }
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
