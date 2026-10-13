// 部屋（ステージ）の形・テーマ・季節・家具。DOM・three.js 非依存。
//
// 部屋は 1マス=1 の升目でできている。テンプレートの記号:
//   # 壁   . 床   o 家具（まとまりごとに1つの家具になる）   E 入口   1/2/3 出口（扉）の候補
import type { Rng } from "../core/rng";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Theme =
  | "garden" | "pond" | "veggie"   // 外（お庭）
  | "living" | "bedroom" | "study" | "washitsu" | "western" | "kitchen" | "bath" | "entrance";

export const SEASON_NAME: Record<Season, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
export const THEME_NAME: Record<Theme, string> = {
  garden: "お庭", pond: "池のあるお庭", veggie: "家庭菜園", living: "リビング", bedroom: "寝室", study: "書斎", washitsu: "和室",
  western: "洋室", kitchen: "キッチン", bath: "お風呂場", entrance: "玄関",
};
/** 外のステージ（芝生の床・生け垣の壁）。 */
export const OUTDOOR: Theme[] = ["garden", "pond", "veggie"];
export const SEASONS: Season[] = ["autumn", "winter", "spring", "summer"]; // 虫が一番多い夏が最終章
export const THEMES: Theme[] = ["garden", "pond", "veggie", "living", "bedroom", "study", "washitsu", "western", "kitchen", "bath", "entrance"];

export const enum Cell { Floor = 0, Wall = 1, Prop = 2, Door = 3 }

export type PropKind =
  | "bush" | "flowerbed" | "rock" | "tree"
  | "sofa" | "table" | "tvstand" | "plant"
  | "bed" | "dresser" | "nightstand"
  | "bookshelf" | "desk" | "boxes"
  | "chabudai" | "kotatsu" | "tansu"
  | "piano" | "armchair" | "chest"
  | "fridge" | "counter" | "dining" | "tub" | "washer" | "shoerack" | "umbrella"
  | "pond" | "lantern" | "vegrow" | "scarecrow" | "shed";

export interface Prop { kind: PropKind; c: number; r: number; w: number; d: number }
export interface Exit { slot: number; c: number; r: number; dir: "up" | "down" | "right" | "left" }

export interface Layout {
  cols: number;
  rows: number;
  grid: Uint8Array;
  props: Prop[];
  entry: { c: number; r: number };
  exits: Exit[];
}

const T = (rows: string[]) => rows;

/** 部屋の広さ（テンプレートはこの大きさに引きのばす）。 */
export const ROOM_W = 28, ROOM_H = 16;

/**
 * テンプレートを広げる: 内側の行・列をところどころ2倍にして W×H にする。
 * 扉・入口の記号は複製しない（複製した側は壁か床にする）。
 */
export function stretch(tpl: string[], W: number, H: number): string[] {
  const dupIdx = (n: number, want: number) => {   // 1..n-2 のうち、均等に want 個
    const out = new Set<number>();
    for (let k = 0; k < want; k++) out.add(1 + Math.floor(((k + 0.5) * (n - 2)) / want));
    return out;
  };
  const strip = (ch: string, border: boolean) => (/[1-3E]/.test(ch) ? (border ? "#" : ".") : ch);
  const cols = dupIdx(tpl[0].length, Math.max(0, W - tpl[0].length));
  let rows = tpl.map((row, r) => {
    let out = "";
    for (let c = 0; c < row.length; c++) { out += row[c]; if (cols.has(c)) out += strip(row[c], r === 0 || r === tpl.length - 1); }
    return out;
  });
  const rowsDup = dupIdx(rows.length, Math.max(0, H - rows.length));
  rows = rows.flatMap((row, r) => (rowsDup.has(r) ? [row, row.split("").map((ch, c) => strip(ch, c === 0 || c === row.length - 1)).join("")] : [row]));
  return rows;
}

/** 通常の部屋の形（20×12 で描いて、ROOM_W×ROOM_H に広げる）。 */
const BASE_TEMPLATES: Record<string, string[]> = {
  rect: T([
    "####################",
    "#..................#",
    "#..oo.........oo...1",
    "#..oo.........oo...#",
    "#..................#",
    "#E.......oooo......#",
    "#........oooo......2",
    "#..................#",
    "#..oo.........oo...#",
    "#..oo.........oo...#",
    "#..................#",
    "#########3##########",
  ]),
  ell: T([
    "####################",
    "#.......############",
    "#.......############",
    "#..oo...############",
    "#E.oo...############",
    "#..................1",
    "#.......ooo........#",
    "#.......ooo........#",
    "#..................2",
    "#....oo.......oo...#",
    "#....oo.......oo...#",
    "###########3########",
  ]),
  cross: T([
    "#########1##########",
    "#######......#######",
    "#######......#######",
    "#######......#######",
    "#..................#",
    "#E......o..o.......2",
    "#.......o..o.......#",
    "#..................#",
    "#######......#######",
    "#######..oo..#######",
    "#######......#######",
    "#########3##########",
  ]),
  ring: T([
    "####################",
    "#..................#",
    "#..................#",
    "#...oooo...oooo....1",
    "#...oooo...oooo....#",
    "#E..oooo...oooo....#",
    "#...oooo...oooo....#",
    "#..................#",
    "#..................2",
    "#..................#",
    "#..................#",
    "##########3#########",
  ]),
  twin: T([
    "####################",
    "#.......####.......#",
    "#.......####...oo..1",
    "#..oo...####...oo..#",
    "#E.oo..........oo..#",
    "#..............oo..#",
    "#.......####.......2",
    "#.......####.......#",
    "#..oo...####..oo...#",
    "#..oo...####..oo...#",
    "#.......####.......#",
    "######3#############",
  ]),
  zigzag: T([
    "####################",
    "#E.....#...........#",
    "#......#...........#",
    "#..oo..#....ooo....#",
    "#..oo..#....ooo....1",
    "#......#...........#",
    "#..................#",
    "#.........#........#",
    "#....ooo..#........2",
    "#....ooo..#....oo..#",
    "#.........#....oo..#",
    "###3################",
  ]),
};

/** お庭向けの形（池や生け垣のあいだを抜ける）。 */
const GARDEN_TEMPLATES: Record<string, string[]> = {
  meadow: T([
    "####################",
    "#..................#",
    "#..oo.......o......1",
    "#..oo..............#",
    "#.........oo.......#",
    "#E........oo....o..#",
    "#..o...............2",
    "#.......o....oo....#",
    "#............oo....#",
    "#..oo..............#",
    "#..oo.....o........#",
    "#######3############",
  ]),
  hedge: T([
    "####################",
    "#.......#..........#",
    "#.......#....oo....1",
    "#..o....#....oo....#",
    "#E......#..........#",
    "#.......####...#####",
    "#..................2",
    "#####...####.......#",
    "#..........#...o...#",
    "#...oo.....#.......#",
    "#...oo.............#",
    "##########3#########",
  ]),
};

const BASE_BOSS = T([
  "####################",
  "#..................#",
  "#..oo..........oo..#",
  "#..oo..........oo..#",
  "#..................#",
  "#E.................1",
  "#..................#",
  "#..................#",
  "#..oo..........oo..#",
  "#..oo..........oo..#",
  "#..................#",
  "####################",
]);

export const TEMPLATES: Record<string, string[]> = Object.fromEntries(Object.entries(BASE_TEMPLATES).map(([k, t]) => [k, stretch(t, ROOM_W, ROOM_H)]));
export const OUTDOOR_TEMPLATES: Record<string, string[]> = Object.fromEntries(Object.entries(GARDEN_TEMPLATES).map(([k, t]) => [k, stretch(t, ROOM_W, ROOM_H)]));
/** ボス部屋（出口は倒した後に開く1つだけ）。 */
export const BOSS_TEMPLATE = stretch(BASE_BOSS, ROOM_W, ROOM_H);

/** ママのところ・特別な部屋（虫は出ない）。 */
export const SHOP_TEMPLATE = T([
  "########3#########",
  "#................#",
  "#..oo........oo..#",
  "#................#",
  "#E...............1",
  "#................#",
  "#..oo........oo..#",
  "#................#",
  "#########2########",
]);

/** さいごの部屋（ママがやってくる広いリビング）。 */
export const FINAL_TEMPLATE = stretch(T([
  "####################",
  "#..................#",
  "#..oo..........oo..#",
  "#..................#",
  "#E.................#",
  "#........oo........#",
  "#........oo........#",
  "#..................#",
  "#..oo..........oo..#",
  "#..................#",
  "#..................#",
  "####################",
]), ROOM_W, ROOM_H);

/** テーマごとの家具。まとまりの大きさ（マス数）で選ぶ。 */
const PROPS: Record<Theme, { small: PropKind[]; mid: PropKind[]; big: PropKind[] }> = {
  garden: { small: ["rock", "bush"], mid: ["flowerbed", "bush", "tree"], big: ["tree", "flowerbed"] },
  living: { small: ["plant", "table"], mid: ["sofa", "table", "tvstand"], big: ["sofa", "table"] },
  bedroom: { small: ["nightstand", "plant"], mid: ["dresser", "bed"], big: ["bed"] },
  study: { small: ["boxes", "plant"], mid: ["desk", "bookshelf"], big: ["bookshelf", "desk"] },
  washitsu: { small: ["chabudai", "tansu"], mid: ["kotatsu", "tansu"], big: ["kotatsu"] },
  western: { small: ["armchair", "plant"], mid: ["chest", "piano", "armchair"], big: ["piano"] },
  kitchen: { small: ["plant", "boxes"], mid: ["fridge", "counter", "dining"], big: ["counter", "dining"] },
  bath: { small: ["washer", "plant"], mid: ["washer", "tub"], big: ["tub"] },
  entrance: { small: ["umbrella", "plant"], mid: ["shoerack", "boxes"], big: ["shoerack"] },
  pond: { small: ["lantern", "rock"], mid: ["pond", "bush", "lantern"], big: ["pond"] },
  veggie: { small: ["scarecrow", "rock"], mid: ["vegrow", "shed"], big: ["vegrow", "shed"] },
};

/** テンプレートを（必要なら反転して）升目に変換する。 */
export function buildLayout(template: string[], theme: Theme, rng: Rng, opts: { flipX?: boolean; flipY?: boolean; doors: number[] }): Layout {
  let rows = template.map((r) => r.split(""));
  if (opts.flipX) rows = rows.map((r) => [...r].reverse());
  if (opts.flipY) rows = [...rows].reverse();
  const R = rows.length, C = rows[0].length;
  const grid = new Uint8Array(C * R);
  let entry = { c: 1, r: 1 };
  const exits: Exit[] = [];
  const prop = new Uint8Array(C * R);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = rows[r][c];
    let v = Cell.Floor;
    if (ch === "#") v = Cell.Wall;
    else if (ch === "o") { v = Cell.Prop; prop[r * C + c] = 1; }
    else if (ch === "E") entry = { c, r };
    else if (ch >= "1" && ch <= "3") {
      const slot = Number(ch);
      if (opts.doors.includes(slot)) {
        v = Cell.Door;
        const dir = r === 0 ? "up" : r === R - 1 ? "down" : c === 0 ? "left" : "right";
        exits.push({ slot, c, r, dir });
      } else v = Cell.Wall;
    }
    grid[r * C + c] = v;
  }
  exits.sort((a, b) => a.slot - b.slot);
  // 家具: 連続した o を長方形にまとめる
  const props: Prop[] = [];
  const pool = PROPS[theme];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!prop[r * C + c]) continue;
    let w = 0; while (c + w < C && prop[r * C + c + w]) w++;
    let d = 1;
    while (r + d < R && Array.from({ length: w }, (_, k) => prop[(r + d) * C + c + k]).every(Boolean)) d++;
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) prop[(r + y) * C + c + x] = 0;
    const area = w * d;
    const list = area <= 2 ? pool.small : area <= 6 ? pool.mid : pool.big;
    props.push({ kind: rng.pick(list), c, r, w, d });
  }
  return { cols: C, rows: R, grid, props, entry, exits };
}

/** 升目の中心のワールド座標。 */
export const cellCenter = (L: Layout, c: number, r: number) => ({ x: c - L.cols / 2 + 0.5, z: r - L.rows / 2 + 0.5 });
export const cellAt = (L: Layout, x: number, z: number) => ({ c: Math.floor(x + L.cols / 2), r: Math.floor(z + L.rows / 2) });
export const cellValue = (L: Layout, c: number, r: number) =>
  c < 0 || r < 0 || c >= L.cols || r >= L.rows ? Cell.Wall : (L.grid[r * L.cols + c] as Cell);

/** 入口から歩いて行けるマス（距離つき）。歩けないマスは -1。 */
export function reach(L: Layout, from: { c: number; r: number }, passable: (v: Cell) => boolean): Int16Array {
  const dist = new Int16Array(L.cols * L.rows).fill(-1);
  const q: number[] = [from.r * L.cols + from.c];
  dist[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const k = q[i], c = k % L.cols, r = (k / L.cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= L.cols || nr >= L.rows) continue;
      const nk = nr * L.cols + nc;
      if (dist[nk] >= 0 || !passable(cellValue(L, nc, nr))) continue;
      dist[nk] = dist[k] + 1; q.push(nk);
    }
  }
  return dist;
}
