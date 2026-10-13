// アイテム（技・修飾・おもちゃ）と扉のごほうびの絵。canvas だけで描く（three.js 非依存）。
// 同じ絵を、ゲーム中に飛んでいく弾と、UI のアイコンの両方に使う。
import type { TechFx } from "../core/spells";
import type { RewardKind } from "../game/world";

export const INK = "#4a2a16";

/** 白いダイカット縁つきのステッカーを canvas に描く。 */
export function stickerCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, border = 0.035): HTMLCanvasElement {
  const art = document.createElement("canvas"); art.width = w; art.height = h;
  const ga = art.getContext("2d")!;
  ga.lineJoin = "round"; ga.lineCap = "round";
  draw(ga);
  const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
  const gs = sil.getContext("2d")!;
  gs.drawImage(art, 0, 0); gs.globalCompositeOperation = "source-in"; gs.fillStyle = "#fffdf8"; gs.fillRect(0, 0, w, h);
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const go = out.getContext("2d")!;
  const B = Math.round(w * border);
  for (let a = 0; a < 24; a++) go.drawImage(sil, Math.cos(a / 24 * Math.PI * 2) * B, Math.sin(a / 24 * Math.PI * 2) * B);
  go.drawImage(art, 0, 0);
  return out;
}

const S = 200; // アイコンは 200×200 で描く

function spikyBlob(g: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, n: number, sy = 1) {
  g.beginPath();
  for (let k = 0; k <= n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2, r = k % 2 ? r1 : r0; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy); }
  g.closePath();
}

/** 属性のしるし（虫の頭の上・説明欄に出す）。 */
const ELEMENT_DRAW = {
  static: (g: CanvasRenderingContext2D) => {   // 逆立った毛と火花
    g.fillStyle = "#ffe066"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(115, 12); g.lineTo(50, 110); g.lineTo(95, 110); g.lineTo(78, 188); g.lineTo(152, 82); g.lineTo(108, 82); g.closePath(); g.fill(); g.stroke();
  },
  wet: (g: CanvasRenderingContext2D, x = 100, y = 100, k = 1) => {   // しずく
    g.save(); g.translate(x, y); g.scale(k, k);
    g.fillStyle = "#4dabf7"; g.strokeStyle = INK; g.lineWidth = 7 / k;
    g.beginPath(); g.moveTo(0, -80); g.bezierCurveTo(30, -30, 60, 0, 60, 30); g.arc(0, 30, 60, 0, Math.PI); g.bezierCurveTo(-60, 0, -30, -30, 0, -80); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(-22, 30, 10, 18, -0.3, 0, 7); g.fill();
    g.restore();
  },
  sticky: (g: CanvasRenderingContext2D) => {   // テープのばってん
    g.fillStyle = "#e0b552"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const a of [0.7, -0.7]) { g.save(); g.translate(100, 100); g.rotate(a); g.beginPath(); g.rect(-85, -24, 170, 48); g.fill(); g.stroke(); g.restore(); }
  },
  repel: (g: CanvasRenderingContext2D) => {   // もくもく
    g.fillStyle = "#8ce99a"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); for (const [x, y, r] of [[70, 110, 45], [120, 85, 50], [140, 130, 38], [90, 140, 36]] as const) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); } g.fill(); g.stroke();
    g.fillStyle = "#2b8a3e"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("〜", 110, 110);
  },
};

/** 技の絵（右向き。飛ぶときは進む向きに回す）。 */
const TECH_DRAW: Record<Exclude<TechFx, "enemy" | "gas">, (g: CanvasRenderingContext2D) => void> = {
  claw: (g) => {   // 三本の爪あと
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = INK; g.lineWidth = 22; g.beginPath(); g.moveTo(40, 45 + k * 45); g.quadraticCurveTo(105, 25 + k * 45, 170, 55 + k * 45); g.stroke();
      g.strokeStyle = "#ff5a4a"; g.lineWidth = 12; g.stroke();
    }
  },
  bite: (g) => {   // 牙（上下のキバ）
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 7;
    for (const up of [true, false]) {
      const y = up ? 78 : 122, s = up ? 1 : -1;
      g.beginPath(); g.moveTo(25, y - s * 28); g.quadraticCurveTo(100, y - s * 62, 175, y - s * 28);
      g.lineTo(165, y); g.lineTo(140, y + s * 40); g.lineTo(125, y); g.lineTo(75, y); g.lineTo(60, y + s * 40); g.lineTo(35, y);
      g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = "#ff8fa3"; g.beginPath(); g.ellipse(100, 100, 40, 9, 0, 0, 7); g.fill();
  },
  hairball: (g) => {
    g.fillStyle = "#e0a060"; g.strokeStyle = INK; g.lineWidth = 6;
    spikyBlob(g, 100, 100, 62, 88, 11); g.fill(); g.stroke();
    g.fillStyle = "#fff4e0"; g.beginPath(); g.arc(100, 100, 36, 0, 7); g.fill();
    g.strokeStyle = "#b07a3c"; g.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = k * 0.8; g.beginPath(); g.moveTo(100, 100); g.lineTo(100 + Math.cos(a) * 32, 100 + Math.sin(a) * 32); g.stroke(); }
  },
  hiss: (g) => {
    g.fillStyle = "#c9a6ff"; g.strokeStyle = INK; g.lineWidth = 6;
    spikyBlob(g, 100, 100, 60, 90, 8, 0.75); g.fill(); g.stroke();
    g.fillStyle = "#3b1d6e"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("シャー", 100, 102);
  },
  swing: (g) => {   // ねこじゃらしの先（ふさふさの穂）
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(15, 150); g.quadraticCurveTo(60, 120, 95, 100); g.stroke();
    g.fillStyle = "#ff9ec4"; g.lineWidth = 5;
    for (const a of [-0.7, -0.25, 0.2, 0.65]) { g.save(); g.translate(95, 100); g.rotate(a - 0.3); g.beginPath(); g.ellipse(45, 0, 52, 15, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = "#ffd6e7"; g.beginPath(); g.arc(95, 100, 16, 0, 7); g.fill(); g.stroke();
  },
  yarn: (g) => {   // 毛糸玉
    g.fillStyle = "#f783ac"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(100, 100, 72, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#c2255c"; g.lineWidth = 6;
    for (const [a, r] of [[0.4, 60], [1.2, 48], [2.2, 64], [-0.6, 40]] as const) { g.beginPath(); g.ellipse(100, 100, r, r * 0.45, a, 0, 7); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 100, 72, 0, 7); g.stroke();
  },
  laser: (g) => {   // 赤い点
    const gr = g.createRadialGradient(100, 100, 0, 100, 100, 80);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, "#ff2b2b"); gr.addColorStop(1, "rgba(255,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(100, 100, 80, 0, 7); g.fill();
    g.fillStyle = "#ff1f1f"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(100, 100, 30, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(90, 90, 9, 0, 7); g.fill();
  },
  pounce: (g) => {   // 着地の衝撃（星形＋肉球）
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 6;
    spikyBlob(g, 100, 100, 50, 92, 10); g.fill(); g.stroke();
    g.fillStyle = "#ffb3c1";
    g.beginPath(); g.ellipse(100, 115, 28, 22, 0, 0, 7); g.fill(); g.stroke();
    for (const [dx, dy] of [[-26, -18], [-9, -32], [9, -32], [26, -18]]) { g.beginPath(); g.ellipse(100 + dx, 105 + dy, 9, 11, 0, 0, 7); g.fill(); g.stroke(); }
  },
  punch: (g) => {   // 肉球パンチ
    g.strokeStyle = INK; g.lineWidth = 6;
    g.fillStyle = "#fff4e6"; g.beginPath(); g.ellipse(105, 100, 70, 62, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff8fa3";
    g.beginPath(); g.ellipse(95, 120, 30, 24, 0, 0, 7); g.fill(); g.stroke();
    for (const [x, y] of [[62, 85], [85, 62], [115, 62], [140, 85]]) { g.beginPath(); g.ellipse(x, y, 12, 14, 0, 0, 7); g.fill(); g.stroke(); }
    g.strokeStyle = "#ffa94d"; g.lineWidth = 7; for (const y of [60, 100, 140]) { g.beginPath(); g.moveTo(5, y); g.lineTo(28, y); g.stroke(); }
  },
  post: (g) => {   // 段ボールの爪とぎ
    g.fillStyle = "#d9a066"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.roundRect(25, 55, 150, 90, 12); g.fill(); g.stroke();
    g.strokeStyle = "#a86b32"; g.lineWidth = 4;
    for (let x = 40; x < 170; x += 12) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x, 138); g.stroke(); }
    g.strokeStyle = "#7a3e12"; g.lineWidth = 6;
    for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(70 + k * 22, 75); g.lineTo(90 + k * 22, 125); g.stroke(); }
  },
  friend: (g) => {   // 友達猫（グレーの猫の顔）
    g.fillStyle = "#adb5bd"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(40, 85); g.lineTo(48, 20); g.lineTo(88, 55); g.lineTo(112, 55); g.lineTo(152, 20); g.lineTo(160, 85);
    g.bezierCurveTo(175, 160, 25, 160, 40, 85); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f1f3f5"; g.beginPath(); g.ellipse(100, 128, 34, 24, 0, 0, 7); g.fill();
    g.strokeStyle = "#6c757d"; g.lineWidth = 5; for (const x of [80, 100, 120]) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 70); g.stroke(); }
    g.fillStyle = "#94d82d"; g.strokeStyle = INK; g.lineWidth = 4;
    for (const x of [72, 128]) { g.beginPath(); g.ellipse(x, 100, 13, 15, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.ellipse(x, 100, 4, 11, 0, 0, 7); g.fill(); g.fillStyle = "#94d82d"; }
    g.fillStyle = "#ff8fa3"; g.beginPath(); g.moveTo(92, 120); g.lineTo(108, 120); g.lineTo(100, 129); g.closePath(); g.fill();
  },
  roomba: (g) => {   // お掃除ロボ（上から見た円盤）
    g.fillStyle = "#495057"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(100, 100, 82, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#adb5bd"; g.beginPath(); g.arc(100, 100, 62, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#212529"; g.beginPath(); g.arc(100, 100, 22, 0, 7); g.fill();
    g.fillStyle = "#51cf66"; g.beginPath(); g.arc(100, 100, 8, 0, 7); g.fill();
    g.fillStyle = "#343a40"; g.beginPath(); g.roundRect(150, 70, 22, 60, 8); g.fill();   // 前のバンパー（右が前）
  },
  squirt: (g) => {   // 水鉄砲の水（右向きのしぶき）
    g.fillStyle = "#74c0fc"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.moveTo(20, 100); g.quadraticCurveTo(90, 60, 160, 82); g.quadraticCurveTo(190, 100, 160, 118); g.quadraticCurveTo(90, 140, 20, 100); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(140, 92, 14, 6, -0.2, 0, 7); g.fill();
    g.fillStyle = "#74c0fc"; for (const [x, y, r] of [[60, 60, 9], [95, 150, 8], [40, 135, 6]] as const) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
  },
  duck: (g) => {   // ゴムのアヒル
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(95, 125, 70, 45, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(130, 70, 36, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff922b"; g.beginPath(); g.ellipse(170, 78, 22, 10, 0.1, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(138, 62, 6, 0, 7); g.fill();
    g.strokeStyle = "#f59f00"; g.lineWidth = 5; g.beginPath(); g.arc(80, 120, 25, 0.3, 2.4); g.stroke();
  },
  hammer: (g) => {   // ピコピコハンマー
    g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = "#ffd43b";
    g.beginPath(); g.roundRect(40, 115, 120, 22, 10); g.fill(); g.stroke();
    g.fillStyle = "#ff6b6b"; g.beginPath(); g.roundRect(120, 40, 60, 120, 18); g.fill(); g.stroke();
    g.fillStyle = "#4dabf7"; for (const y of [40, 138]) { g.beginPath(); g.roundRect(118, y, 64, 22, 10); g.fill(); g.stroke(); }
    g.strokeStyle = "#ffa8a8"; g.lineWidth = 6; for (const [x, y] of [[50, 60], [70, 45], [40, 85]] as const) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 15, y + 12); g.stroke(); }
  },
  bubble: (g) => {   // シャボン玉
    const gr = g.createRadialGradient(80, 75, 10, 100, 100, 80); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.6, "rgba(190,230,255,.6)"); gr.addColorStop(1, "rgba(230,170,255,.8)");
    g.fillStyle = gr; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(100, 100, 75, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(72, 68, 20, 11, -0.7, 0, 7); g.fill();
  },
  flash: (g) => {   // フラッシュの光
    g.fillStyle = "#fff3bf"; g.strokeStyle = INK; g.lineWidth = 6; spikyBlob(g, 100, 100, 45, 92, 12); g.fill(); g.stroke();
    g.fillStyle = "#495057"; g.beginPath(); g.roundRect(62, 78, 76, 50, 10); g.fill(); g.stroke();
    g.fillStyle = "#74c0fc"; g.beginPath(); g.arc(100, 103, 15, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.rect(118, 84, 12, 8); g.fill();
  },
  pumpkin: (g) => {   // ハロウィンのかぼちゃ
    g.fillStyle = "#ff922b"; g.strokeStyle = INK; g.lineWidth = 7;
    for (const [x, w] of [[60, 42], [140, 42], [100, 50]] as const) { g.beginPath(); g.ellipse(x, 112, w, 62, 0, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#2b8a3e"; g.beginPath(); g.roundRect(92, 32, 18, 26, 6); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(68, 95); g.lineTo(85, 95); g.lineTo(76, 80); g.closePath(); g.moveTo(115, 95); g.lineTo(132, 95); g.lineTo(124, 80); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(65, 125); g.quadraticCurveTo(100, 155, 135, 125); g.lineTo(120, 130); g.lineTo(110, 122); g.lineTo(100, 132); g.lineTo(90, 122); g.lineTo(80, 130); g.closePath(); g.fill();
  },
  box: (g) => {   // 通販の段ボール（ふたが開いている）
    g.fillStyle = "#d9a066"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(35, 75); g.lineTo(165, 75); g.lineTo(165, 170); g.lineTo(35, 170); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#c0864a"; g.beginPath(); g.moveTo(35, 75); g.lineTo(15, 40); g.lineTo(95, 40); g.lineTo(100, 75); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(165, 75); g.lineTo(185, 40); g.lineTo(105, 40); g.lineTo(100, 75); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.rect(60, 105, 80, 30); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.fillText("こわれもの", 100, 127);
  },
  roller: (g) => {   // 粘着コロコロ
    g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = "#f8f9fa";
    g.beginPath(); g.roundRect(45, 45, 110, 70, 30); g.fill(); g.stroke();
    g.strokeStyle = "#ced4da"; g.lineWidth = 4; for (const x of [70, 95, 120]) { g.beginPath(); g.moveTo(x, 52); g.lineTo(x, 108); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(100, 115); g.lineTo(100, 140); g.lineTo(130, 175); g.stroke();
    g.strokeStyle = "#4dabf7"; g.lineWidth = 12; g.beginPath(); g.moveTo(118, 160); g.lineTo(140, 186); g.stroke();
  },
};

/** 修飾の絵。 */
const MOD_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  matatabi: (g) => {   // またたびの葉と、キラキラ
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(45, 165); g.quadraticCurveTo(90, 110, 150, 45); g.stroke();
    g.fillStyle = "#69c06b"; g.lineWidth = 6;
    for (const [x, y, a] of [[80, 120, -2.2], [115, 85, 0.6], [140, 60, -2.1]] as const) {
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(28, 0, 30, 15, 0, 0, 7); g.fill(); g.stroke(); g.restore();
    }
    g.fillStyle = "#ffd43b"; spikyBlob(g, 150, 140, 7, 20, 4); g.fill(); g.stroke();
  },
  stare: (g) => {   // じーっと見る目
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(20, 100); g.quadraticCurveTo(100, 25, 180, 100); g.quadraticCurveTo(100, 175, 20, 100); g.fill(); g.stroke();
    g.fillStyle = "#9fd36a"; g.beginPath(); g.arc(100, 100, 38, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#1a0d06"; g.beginPath(); g.ellipse(100, 100, 12, 32, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(112, 86, 8, 0, 7); g.fill();
  },
  bouncy: (g) => {   // はねるボール
    g.strokeStyle = "#5ec2b7"; g.lineWidth = 7; g.setLineDash([12, 12]);
    g.beginPath(); g.moveTo(20, 60); g.quadraticCurveTo(60, 190, 100, 120); g.quadraticCurveTo(140, 60, 180, 150); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#ff8fab"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 85, 42, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.arc(100, 85, 26, 3.6, 4.6); g.stroke();
  },
  pushy: (g) => {   // 突き抜ける矢印
    g.fillStyle = "#e9ecef"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const x of [70, 120]) { g.beginPath(); g.roundRect(x - 12, 40, 24, 120, 8); g.fill(); g.stroke(); }
    g.fillStyle = "#5c7cfa"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(15, 88); g.lineTo(140, 88); g.lineTo(140, 62); g.lineTo(188, 100); g.lineTo(140, 138); g.lineTo(140, 112); g.lineTo(15, 112); g.closePath(); g.fill(); g.stroke();
  },
  kajikaji: (g) => {   // 歯形がいくつも
    g.fillStyle = "#e5dbff"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(100, 100, 75, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff";
    for (const [x, y] of [[70, 70], [130, 80], [95, 135]] as const) {
      g.beginPath(); g.moveTo(x - 25, y); for (let k = 0; k < 5; k++) g.lineTo(x - 25 + k * 12 + 6, y + (k % 2 ? 0 : 14)); g.lineTo(x + 25, y); g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = INK; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.fillText("×3", 150, 170);
  },
  big: (g) => {   // 大きな毛玉と小さな毛玉
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.arc(120, 105, 62, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(40, 150, 20, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 8; g.beginPath(); g.moveTo(55, 60); g.lineTo(25, 30); g.moveTo(25, 30); g.lineTo(25, 55); g.moveTo(25, 30); g.lineTo(50, 30); g.stroke();
  },
  small: (g) => {   // 豆つぶ
    g.fillStyle = "#94d82d"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const [x, y, r] of [[70, 110, 26], [125, 90, 20], [140, 140, 16]] as const) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(62, 102, 7, 0, 7); g.fill();
  },
  quick: (g) => {   // 速い線
    g.strokeStyle = INK; g.lineWidth = 10;
    for (const [y, x0] of [[60, 20], [100, 5], [140, 30]] as const) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 90, y); g.stroke(); }
    g.fillStyle = "#66d9e8"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(105, 35); g.lineTo(185, 100); g.lineTo(105, 165); g.lineTo(125, 100); g.closePath(); g.fill(); g.stroke();
  },
  static: (g) => ELEMENT_DRAW.static(g),
  water: (g) => {   // 水のみ皿
    g.fillStyle = "#ced4da"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(100, 130, 80, 32, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#74c0fc"; g.beginPath(); g.ellipse(100, 122, 58, 18, 0, 0, 7); g.fill(); g.stroke();
    ELEMENT_DRAW.wet(g, 100, 55, 0.45);
  },
  tape: (g) => {   // ガムテープ
    g.fillStyle = "#e0b552"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(100, 100, 70, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff8e7"; g.beginPath(); g.arc(100, 100, 30, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#e0b552"; g.beginPath(); g.moveTo(160, 130); g.lineTo(195, 175); g.lineTo(170, 190); g.lineTo(140, 150); g.closePath(); g.fill(); g.stroke();
  },
  spray: (g) => {   // 虫よけスプレー
    g.fillStyle = "#69db7c"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.roundRect(55, 70, 60, 115, 12); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(65, 45, 40, 28, 6); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(65, 105, 40, 40, 4); g.fill(); g.stroke();
    g.fillStyle = "rgba(140,220,120,.8)";
    for (const [x, y, r] of [[135, 50, 14], [160, 40, 18], [160, 75, 12], [185, 60, 10]] as const) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  },
  rame: (g) => {   // ラメのシール
    g.fillStyle = "#e599f7"; g.strokeStyle = INK; g.lineWidth = 6; spikyBlob(g, 100, 100, 40, 80, 5); g.fill(); g.stroke();
    g.fillStyle = "#fff"; for (const [x, y, r] of [[90, 85, 9], [120, 110, 6], [80, 120, 5], [150, 45, 10], [45, 160, 8]] as const) { spikyBlob(g, x, y, r * 0.4, r, 4); g.fill(); }
  },
  suzu: (g) => {   // 鈴のリボン
    g.fillStyle = "#ff8787"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.moveTo(100, 60); g.lineTo(40, 30); g.lineTo(45, 95); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(100, 60); g.lineTo(160, 30); g.lineTo(155, 95); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(100, 125, 42, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(62, 125); g.lineTo(138, 125); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(100, 145, 7, 0, 7); g.fill(); g.beginPath(); g.rect(97, 145, 6, 18); g.fill();
  },
  kenko: (g) => {   // 謎の健康グッズ（ピラミッド型の石）
    g.fillStyle = "#9775fa"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(100, 30); g.lineTo(170, 165); g.lineTo(30, 165); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#b197fc"; g.beginPath(); g.moveTo(100, 30); g.lineTo(170, 165); g.lineTo(110, 165); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.fillText("?", 80, 140);
  },
  jidori: (g) => {   // 自撮り棒とスマホ
    g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.moveTo(30, 175); g.lineTo(130, 75); g.stroke();
    g.strokeStyle = "#adb5bd"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "#343a40"; g.strokeStyle = INK; g.lineWidth = 6; g.save(); g.translate(145, 60); g.rotate(-0.8); g.beginPath(); g.roundRect(-22, -38, 44, 76, 8); g.fill(); g.stroke();
    g.fillStyle = "#74c0fc"; g.beginPath(); g.roundRect(-16, -30, 32, 58, 4); g.fill(); g.restore();
  },
  double: (g) => {   // 肉球ふたつ
    for (const [x, y] of [[65, 90], [135, 115]] as const) {
      g.fillStyle = "#ffb3c1"; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.ellipse(x, y + 20, 30, 25, 0, 0, 7); g.fill(); g.stroke();
      for (const [dx, dy] of [[-28, -18], [-10, -34], [10, -34], [28, -18]]) { g.beginPath(); g.ellipse(x + dx, y + dy, 10, 12, 0, 0, 7); g.fill(); g.stroke(); }
    }
    g.fillStyle = INK; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.fillText("×2", 150, 55);
  },
  hitoiki: (g) => {   // 砂時計
    g.fillStyle = "#d0bfff"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(55, 30); g.lineTo(145, 30); g.lineTo(100, 100); g.lineTo(145, 170); g.lineTo(55, 170); g.lineTo(100, 100); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f59f00"; g.beginPath(); g.moveTo(75, 150); g.lineTo(125, 150); g.lineTo(100, 115); g.closePath(); g.fill();
    g.fillStyle = "#a0522d"; for (const y of [22, 170]) { g.beginPath(); g.roundRect(40, y, 120, 14, 6); g.fill(); g.stroke(); }
  },
  issho: (g) => {   // 2匹の猫の手がハイタッチ
    for (const [x, a, c] of [[70, 0.5, "#ffb3c1"], [130, -0.5, "#ffd8a8"]] as const) {
      g.save(); g.translate(x, 110); g.rotate(a); g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.roundRect(-22, -10, 44, 80, 20); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, -20, 34, 30, 0, 0, 7); g.fill(); g.stroke(); g.restore();
    }
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 5; spikyBlob(g, 100, 55, 10, 26, 6); g.fill(); g.stroke();
  },
  okawari: (g) => {   // ごはん皿に山盛りカリカリ
    g.fillStyle = "#c8873a"; g.strokeStyle = INK; g.lineWidth = 5;
    for (const [x, y] of [[70, 95], [95, 80], [120, 92], [85, 105], [110, 108], [135, 104], [100, 66]] as const) { g.beginPath(); g.ellipse(x, y, 16, 11, x / 30, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#ff8787"; g.lineWidth = 7; g.beginPath(); g.moveTo(25, 110); g.lineTo(175, 110); g.lineTo(150, 170); g.lineTo(50, 170); g.closePath(); g.fill(); g.stroke();
  },
  oikake: (g) => {   // 走る足あと
    g.fillStyle = INK;
    for (const [x, y, k] of [[45, 150, 0.8], [90, 115, 0.9], [130, 85, 1], [168, 50, 1.1]] as const) {
      g.beginPath(); g.ellipse(x, y + 8 * k, 12 * k, 10 * k, 0, 0, 7); g.fill();
      for (const [dx, dy] of [[-12, -8], [-4, -16], [5, -16], [13, -8]]) { g.beginPath(); g.arc(x + dx * k, y + dy * k, 4.5 * k, 0, 7); g.fill(); }
    }
    g.strokeStyle = "#1971c2"; g.lineWidth = 8; g.beginPath(); g.moveTo(30, 60); g.lineTo(80, 60); g.lineTo(70, 45); g.moveTo(80, 60); g.lineTo(70, 75); g.stroke();
  },
  tsurutsuru: (g) => {   // ワックスの床とキラリ
    g.fillStyle = "#e3c08f"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.moveTo(15, 150); g.lineTo(185, 150); g.lineTo(160, 95); g.lineTo(40, 95); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#b08050"; g.lineWidth = 4; for (const x of [70, 100, 130]) { g.beginPath(); g.moveTo(x, 97); g.lineTo(x + (x - 100) * 0.4, 148); g.stroke(); }
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 5; spikyBlob(g, 140, 55, 8, 26, 4); g.fill(); g.stroke(); spikyBlob(g, 75, 60, 5, 15, 4); g.fill(); g.stroke();
  },
  dryer: (g) => {   // ドライヤーと風
    g.fillStyle = "#f783ac"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.roundRect(30, 55, 100, 60, 26); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(55, 105, 32, 70, 10); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(130, 85, 12, 26, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#74c0fc"; g.lineWidth = 7; for (const y of [60, 85, 110]) { g.beginPath(); g.moveTo(150, y); g.quadraticCurveTo(170, y - 10, 190, y); g.stroke(); }
  },
  catnipBag: (g) => {   // またたびの小袋
    g.fillStyle = "#8ce99a"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(55, 60); g.lineTo(145, 60); g.lineTo(160, 175); g.lineTo(40, 175); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#2b8a3e"; g.beginPath(); g.moveTo(55, 60); g.quadraticCurveTo(100, 20, 145, 60); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#2f9e44"; g.save(); g.translate(100, 118); g.rotate(-0.5); g.beginPath(); g.ellipse(0, 0, 28, 14, 0, 0, 7); g.fill(); g.stroke(); g.restore();
  },
  kotatsu: (g) => {   // こたつ
    g.fillStyle = "#c2255c"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(20, 170); g.lineTo(40, 90); g.lineTo(160, 90); g.lineTo(180, 170); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#a0522d"; g.beginPath(); g.roundRect(25, 70, 150, 24, 6); g.fill(); g.stroke();
    g.fillStyle = "#ff922b"; g.beginPath(); g.arc(80, 55, 16, 0, 7); g.arc(118, 55, 16, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(40, 130); g.lineTo(160, 130); g.stroke(); g.setLineDash([]);
  },
  maigofuda: (g) => {   // 迷子札
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(100, 45, 22, 0, 7); g.stroke();
    g.fillStyle = "#ffd43b"; g.lineWidth = 7; g.beginPath(); g.roundRect(45, 65, 110, 110, 22); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = "bold 42px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ねこ", 100, 112);
    g.font = "bold 22px sans-serif"; g.fillText("TEL", 100, 150);
  },
  hidamari: (g) => {   // おひさまとクッション
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 6; spikyBlob(g, 100, 72, 34, 55, 10); g.fill(); g.stroke();
    g.fillStyle = "#ffa94d"; g.beginPath(); g.ellipse(100, 160, 80, 26, 0, 0, 7); g.fill(); g.stroke();
  },
  sensor: (g) => {   // センサーライト
    g.fillStyle = "rgba(255,236,153,.8)"; g.beginPath(); g.moveTo(80, 90); g.lineTo(20, 190); g.lineTo(180, 190); g.lineTo(120, 90); g.closePath(); g.fill();
    g.fillStyle = "#f1f3f5"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(55, 30, 90, 65, 14); g.fill(); g.stroke();
    g.fillStyle = "#fcc419"; g.beginPath(); g.arc(100, 62, 20, 0, 7); g.fill(); g.stroke();
  },
  kezukuroi: (g) => {   // ブラシと毛
    g.fillStyle = "#e9ecef"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(30, 60, 120, 60, 16); g.fill(); g.stroke();
    g.fillStyle = "#a0522d"; g.beginPath(); g.roundRect(130, 78, 60, 24, 10); g.fill(); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 4; for (let x = 42; x < 140; x += 12) { g.beginPath(); g.moveTo(x, 120); g.lineTo(x, 140); g.stroke(); }
    g.fillStyle = "#ffc078"; spikyBlob(g, 70, 165, 12, 24, 7); g.fill();
  },
  chain: (g) => {   // つながる輪
    g.strokeStyle = INK; g.lineWidth = 22;
    for (const [x, y, a] of [[65, 120, -0.6], [135, 80, -0.6]] as const) { g.beginPath(); g.ellipse(x, y, 48, 28, a, 0, 7); g.stroke(); }
    g.strokeStyle = "#f06595"; g.lineWidth = 11;
    for (const [x, y, a] of [[65, 120, -0.6], [135, 80, -0.6]] as const) { g.beginPath(); g.ellipse(x, y, 48, 28, a, 0, 7); g.stroke(); }
  },
};

/** おもちゃの絵。 */
const TOY_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  jarashi: (g) => {
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(25, 180); g.lineTo(110, 95); g.stroke();
    g.strokeStyle = "#c08850"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#ff9ec4"; g.strokeStyle = INK; g.lineWidth = 5;
    for (const a of [-0.9, -0.4, 0.1]) { g.save(); g.translate(110, 95); g.rotate(a - 0.6); g.beginPath(); g.ellipse(45, 0, 50, 14, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
  },
  tombo: (g) => {
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(20, 185); g.quadraticCurveTo(60, 60, 120, 70); g.stroke();
    g.fillStyle = "rgba(210,235,255,.95)"; g.lineWidth = 4;
    for (const [x, y, r] of [[120, 50, -0.4], [120, 95, 0.4], [150, 55, -0.15], [150, 90, 0.15]] as const) { g.beginPath(); g.ellipse(x, y, 34, 12, r, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#2f80d0"; g.lineWidth = 5; g.beginPath(); g.roundRect(80, 66, 90, 14, 7); g.fill(); g.stroke();
    g.fillStyle = "#1f5fa0"; g.beginPath(); g.ellipse(180, 73, 18, 15, 0, 0, 7); g.fill(); g.stroke();
  },
  tissue: (g) => {
    g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 6;
    spikyBlob(g, 100, 100, 68, 80, 8); g.fill(); g.stroke();
    g.strokeStyle = "#b8b8c8"; g.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [[60, 70, 105, 95], [120, 55, 95, 130], [135, 105, 80, 135], [65, 115, 110, 75]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  },
  keri: (g) => {   // けりぐるみ（細長いエビ）
    g.fillStyle = "#ff8787"; g.strokeStyle = INK; g.lineWidth = 7;
    g.save(); g.translate(100, 100); g.rotate(-0.6); g.beginPath(); g.roundRect(-80, -26, 160, 52, 26); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 4; for (const x of [-40, -10, 20, 50]) { g.beginPath(); g.moveTo(x, -22); g.lineTo(x, 22); g.stroke(); }
    g.fillStyle = INK; g.beginPath(); g.arc(-58, -6, 6, 0, 7); g.fill(); g.restore();
  },
  pingpong: (g) => {
    g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 95, 60, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff922b"; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.fillText("★★★", 100, 102);
    g.strokeStyle = "#adb5bd"; g.lineWidth = 5; g.setLineDash([8, 10]); g.beginPath(); g.moveTo(20, 185); g.quadraticCurveTo(60, 120, 60, 150); g.stroke(); g.setLineDash([]);
  },
  himo: (g) => {   // くねくねのひも
    g.strokeStyle = INK; g.lineWidth = 12; g.beginPath(); g.moveTo(20, 160); g.bezierCurveTo(60, 40, 100, 200, 140, 80); g.quadraticCurveTo(160, 30, 185, 60); g.stroke();
    g.strokeStyle = "#e64980"; g.lineWidth = 6; g.stroke();
  },
  cap: (g) => {   // ペットボトルのキャップ
    for (const [x, y, c] of [[75, 110, "#4dabf7"], [130, 95, "#ff6b6b"]] as const) {
      g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(x, y + 25, 38, 14, 0, 0, Math.PI); g.lineTo(x - 38, y - 10); g.ellipse(x, y - 10, 38, 14, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 3; for (let k = -30; k <= 30; k += 10) { g.beginPath(); g.moveTo(x + k, y - 2); g.lineTo(x + k, y + 30); g.stroke(); }
    }
  },
  longrod: (g) => {   // 長いさおと糸の先の羽根
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(10, 190); g.lineTo(150, 20); g.stroke();
    g.strokeStyle = "#868e96"; g.lineWidth = 3; g.beginPath(); g.moveTo(150, 20); g.quadraticCurveTo(185, 80, 160, 130); g.stroke();
    g.fillStyle = "#74c0fc"; g.strokeStyle = INK; g.lineWidth = 5; for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(160, 130); g.rotate(1.6 + a); g.beginPath(); g.ellipse(25, 0, 28, 9, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
  },
  suzuball: (g) => {   // 穴あきボールと鈴
    g.fillStyle = "#ffe066"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 100, 72, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; for (const [x, y] of [[70, 70], [130, 70], [70, 130], [130, 130], [100, 100]] as const) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#f59f00"; g.beginPath(); g.arc(100, 100, 9, 0, 7); g.fill();
  },
  kamibukuro: (g) => {   // 紙袋から猫の耳
    g.fillStyle = "#d9a066"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(40, 70); g.lineTo(160, 70); g.lineTo(170, 185); g.lineTo(30, 185); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffa94d"; for (const x of [80, 120]) { g.beginPath(); g.moveTo(x - 18, 72); g.lineTo(x, 35); g.lineTo(x + 18, 72); g.closePath(); g.fill(); g.stroke(); }
    g.strokeStyle = "#b07a3c"; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 90); g.lineTo(160, 90); g.stroke();
  },
  tunnel: (g) => {   // 猫トンネル
    g.fillStyle = "#748ffc"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(40, 60); g.lineTo(160, 80); g.lineTo(160, 160); g.lineTo(40, 150); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#4263eb"; g.lineWidth = 4; for (const x of [70, 100, 130]) { g.beginPath(); g.moveTo(x, 64 + (x - 40) / 6); g.lineTo(x, 152 + (x - 40) / 12); g.stroke(); }
    g.fillStyle = "#1a1a2e"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(40, 105, 22, 46, 0, 0, 7); g.fill(); g.stroke();
  },
  nezumiPlush: (g) => {   // ねずみのぬいぐるみ
    g.fillStyle = "#adb5bd"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(95, 115, 62, 42, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(60, 72, 20, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ffc9c9"; g.beginPath(); g.arc(60, 72, 10, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(48, 110, 6, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(155, 120); g.quadraticCurveTo(195, 130, 180, 170); g.stroke();
  },
  matatabiStick: (g) => {   // またたびの枝
    g.strokeStyle = INK; g.lineWidth = 18; g.beginPath(); g.moveTo(30, 170); g.lineTo(170, 40); g.stroke();
    g.strokeStyle = "#a0723c"; g.lineWidth = 10; g.stroke();
    g.strokeStyle = "#6b4520"; g.lineWidth = 3; for (const t of [0.3, 0.55, 0.8]) { g.beginPath(); g.arc(30 + 140 * t, 170 - 130 * t, 8, 0, 7); g.stroke(); }
  },
  chiiku: (g) => {   // おやつが出るボール
    g.fillStyle = "#63e6be"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(95, 95, 66, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#1a1a2e"; g.beginPath(); g.arc(120, 115, 14, 0, 7); g.fill();
    g.fillStyle = "#c8873a"; g.lineWidth = 5; for (const [x, y] of [[150, 165], [175, 150]] as const) { g.beginPath(); g.ellipse(x, y, 13, 9, 0.4, 0, 7); g.fill(); g.stroke(); }
  },
  denmouse: (g) => {   // 電動ねずみ（電池マーク）
    g.fillStyle = "#e9ecef"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(25, 135); g.quadraticCurveTo(60, 60, 150, 110); g.lineTo(150, 140); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffc9c9"; g.beginPath(); g.arc(70, 85, 15, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(150, 125); g.quadraticCurveTo(185, 120, 190, 150); g.stroke();
    battery(g, 130, 45);
  },
  autolaser: (g) => {   // 台の上のレーザー
    g.fillStyle = "#495057"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(45, 120, 90, 55, 12); g.fill(); g.stroke();
    g.fillStyle = "#868e96"; g.beginPath(); g.arc(90, 105, 26, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#ff3b3b"; g.lineWidth = 5; g.beginPath(); g.moveTo(100, 95); g.lineTo(175, 40); g.stroke();
    g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(175, 40, 10, 0, 7); g.fill();
    battery(g, 40, 50);
  },
  pichifish: (g) => {   // ぴちぴち魚
    g.fillStyle = "#4dabf7"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(25, 110); g.quadraticCurveTo(80, 50, 140, 105); g.lineTo(185, 70); g.lineTo(175, 110); g.lineTo(185, 150); g.lineTo(140, 115); g.quadraticCurveTo(80, 165, 25, 110); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(55, 102, 9, 0, 7); g.fill(); g.stroke();
    battery(g, 100, 40);
  },
  kurukuru: (g) => {   // 台と回る羽根
    g.fillStyle = "#ffd8a8"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(100, 160, 70, 22, 0, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(100, 150); g.lineTo(100, 90); g.stroke();
    g.fillStyle = "#ff9ec4"; g.lineWidth = 5; for (const a of [0, 2.1, 4.2]) { g.save(); g.translate(100, 85); g.rotate(a); g.beginPath(); g.ellipse(38, 0, 40, 11, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    battery(g, 160, 40);
  },
};

/** 電池のしるし（電池式のおもちゃ）。 */
function battery(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = "#69db7c"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(x - 26, y - 14, 48, 28, 5); g.fill(); g.stroke();
  g.fillStyle = INK; g.fillRect(x + 22, y - 6, 6, 12);
}

/** レリックの絵。 */
const RELIC_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  oyatsu: (g) => {   // 肉球型クッキー
    g.fillStyle = "#e8a95b"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 105, 72, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#8a4b1c";
    g.beginPath(); g.ellipse(100, 125, 26, 21, 0, 0, 7); g.fill();
    for (const [x, y] of [[66, 90], [86, 70], [114, 70], [134, 90]]) { g.beginPath(); g.ellipse(x, y, 10, 12, 0, 0, 7); g.fill(); }
  },
  milk: (g) => {   // ミルク皿
    g.fillStyle = "#74c0fc"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(100, 130, 82, 34, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(100, 120, 62, 20, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(70, 70, 12, 0, 7); g.arc(100, 55, 9, 0, 7); g.fill();
  },
  moufu: (g) => {   // たたんだ毛布
    g.fillStyle = "#b197fc"; g.strokeStyle = INK; g.lineWidth = 7;
    for (const y of [120, 90, 60]) { g.beginPath(); g.roundRect(30, y, 140, 36, 14); g.fill(); g.stroke(); }
    g.strokeStyle = "#fff"; g.lineWidth = 4; g.setLineDash([8, 8]); for (const y of [138, 108, 78]) { g.beginPath(); g.moveTo(45, y); g.lineTo(155, y); g.stroke(); } g.setLineDash([]);
  },
  cream: (g) => {   // クリームのびん
    g.fillStyle = "#ffc9c9"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(45, 80, 110, 90, 18); g.fill(); g.stroke();
    g.fillStyle = "#ff8787"; g.beginPath(); g.roundRect(40, 50, 120, 36, 10); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(100, 128, 22, 18, 0, 0, 7); g.fill();
    for (const [x, y] of [[78, 106], [92, 98], [108, 98], [122, 106]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
  },
  nekokusa: (g) => {   // 鉢植えの猫草
    g.fillStyle = "#e8590c"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(55, 120); g.lineTo(145, 120); g.lineTo(130, 180); g.lineTo(70, 180); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#40c057"; g.lineWidth = 10;
    for (const [x, a] of [[70, -0.4], [88, -0.15], [100, 0], [112, 0.15], [130, 0.4]] as const) { g.beginPath(); g.moveTo(x + 10, 118); g.lineTo(x + 10 + Math.sin(a) * 70, 118 - Math.cos(a) * 90); g.stroke(); }
  },
  tower: (g) => {   // キャットタワー
    g.fillStyle = "#d9a066"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.rect(88, 40, 24, 140); g.fill(); g.stroke();
    g.fillStyle = "#f783ac";
    for (const [x, y, w] of [[40, 165, 120], [55, 105, 90], [70, 40, 70]] as const) { g.beginPath(); g.roundRect(x, y, w, 20, 8); g.fill(); g.stroke(); }
  },
  mushikago: (g) => {   // 虫かご
    g.fillStyle = "#c3fae8"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(35, 60, 130, 115, 14); g.fill(); g.stroke();
    g.strokeStyle = "#20c997"; g.lineWidth = 4; for (let x = 55; x < 160; x += 18) { g.beginPath(); g.moveTo(x, 66); g.lineTo(x, 170); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(100, 15, 140, 60); g.stroke();
  },
  hige: (g) => {   // ひげ
    g.fillStyle = "#ffd8a8"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.ellipse(100, 110, 30, 22, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff8fa3"; g.beginPath(); g.moveTo(90, 98); g.lineTo(110, 98); g.lineTo(100, 110); g.closePath(); g.fill();
    g.lineWidth = 5; for (const s of [-1, 1]) for (const d of [-18, 0, 18]) { g.beginPath(); g.moveTo(100 + s * 28, 112 + d / 3); g.lineTo(100 + s * 92, 112 + d); g.stroke(); }
  },
  hinata: (g) => {   // 日なたクッション
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 6; spikyBlob(g, 150, 50, 22, 38, 8); g.fill(); g.stroke();
    g.fillStyle = "#ff922b"; g.lineWidth = 7; g.beginPath(); g.ellipse(95, 140, 80, 36, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ffc078"; g.beginPath(); g.ellipse(95, 132, 56, 18, 0, 0, 7); g.fill();
  },
  nezumi: (g) => {   // ねずみのおもちゃ
    g.fillStyle = "#adb5bd"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(170, 120); g.quadraticCurveTo(120, 50, 55, 120); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffc9c9"; g.beginPath(); g.arc(120, 78, 16, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(150, 100, 5, 0, 7); g.fill();
    g.lineWidth = 5; g.beginPath(); g.moveTo(55, 120); g.quadraticCurveTo(20, 150, 40, 175); g.stroke();
  },
  maneki: (g) => {   // 招き猫
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(100, 140, 55, 45, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(100, 80, 48, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(62, 55); g.lineTo(66, 22); g.lineTo(90, 38); g.moveTo(138, 55); g.lineTo(134, 22); g.lineTo(110, 38); g.stroke();
    g.beginPath(); g.ellipse(160, 70, 16, 28, 0.2, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#e03131"; g.beginPath(); g.roundRect(65, 118, 70, 12, 6); g.fill();
    g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(100, 140, 13, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(84, 80, 5, 0, 7); g.arc(116, 80, 5, 0, 7); g.fill();
  },
  shippo: (g) => {   // ふわふわしっぽ
    g.fillStyle = "#ff922b"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(40, 170); g.bezierCurveTo(10, 90, 80, 20, 150, 40); g.bezierCurveTo(190, 55, 175, 95, 140, 90); g.bezierCurveTo(90, 80, 70, 120, 75, 170); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff4e6"; g.beginPath(); g.ellipse(155, 62, 22, 18, 0.3, 0, 7); g.fill();
  },
  towel: (g) => {   // ぬれタオル
    g.fillStyle = "#99e9f2"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(40, 40, 120, 130, 12); g.fill(); g.stroke();
    g.strokeStyle = "#3bc9db"; g.lineWidth = 6; for (const y of [70, 150]) { g.beginPath(); g.moveTo(45, y); g.lineTo(155, y); g.stroke(); }
    ELEMENT_DRAW.wet(g, 150, 150, 0.35);
  },
  sheet: (g) => {   // 静電気シート
    g.fillStyle = "#e5dbff"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(30, 60, 140, 100, 10); g.fill(); g.stroke();
    g.save(); g.translate(30, 0); g.scale(0.7, 0.7); ELEMENT_DRAW.static(g); g.restore();
  },
  biidama: (g) => {   // ビー玉
    for (const [x, y, c] of [[75, 110, "#74c0fc"], [130, 90, "#f783ac"], [115, 145, "#ffd43b"]] as const) {
      g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 36, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(x - 12, y - 14, 10, 6, -0.6, 0, 7); g.fill();
    }
  },
  kaitenguruma: (g) => {   // ハムスターの回し車
    g.strokeStyle = INK; g.lineWidth = 8; g.fillStyle = "#e7f5ff"; g.beginPath(); g.arc(100, 95, 70, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#4dabf7"; g.lineWidth = 5; for (let k = 0; k < 8; k++) { const a = k * 0.785; g.beginPath(); g.moveTo(100, 95); g.lineTo(100 + Math.cos(a) * 66, 95 + Math.sin(a) * 66); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(60, 185); g.lineTo(100, 95); g.lineTo(140, 185); g.stroke();
  },
  buzzer: (g) => {   // 防犯ブザー
    g.fillStyle = "#fcc419"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(55, 60, 90, 120, 30); g.fill(); g.stroke();
    g.fillStyle = "#fa5252"; g.beginPath(); g.arc(100, 105, 22, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(100, 45, 18, Math.PI, 0); g.stroke();
    g.strokeStyle = "#fa5252"; g.lineWidth = 5; for (const r of [70, 85]) { g.beginPath(); g.arc(100, 110, r, -0.5, 0.5); g.stroke(); }
  },
  omamori: (g) => {   // ペットのお守り
    g.fillStyle = "#e64980"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(60, 60); g.lineTo(140, 60); g.lineTo(140, 175); g.lineTo(60, 175); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(100, 35, 140, 60); g.stroke();
    g.fillStyle = "#ffd43b"; g.beginPath(); g.ellipse(100, 115, 18, 22, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#ffd43b"; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 40); g.quadraticCurveTo(90, 20, 110, 15); g.stroke();
  },
  nekokan: (g) => {   // 高級猫缶
    g.fillStyle = "#ced4da"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(100, 70, 70, 22, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#e64980"; g.beginPath(); g.rect(30, 70, 140, 80); g.fill(); g.stroke();
    g.fillStyle = "#ced4da"; g.beginPath(); g.ellipse(100, 150, 70, 22, 0, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.fillText("極上", 100, 122);
  },
  copy: (g) => {   // コピー用紙の束
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const [x, y, a] of [[70, 70, -0.15], [95, 85, 0.05], [120, 100, 0.2]] as const) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.rect(-40, -50, 80, 100); g.fill(); g.stroke(); g.restore(); }
    g.strokeStyle = "#adb5bd"; g.lineWidth = 4; for (const y of [80, 95, 110]) { g.beginPath(); g.moveTo(98, y + 10); g.lineTo(142, y + 18); g.stroke(); }
  },
};

/** 装備の絵（飼い主が買ってきた、よくわからない物）。 */
const GEAR_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  hibiscus: (g) => {   // ハイビスカスの髪飾り
    g.strokeStyle = INK; g.lineWidth = 6; g.fillStyle = "#ff6b6b";
    for (let k = 0; k < 5; k++) { g.save(); g.translate(100, 100); g.rotate(k * 1.2566); g.beginPath(); g.ellipse(0, -42, 30, 42, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(100, 100, 16, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#c92a2a"; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 100); g.lineTo(150, 55); g.stroke();
  },
  aloha: (g) => {   // アロハシャツ
    g.fillStyle = "#1c7ed6"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(65, 35); g.lineTo(135, 35); g.lineTo(178, 75); g.lineTo(155, 100); g.lineTo(145, 90); g.lineTo(145, 178); g.lineTo(55, 178); g.lineTo(55, 90); g.lineTo(45, 100); g.lineTo(22, 75); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(80, 35); g.lineTo(100, 70); g.lineTo(120, 35); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ff8787"; for (const [x, y] of [[78, 110], [122, 135], [85, 158], [125, 95]] as const) { for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.26) * 9, y + Math.sin(k * 1.26) * 9, 7, 5, k * 1.26, 0, 7); g.fill(); } }
    g.fillStyle = "#ffd43b"; for (const [x, y] of [[78, 110], [122, 135], [85, 158], [125, 95]] as const) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  },
  lei: (g) => {   // フラのレイ
    const cols = ["#ff8787", "#ffd43b", "#f783ac", "#ff922b", "#fff"];
    g.strokeStyle = INK; g.lineWidth = 4;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(100 + Math.cos(a) * 66, 95 + Math.sin(a) * 52, 15, 0, 7); g.fill(); g.stroke(); }
  },
  halo: (g) => {   // 天使の輪カチューシャ
    g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = "#fff3bf";
    g.beginPath(); g.ellipse(100, 55, 62, 20, 0, 0, 7); g.lineWidth = 26; g.strokeStyle = INK; g.stroke(); g.lineWidth = 16; g.strokeStyle = "#ffd43b"; g.stroke();
    g.strokeStyle = "#adb5bd"; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 75); g.lineTo(100, 125); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 12; g.beginPath(); g.arc(100, 190, 75, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    g.strokeStyle = "#f783ac"; g.lineWidth = 6; g.stroke();
  },
  wings: (g) => {   // 天使の羽
    g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 6;
    for (const s of [-1, 1]) {
      g.save(); g.translate(100, 100); g.scale(s, 1);
      g.beginPath(); g.moveTo(8, 0); g.bezierCurveTo(40, -70, 95, -60, 92, -20); g.bezierCurveTo(95, 10, 70, 20, 60, 15); g.bezierCurveTo(60, 40, 30, 50, 8, 30); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(25, -10); g.lineTo(70, -30); g.moveTo(25, 10); g.lineTo(60, 5); g.stroke(); g.restore();
    }
    g.fillStyle = "#f783ac"; g.beginPath(); g.arc(100, 100, 12, 0, 7); g.fill(); g.stroke();
  },
  heartCollar: (g) => collar(g, "#e64980", (gg) => {
    gg.fillStyle = "#ff8cc6"; gg.beginPath(); gg.moveTo(100, 180); gg.bezierCurveTo(60, 150, 70, 120, 100, 138); gg.bezierCurveTo(130, 120, 140, 150, 100, 180); gg.fill(); gg.stroke();
    gg.fillStyle = "#fff"; gg.beginPath(); gg.arc(90, 145, 4, 0, 7); gg.fill();
  }),
  mikan: (g) => {   // みかんの被り物（顔の穴つき）
    g.fillStyle = "#ff922b"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 108, 78, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#e8590c"; for (let k = 0; k < 14; k++) { const a = k * 0.45; g.beginPath(); g.arc(100 + Math.cos(a) * 60, 108 + Math.sin(a) * 60, 3, 0, 7); g.fill(); }
    g.fillStyle = "#fff4e6"; g.beginPath(); g.ellipse(100, 118, 40, 34, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#51cf66"; g.beginPath(); g.ellipse(120, 30, 26, 12, -0.5, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#5c940d"; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 32); g.lineTo(100, 45); g.stroke();
  },
  suika: (g) => {   // スイカ柄のTシャツ
    g.fillStyle = "#ff6b6b"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(65, 40); g.lineTo(135, 40); g.lineTo(175, 75); g.lineTo(152, 98); g.lineTo(145, 90); g.lineTo(145, 175); g.lineTo(55, 175); g.lineTo(55, 90); g.lineTo(48, 98); g.lineTo(25, 75); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#40c057"; g.beginPath(); g.rect(57, 155, 86, 18); g.fill();
    g.fillStyle = INK; for (const [x, y] of [[80, 85], [115, 95], [95, 120], [125, 130], [75, 135]] as const) { g.beginPath(); g.ellipse(x, y, 4, 7, 0.3, 0, 7); g.fill(); }
  },
  cherry: (g) => collar(g, "#fab005", (gg) => {
    gg.strokeStyle = "#2b8a3e"; gg.lineWidth = 5; gg.beginPath(); gg.moveTo(100, 138); gg.lineTo(82, 165); gg.moveTo(100, 138); gg.lineTo(120, 162); gg.stroke();
    gg.strokeStyle = INK; gg.fillStyle = "#e03131"; for (const x of [80, 122]) { gg.beginPath(); gg.arc(x, 172, 14, 0, 7); gg.fill(); gg.stroke(); }
  }),
  beanie: (g) => {   // 毛糸の帽子（耳穴ずれ）
    g.fillStyle = "#40c057"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(100, 125, 70, Math.PI, 0); g.lineTo(170, 150); g.lineTo(30, 150); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(28, 132, 144, 28, 10); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(100, 48, 18, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#2b8a3e"; for (const [x, y] of [[62, 92], [128, 80]] as const) { g.beginPath(); g.ellipse(x, y, 13, 9, 0, 0, 7); g.fill(); g.stroke(); }
  },
  sweater: (g) => {   // 手編みのセーター（猫の顔もよう）
    g.fillStyle = "#c0eb75"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(62, 38); g.lineTo(138, 38); g.lineTo(178, 80); g.lineTo(158, 170); g.lineTo(138, 165); g.lineTo(140, 178); g.lineTo(60, 178); g.lineTo(62, 165); g.lineTo(42, 170); g.lineTo(22, 80); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ff922b"; g.beginPath(); g.moveTo(75, 95); g.lineTo(82, 72); g.lineTo(95, 88); g.lineTo(105, 88); g.lineTo(118, 72); g.lineTo(125, 95); g.arc(100, 110, 28, -0.3, Math.PI + 0.3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(90, 105, 4, 0, 7); g.arc(110, 105, 4, 0, 7); g.fill();
    g.strokeStyle = "#5c940d"; g.lineWidth = 4; for (const y of [150, 162]) { g.beginPath(); g.moveTo(62, y); g.lineTo(138, y); g.stroke(); }
  },
  sunglass: (g) => {   // ハート形のおもちゃサングラス
    g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = "#f06595";
    for (const x of [62, 138]) { g.beginPath(); g.moveTo(x, 135); g.bezierCurveTo(x - 55, 100, x - 35, 55, x, 82); g.bezierCurveTo(x + 35, 55, x + 55, 100, x, 135); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(88, 88); g.quadraticCurveTo(100, 78, 112, 88); g.stroke();
    g.fillStyle = "#fff"; for (const x of [50, 126]) { g.beginPath(); g.ellipse(x, 88, 8, 5, -0.5, 0, 7); g.fill(); }
  },
  haramaki: (g) => {   // 毛糸の腹巻き
    g.fillStyle = "#e03131"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(30, 60, 140, 85, 20); g.fill(); g.stroke();
    g.strokeStyle = "#ffc9c9"; g.lineWidth = 5; for (let x = 45; x < 160; x += 16) { g.beginPath(); g.moveTo(x, 66); g.lineTo(x, 140); g.stroke(); }
    g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(100, 102, 18, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  },
  bowtie: (g) => {   // 金の蝶ネクタイ
    g.fillStyle = "#fcc419"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(100, 100); g.lineTo(30, 55); g.lineTo(30, 145); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(100, 100); g.lineTo(170, 55); g.lineTo(170, 145); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f08c00"; g.beginPath(); g.roundRect(84, 82, 32, 36, 8); g.fill(); g.stroke();
  },
  usamimi: (g) => {   // うさ耳フード
    g.fillStyle = "#fff0f6"; g.strokeStyle = INK; g.lineWidth = 7;
    for (const [x, a] of [[70, -0.25], [130, 0.25]] as const) { g.save(); g.translate(x, 95); g.rotate(a); g.beginPath(); g.ellipse(0, -45, 22, 55, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#ffc9c9"; g.beginPath(); g.ellipse(0, -45, 10, 38, 0, 0, 7); g.fill(); g.fillStyle = "#fff0f6"; g.restore(); }
    g.beginPath(); g.arc(100, 140, 58, Math.PI, 0); g.lineTo(158, 175); g.lineTo(42, 175); g.closePath(); g.fill(); g.stroke();
  },
  raincoat: (g) => {   // 黄色いレインコート
    g.fillStyle = "#ffd43b"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(70, 40); g.quadraticCurveTo(100, 15, 130, 40); g.lineTo(175, 175); g.lineTo(25, 175); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; for (const y of [80, 110, 140]) { g.beginPath(); g.arc(100, y, 7, 0, 7); g.fill(); g.stroke(); }
    ELEMENT_DRAW.wet(g, 160, 50, 0.3);
  },
  gps: (g) => collar(g, "#4c6ef5", (gg) => {
    gg.fillStyle = "#343a40"; gg.beginPath(); gg.roundRect(72, 132, 56, 40, 8); gg.fill(); gg.stroke();
    gg.fillStyle = "#51cf66"; gg.beginPath(); gg.arc(100, 152, 7, 0, 7); gg.fill();
    gg.strokeStyle = "#51cf66"; gg.lineWidth = 3; for (const r of [14, 22]) { gg.beginPath(); gg.arc(100, 152, r, -2.4, -0.7); gg.stroke(); }
  }),
  nametag: (g) => collar(g, "#2f9e44", (gg) => {
    gg.fillStyle = "#fff"; gg.beginPath(); gg.roundRect(68, 135, 64, 46, 8); gg.fill(); gg.stroke();
    gg.fillStyle = INK; gg.font = "bold 18px sans-serif"; gg.textAlign = "center"; gg.fillText("かわいい", 100, 165);
  }),
};

/** 首輪の土台と飾り。 */
function collar(g: CanvasRenderingContext2D, color: string, charm: (g: CanvasRenderingContext2D) => void) {
  g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.ellipse(100, 95, 70, 45, 0, 0, 7); g.stroke();
  g.strokeStyle = color; g.lineWidth = 18; g.stroke();
  g.lineWidth = 6; g.strokeStyle = INK; charm(g);
}

/** 扉のごほうびの絵（丸いバッジ）。 */
const REWARD_DRAW: Record<RewardKind, (g: CanvasRenderingContext2D) => void> = {
  hp: (g) => {
    g.fillStyle = "#ff5f7e"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(100, 170); g.bezierCurveTo(10, 105, 30, 30, 100, 65); g.bezierCurveTo(170, 30, 190, 105, 100, 170); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("+", 100, 108);
  },
  mp: (g) => {
    g.fillStyle = "#3fa7ff"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(115, 15); g.lineTo(45, 115); g.lineTo(95, 115); g.lineTo(80, 185); g.lineTo(155, 80); g.lineTo(105, 80); g.closePath(); g.fill(); g.stroke();
  },
  spell: (g) => {   // ごほうびの包み（技・修飾）
    g.fillStyle = "#ffb52e"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.roundRect(35, 75, 130, 100, 14); g.fill(); g.stroke();
    g.fillStyle = "#ff6b6b"; g.beginPath(); g.rect(88, 75, 24, 100); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(75, 58, 30, 18, -0.4, 0, 7); g.ellipse(125, 58, 30, 18, 0.4, 0, 7); g.fill(); g.stroke();
  },
  toy: (g) => TOY_DRAW.jarashi(g),
  relic: (g) => {   // 光る宝石
    g.fillStyle = "#63e6be"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(100, 25); g.lineTo(165, 80); g.lineTo(100, 180); g.lineTo(35, 80); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(35, 80); g.lineTo(165, 80); g.moveTo(70, 80); g.lineTo(100, 25); g.lineTo(130, 80); g.lineTo(100, 180); g.lineTo(70, 80); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(80, 62, 10, 6, -0.6, 0, 7); g.fill();
  },
  gear: (g) => GEAR_DRAW.mikan(g),
  shop: (g) => {   // お店（ボス猫の顔と小銭袋）
    g.fillStyle = "#adb5bd"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(40, 90); g.lineTo(50, 30); g.lineTo(85, 60); g.lineTo(115, 60); g.lineTo(150, 30); g.lineTo(160, 90); g.bezierCurveTo(175, 165, 25, 165, 40, 90); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(68, 100); g.lineTo(92, 100); g.moveTo(108, 100); g.lineTo(132, 100); g.lineWidth = 6; g.stroke();
    g.fillStyle = "#fab005"; g.beginPath(); g.arc(145, 150, 30, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("¥", 145, 152);
  },
  boss: (g) => {
    g.fillStyle = "#ffcf3a"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.arc(100, 105, 70, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(55, 50, 22, 110); g.fillRect(123, 50, 22, 110);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(80, 95, 16, 0, 7); g.arc(120, 95, 16, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(83, 98, 8, 0, 7); g.arc(123, 98, 8, 0, 7); g.fill();
    g.lineWidth = 8; g.beginPath(); g.moveTo(62, 72); g.lineTo(95, 84); g.moveTo(138, 72); g.lineTo(105, 84); g.stroke();
  },
  treasure: (g) => {   // 宝箱（通販の箱にリボン）
    g.fillStyle = "#e8a95b"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.roundRect(30, 85, 140, 90, 10); g.fill(); g.stroke();
    g.fillStyle = "#d08a40"; g.beginPath(); g.moveTo(20, 85); g.lineTo(100, 50); g.lineTo(180, 85); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; g.beginPath(); g.rect(88, 60, 24, 115); g.fill(); g.stroke();
    g.fillStyle = "#fff"; spikyBlob(g, 150, 45, 6, 18, 4); g.fill();
  },
  rest: (g) => {   // ママのひざ（エプロンとハート）
    g.fillStyle = "#ffc9c9"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.roundRect(30, 95, 140, 75, 30); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(60, 105, 80, 55, 12); g.fill(); g.stroke();
    g.fillStyle = "#ff5f7e"; g.beginPath(); g.moveTo(100, 85); g.bezierCurveTo(55, 55, 70, 15, 100, 40); g.bezierCurveTo(130, 15, 145, 55, 100, 85); g.fill(); g.stroke();
  },
  fusion: (g) => {   // 融合台（ミキサー）
    g.fillStyle = "rgba(208,235,255,.95)"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(55, 30); g.lineTo(145, 30); g.lineTo(130, 130); g.lineTo(70, 130); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#b197fc"; g.beginPath(); g.moveTo(62, 80); g.lineTo(138, 80); g.lineTo(130, 130); g.lineTo(70, 130); g.closePath(); g.fill();
    g.fillStyle = "#7048e8"; g.beginPath(); g.roundRect(50, 130, 100, 50, 10); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(100, 155, 10, 0, 7); g.fill();
  },
  challenge: (g) => {   // 光る虫の目と「！」
    g.fillStyle = "#ff8787"; g.strokeStyle = INK; g.lineWidth = 8; spikyBlob(g, 100, 100, 55, 82, 9); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.roundRect(88, 45, 24, 75, 10); g.fill(); g.beginPath(); g.arc(100, 145, 13, 0, 7); g.fill();
  },
  curse: (g) => {   // あやしい箱（むらさきの煙）
    g.fillStyle = "#b197fc"; g.beginPath(); for (const [x, y, r] of [[70, 55, 26], [105, 40, 30], [135, 60, 24]] as const) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); } g.fill();
    g.fillStyle = "#5f3dc4"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.roundRect(35, 90, 130, 85, 10); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; g.font = "bold 60px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 100, 135);
  },
  next: (g) => {
    g.fillStyle = "#69db7c"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(25, 80); g.lineTo(110, 80); g.lineTo(110, 40); g.lineTo(180, 100); g.lineTo(110, 160); g.lineTo(110, 120); g.lineTo(25, 120); g.closePath(); g.fill(); g.stroke();
  },
};

const cache = new Map<string, HTMLCanvasElement>();
const once = (key: string, make: () => HTMLCanvasElement) => { let c = cache.get(key); if (!c) { c = make(); cache.set(key, c); } return c; };

export const techCanvas = (t: Exclude<TechFx, "enemy" | "gas">) => once(`tech:${t}`, () => stickerCanvas(S, S, TECH_DRAW[t], 0.05));
export const elementCanvas = (e: keyof typeof ELEMENT_DRAW) => once(`el:${e}`, () => stickerCanvas(S, S, (g) => ELEMENT_DRAW[e](g), 0.05));
export const rewardCanvas = (k: RewardKind) => once(`reward:${k}`, () => stickerCanvas(S, S, REWARD_DRAW[k], 0.05));

/** 技・修飾のアイコン（技は飛ぶ絵と同じ）。 */
export function spellCanvas(id: string, tech?: TechFx): HTMLCanvasElement {
  if (tech && tech !== "enemy" && tech !== "gas") return techCanvas(tech);
  return once(`mod:${id}`, () => stickerCanvas(S, S, MOD_DRAW[id] ?? ((g) => { g.fillStyle = "#ccc"; g.fillRect(50, 50, 100, 100); }), 0.05));
}
/** カリカリ（お金）の粒。 */
export const kibbleCanvas = () => once("kibble", () => stickerCanvas(120, 120, (g) => {
  g.fillStyle = "#c8873a"; g.strokeStyle = INK; g.lineWidth = 6;
  for (const [x, y, a] of [[45, 60, 0.3], [75, 50, -0.4], [62, 82, 1.2]] as const) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 22, 15, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#e0a85a"; g.beginPath(); g.ellipse(-5, -4, 8, 4, 0, 0, 7); g.fill(); g.fillStyle = "#c8873a"; g.restore(); }
}, 0.06));

export const relicCanvas = (id: string) => once(`relic:${id}`, () => stickerCanvas(S, S, RELIC_DRAW[id], 0.05));
export const gearCanvas = (id: string) => once(`gear:${id}`, () => stickerCanvas(S, S, GEAR_DRAW[id], 0.05));
export const toyCanvas = (id: string) => once(`toy:${id}`, () => stickerCanvas(S, S, TOY_DRAW[id] ?? TOY_DRAW.jarashi, 0.05));

const urls = new Map<HTMLCanvasElement, string>();
/** UI 用の画像 URL。 */
export const urlOf = (c: HTMLCanvasElement) => { let u = urls.get(c); if (!u) { u = c.toDataURL(); urls.set(c, u); } return u; };
