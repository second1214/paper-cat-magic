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
const TECH_DRAW: Record<Exclude<TechFx, "enemy">, (g: CanvasRenderingContext2D) => void> = {
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
  double: (g) => {   // 肉球ふたつ
    for (const [x, y] of [[65, 90], [135, 115]] as const) {
      g.fillStyle = "#ffb3c1"; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.ellipse(x, y + 20, 30, 25, 0, 0, 7); g.fill(); g.stroke();
      for (const [dx, dy] of [[-28, -18], [-10, -34], [10, -34], [28, -18]]) { g.beginPath(); g.ellipse(x + dx, y + dy, 10, 12, 0, 0, 7); g.fill(); g.stroke(); }
    }
    g.fillStyle = INK; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.fillText("×2", 150, 55);
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
};

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
};

/** 装備の絵。色でセットがわかる（忍者=紺、魔法使い=紫、騎士=銀）。 */
const GEAR_DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  ninjaHat: (g) => {
    g.fillStyle = "#364fc7"; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(100, 110, 70, Math.PI, 0); g.lineTo(170, 130); g.lineTo(30, 130); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(55, 95, 90, 22, 10); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(80, 106, 6, 0, 7); g.arc(120, 106, 6, 0, 7); g.fill();
    g.strokeStyle = "#364fc7"; g.lineWidth = 10; g.beginPath(); g.moveTo(165, 115); g.quadraticCurveTo(190, 140, 175, 175); g.stroke();
  },
  ninjaBody: (g) => {
    g.fillStyle = "#364fc7"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(60, 40); g.lineTo(140, 40); g.lineTo(175, 90); g.lineTo(150, 100); g.lineTo(145, 175); g.lineTo(55, 175); g.lineTo(50, 100); g.lineTo(25, 90); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.moveTo(80, 40); g.lineTo(100, 90); g.lineTo(120, 40); g.stroke();
    g.fillStyle = "#e03131"; g.beginPath(); g.rect(52, 120, 96, 14); g.fill();
  },
  ninjaCollar: (g) => collar(g, "#364fc7", (gg) => { gg.fillStyle = "#adb5bd"; gg.beginPath(); gg.moveTo(100, 140); gg.lineTo(115, 170); gg.lineTo(85, 170); gg.closePath(); gg.fill(); gg.stroke(); }),
  wizHat: (g) => {
    g.fillStyle = "#7048e8"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(100, 160, 85, 22, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(55, 155); g.quadraticCurveTo(95, 60, 140, 20); g.quadraticCurveTo(130, 90, 148, 155); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; spikyBlob(g, 100, 115, 9, 22, 5); g.fill(); g.stroke();
  },
  wizBody: (g) => {
    g.fillStyle = "#7048e8"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(70, 35); g.lineTo(130, 35); g.lineTo(175, 175); g.lineTo(25, 175); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffd43b"; for (const [x, y] of [[80, 110], [125, 140], [105, 80]] as const) { spikyBlob(g, x, y, 6, 15, 5); g.fill(); }
  },
  wizCollar: (g) => collar(g, "#7048e8", (gg) => { gg.fillStyle = "#ffd43b"; spikyBlob(gg, 100, 155, 9, 20, 5); gg.fill(); gg.stroke(); }),
  knightHat: (g) => {
    g.fillStyle = "#ced4da"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.arc(100, 120, 70, Math.PI, 0); g.lineTo(170, 165); g.lineTo(30, 165); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.rect(60, 115, 80, 12); g.fill();
    g.fillStyle = "#e03131"; g.beginPath(); g.moveTo(100, 50); g.quadraticCurveTo(140, 10, 170, 30); g.quadraticCurveTo(140, 30, 110, 55); g.closePath(); g.fill(); g.stroke();
  },
  knightBody: (g) => {
    g.fillStyle = "#ced4da"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(50, 45); g.lineTo(150, 45); g.lineTo(160, 120); g.quadraticCurveTo(100, 190, 40, 120); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#868e96"; g.lineWidth = 6; g.beginPath(); g.moveTo(100, 50); g.lineTo(100, 160); g.moveTo(55, 95); g.lineTo(145, 95); g.stroke();
  },
  knightCollar: (g) => collar(g, "#868e96", (gg) => {
    gg.fillStyle = "#ced4da"; gg.beginPath(); gg.moveTo(80, 135); gg.lineTo(120, 135); gg.lineTo(118, 160); gg.quadraticCurveTo(100, 185, 82, 160); gg.closePath(); gg.fill(); gg.stroke();
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
  gear: (g) => GEAR_DRAW.wizHat(g),
  boss: (g) => {
    g.fillStyle = "#ffcf3a"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.arc(100, 105, 70, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(55, 50, 22, 110); g.fillRect(123, 50, 22, 110);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(80, 95, 16, 0, 7); g.arc(120, 95, 16, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(83, 98, 8, 0, 7); g.arc(123, 98, 8, 0, 7); g.fill();
    g.lineWidth = 8; g.beginPath(); g.moveTo(62, 72); g.lineTo(95, 84); g.moveTo(138, 72); g.lineTo(105, 84); g.stroke();
  },
  next: (g) => {
    g.fillStyle = "#69db7c"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(25, 80); g.lineTo(110, 80); g.lineTo(110, 40); g.lineTo(180, 100); g.lineTo(110, 160); g.lineTo(110, 120); g.lineTo(25, 120); g.closePath(); g.fill(); g.stroke();
  },
};

const cache = new Map<string, HTMLCanvasElement>();
const once = (key: string, make: () => HTMLCanvasElement) => { let c = cache.get(key); if (!c) { c = make(); cache.set(key, c); } return c; };

export const techCanvas = (t: Exclude<TechFx, "enemy">) => once(`tech:${t}`, () => stickerCanvas(S, S, TECH_DRAW[t], 0.05));
export const elementCanvas = (e: keyof typeof ELEMENT_DRAW) => once(`el:${e}`, () => stickerCanvas(S, S, (g) => ELEMENT_DRAW[e](g), 0.05));
export const rewardCanvas = (k: RewardKind) => once(`reward:${k}`, () => stickerCanvas(S, S, REWARD_DRAW[k], 0.05));

/** 技・修飾のアイコン（技は飛ぶ絵と同じ）。 */
export function spellCanvas(id: string, tech?: TechFx): HTMLCanvasElement {
  if (tech && tech !== "enemy") return techCanvas(tech);
  return once(`mod:${id}`, () => stickerCanvas(S, S, MOD_DRAW[id] ?? ((g) => { g.fillStyle = "#ccc"; g.fillRect(50, 50, 100, 100); }), 0.05));
}
export const relicCanvas = (id: string) => once(`relic:${id}`, () => stickerCanvas(S, S, RELIC_DRAW[id], 0.05));
export const gearCanvas = (id: string) => once(`gear:${id}`, () => stickerCanvas(S, S, GEAR_DRAW[id], 0.05));
export const toyCanvas = (id: string) => once(`toy:${id}`, () => stickerCanvas(S, S, TOY_DRAW[id] ?? TOY_DRAW.jarashi, 0.05));

const urls = new Map<HTMLCanvasElement, string>();
/** UI 用の画像 URL。 */
export const urlOf = (c: HTMLCanvasElement) => { let u = urls.get(c); if (!u) { u = c.toDataURL(); urls.set(c, u); } return u; };
