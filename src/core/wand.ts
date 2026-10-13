// おもちゃ（装備）と発射計画。スロットを左から読み、1回で出す技の一覧を決める（純粋関数）。
import { spellDef, type Modifier, type ProjectileStats, type SpellDef } from "./spells";

/** サブスロットがたまる条件。 */
export type SubCharge = "still" | "hit" | "dash" | "kill" | "hurt";
export const SUB_LABEL: Record<SubCharge, (n: number) => string> = {
  still: (n) => `${n}秒じっとする`,
  hit: (n) => `技を${n}回当てる`,
  dash: (n) => `${n}回ダッシュする`,
  kill: (n) => `虫を${n}匹たおす`,
  hurt: (n) => n > 1 ? `${n}回ダメージを受ける` : "ダメージを受ける",
};

export interface ToyDef {
  id: string;
  name: string;
  desc: string;
  slots: (string | null)[];
  manaMax: number; // やる気の最大
  manaRegen: number; // 毎秒
  castDelay: number; // 振る間隔（秒）
  recharge: number; // 最後のスロットまで使った後の休み（秒）
  /** このおもちゃで出す技すべてにかかる性質。 */
  baseMod?: Modifier;
  /** サブスロット: 条件がたまると、やる気を使わずに全部いっぺんに出る（Magicraft の副スロット）。 */
  sub?: { slots: (string | null)[]; charge: SubCharge; need: number };
  /** 全部のスロットを1回でいっぺんに出す。 */
  castAll?: boolean;
  /** 電池式: 持っているだけで、この秒数ごとに一番近い虫へ自動で振る。 */
  auto?: number;
}

/** 実際に飛ばす1発。payload は「つづけて」（命中地点から出す技）、timer があれば出てからその秒数で出す。 */
export interface Shot {
  stats: ProjectileStats;
  payload: Shot[];
  timer?: number;
}

export interface CastResult {
  shots: Shot[];
  manaUsed: number;
  nextCursor: number;
  /** 今回読んだスロットの範囲 [start, end)。 */
  start: number;
  end: number;
  /** 最後のスロットまで読み切った（休みに入る）。 */
  wrapped: boolean;
  /** やる気不足で途中で止まった。 */
  fizzled: boolean;
}

function applyMods(p: ProjectileStats, mods: Modifier[]): ProjectileStats {
  const s = { ...p };
  for (const m of mods) {
    if (m.damageMul) s.damage *= m.damageMul;
    if (m.damageAdd) s.damage += m.damageAdd;
    if (m.speedMul) s.speed *= m.speedMul;
    if (m.homing) s.homing = Math.min(1, s.homing + m.homing);
    if (m.bounce) s.bounce += m.bounce;
    if (m.pierce) s.pierce += m.pierce;
    if (m.explodeAdd) s.explode += m.explodeAdd;
    if (m.spread) s.spread += m.spread;
    if (m.hitsAdd && s.hits < 99) s.hits += m.hitsAdd;
    if (m.sizeMul) { s.radius *= m.sizeMul; s.reach *= Math.max(0.7, m.sizeMul); s.explode *= m.sizeMul; }
    if (m.speedMul) s.hitEvery /= m.speedMul;
    if (m.element) s.element = m.element;
    if (m.slowAdd) s.slow += m.slowAdd;
    if (m.lifeMul && s.motion !== "melee" && s.motion !== "ring" && !(s.motion === "beam" && s.speed === 0)) s.life *= m.lifeMul;
  }
  return s;
}

const isPassive = (d: SpellDef | undefined) => !!d && d.kind === "modifier" && d.dir === "all";

/** 全体修飾（どこに置いても全部の技にかかる）。 */
export function passiveMods(t: ToyDef): Modifier[] {
  return t.slots.map((id) => (id ? spellDef(id) : undefined)).filter(isPassive).map((d) => d!.modifier!);
}
/** 全体修飾で減るやる気の最大。 */
export const passiveCost = (t: ToyDef) => t.slots.reduce((a, id) => a + (id && isPassive(spellDef(id)) ? spellDef(id).mana : 0), 0);

/** ふたつ持ち: 2つのおもちゃを同時に扱い、左の技 a を右の技 b にまとめる。動き・見た目は b。 */
function fuse(a: ProjectileStats, b: ProjectileStats): ProjectileStats {
  return {
    ...b, damage: a.damage + b.damage, hits: Math.max(a.hits, b.hits), pierce: a.pierce + b.pierce, bounce: a.bounce + b.bounce,
    explode: Math.max(a.explode, b.explode), slow: a.slow + b.slow, homing: Math.max(a.homing, b.homing), knock: Math.max(a.knock, b.knock),
    radius: Math.max(b.radius, a.radius), element: b.element !== "none" ? b.element : a.element,
  };
}

/**
 * cursor の位置から1回ぶん出す。
 * - ▶修飾は右の技に溜まる。◀修飾は左の技にかかる。◀▶修飾は左右の技にかかり、右の技もいっしょに出す。全体修飾は読まない。
 * - 二刀流は、続く技を count 個ぶん追加で引く。
 * - [A][つづけて][B]: A が当たった所から B を出す（B は A の payload）。
 * - [A][ふたつ持ち][B]: A と B を同時に扱い、1発にまとめる。
 * - スロットの端に達したら打ち切って wrapped を立てる。
 */
export function planCast(toy: ToyDef, cursor: number, mana: number, slots: (string | null)[] = toy.slots): CastResult {
  const start = cursor;
  let i = cursor;
  let used = 0;
  let wrapped = false;
  let fizzled = false;
  const toyMods = [...(toy.baseMod ? [toy.baseMod] : []), ...passiveMods(toy)];

  const nextIndex = () => { let j = i; while (j < slots.length && (!slots[j] || isPassive(spellDef(slots[j]!)))) j++; return j; };
  const peek = () => { const j = nextIndex(); return j < slots.length ? spellDef(slots[j]!) : null; };
  const take = () => {
    i = nextIndex();
    if (i >= slots.length) { wrapped = true; return null; }
    const def = spellDef(slots[i]!);
    if (!def) { i++; return null; }
    if (used + def.mana > mana) { fizzled = true; return null; }
    used += def.mana;
    i++;
    return def;
  };

  /** 技の右にあるもの（◀・◀▶・つづけて・ふたつ持ち）を読んで、out[0]（今の技）に効かせる。 */
  const after = (out: Shot[]) => {
    for (;;) {
      const nx = peek();
      if (!nx || wrapped || fizzled) return;
      const left = nx.kind === "modifier" && (nx.dir === "left" || nx.dir === "both");
      if (!left && nx.kind !== "trigger" && nx.kind !== "duet") return;
      if (!take()) return;
      if (nx.kind === "modifier") {
        out[0].stats = applyMods(out[0].stats, [nx.modifier!]);
        if (nx.dir === "both") { const more = drawOne([nx.modifier!]); if (more) out.push(...more); return; }
        continue;
      }
      const right = drawOne([]);
      if (!right?.length) return;
      if (nx.kind === "trigger") { out[0].payload.push(...right); if (nx.timer) out[0].timer = nx.timer; return; }
      // ふたつ持ち: 左の技は右の技といっしょに1発に
      right[0].stats = fuse(out[0].stats, right[0].stats);
      right[0].payload.unshift(...out[0].payload);
      out.splice(0, 1, ...right);
      return;
    }
  };

  function drawOne(mods: Modifier[]): Shot[] | null {
    let pendingMulti = 0;
    for (;;) {
      if (wrapped || fizzled) return null;
      const def = take();
      if (!def) return null;
      if (def.kind === "modifier" && def.modifier) { if (def.dir !== "left") mods = [...mods, def.modifier]; continue; }   // 左に技がない◀は空振り
      if (def.kind === "multicast") { pendingMulti += def.count ?? 2; continue; }
      if (def.kind === "trigger" || def.kind === "duet") continue;   // 左に技がないので空振り
      if (def.kind === "attack" && def.projectile) {
        const out: Shot[] = [{ stats: applyMods(def.projectile, [...toyMods, ...mods]), payload: [] }];
        after(out);
        for (let k = 1; k < pendingMulti; k++) {
          const more = drawOne([]);
          if (!more) break;
          out.push(...more);
        }
        return out;
      }
    }
  }

  const shots = drawOne([]) ?? [];
  if (nextIndex() >= slots.length) wrapped = true;
  return { shots, manaUsed: used, nextCursor: wrapped ? 0 : i, start, end: i, wrapped, fizzled };
}

/** 全部のスロットを左から最後まで、いっぺんに出す（サブスロット・鈴入りボール）。 */
export function castAll(toy: ToyDef, mana: number, slots: (string | null)[] = toy.slots): { shots: Shot[]; manaUsed: number } {
  const shots: Shot[] = [];
  let cursor = 0, used = 0;
  for (let guard = 0; guard < slots.length + 1; guard++) {
    const r = planCast(toy, cursor, mana - used, slots);
    shots.push(...r.shots); used += r.manaUsed;
    if (r.wrapped || r.fizzled || r.end <= r.start) break;
    cursor = r.nextCursor;
  }
  return { shots, manaUsed: used };
}

/**
 * 1周ぶん左から読んだときの「ひとまとまり」（1回で一緒に出るスロット）を返す。
 * UI で「この修飾はどの技にかかるか」を括って見せるのに使う。
 */
export function castGroups(toy: ToyDef): [number, number][] {
  const groups: [number, number][] = [];
  let cursor = 0;
  for (let guard = 0; guard < toy.slots.length + 1; guard++) {
    const r = planCast(toy, cursor, Infinity);
    if (r.end > r.start) groups.push([r.start, r.end]);
    if (r.wrapped) break;
    cursor = r.nextCursor;
  }
  return groups;
}

const empty = (n: number) => Array.from({ length: n }, (): string | null => null);

/** おもちゃ。どれも本当に売っていそうな、ふつうの猫のおもちゃ。 */
export const TOYS: Record<string, ToyDef> = {
  jarashi: {
    id: "jarashi", name: "ねこじゃらし", desc: "ふつうの使いやすさ。6スロット",
    slots: empty(6), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
  },
  tombo: {
    id: "tombo", name: "トンボじゃらし", desc: "トンボが少し虫を追いかける。4スロットで休みが短い",
    slots: empty(4), manaMax: 70, manaRegen: 34, castDelay: 0.16, recharge: 0.35,
    baseMod: { homing: 0.35 },
  },
  tissue: {
    id: "tissue", name: "ティッシュボール", desc: "丸めたティッシュが壁で1回はね返る。8スロット、休みが長い",
    slots: empty(8), manaMax: 110, manaRegen: 28, castDelay: 0.22, recharge: 0.9,
    baseMod: { bounce: 1 },
  },
  keri: {
    id: "keri", name: "けりぐるみ", desc: "抱えてけりけりする細長いぬいぐるみ。技の攻撃力×1.35。3スロットで振るのが遅い",
    slots: empty(3), manaMax: 90, manaRegen: 30, castDelay: 0.32, recharge: 0.6,
    baseMod: { damageMul: 1.35 },
  },
  pingpong: {
    id: "pingpong", name: "ピンポン玉", desc: "軽くてよく弾む。技が速くなり、壁で2回はね返る。5スロット",
    slots: empty(5), manaMax: 70, manaRegen: 32, castDelay: 0.18, recharge: 0.5,
    baseMod: { bounce: 2, speedMul: 1.25 },
  },
  himo: {
    id: "himo", name: "ただのひも", desc: "高いおもちゃより夢中になる。10スロットあるが休みが長い",
    slots: empty(10), manaMax: 100, manaRegen: 26, castDelay: 0.13, recharge: 1.3,
  },
  cap: {
    id: "cap", name: "ペットボトルのキャップ", desc: "床をカシャカシャ滑る。3スロットだけど、やる気の回復がとても速く休みも短い",
    slots: empty(3), manaMax: 60, manaRegen: 46, castDelay: 0.1, recharge: 0.25,
  },
  longrod: {
    id: "longrod", name: "ロングじゃらし", desc: "釣りざおみたいに長い。技が1.4倍遠くまで届き、少し大きい。6スロット",
    slots: empty(6), manaMax: 85, manaRegen: 30, castDelay: 0.22, recharge: 0.7,
    baseMod: { lifeMul: 1.4, sizeMul: 1.1 },
  },
  suzuball: {
    id: "suzuball", name: "鈴入りボール", desc: "転がすと鳴りっぱなし。全部のスロットを1回でいっぺんに出す（休みが長い）",
    slots: empty(4), manaMax: 120, manaRegen: 32, castDelay: 0.2, recharge: 1.4, castAll: true,
  },
  kamibukuro: {
    id: "kamibukuro", name: "紙袋", desc: "中でじっとしてから飛び出す。止まっているとサブスロットがたまり、いっぺんに出る",
    slots: empty(4), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
    sub: { slots: empty(2), charge: "still", need: 1.5 },
  },
  tunnel: {
    id: "tunnel", name: "猫トンネル", desc: "シャカシャカ鳴るトンネル。ダッシュでくぐるとサブスロットがたまる",
    slots: empty(5), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.6,
    sub: { slots: empty(2), charge: "dash", need: 2 },
  },
  nezumiPlush: {
    id: "nezumiPlush", name: "ねずみのぬいぐるみ", desc: "かじられてボロボロ。技を当てるとサブスロットがたまる。かみつき入り",
    slots: ["bite", null, null, null], manaMax: 80, manaRegen: 30, castDelay: 0.22, recharge: 0.6,
    sub: { slots: empty(3), charge: "hit", need: 14 },
  },
  matatabiStick: {
    id: "matatabiStick", name: "またたびの木", desc: "かじるとごきげん。虫をたおすとサブスロットがたまる",
    slots: empty(5), manaMax: 85, manaRegen: 30, castDelay: 0.2, recharge: 0.6,
    sub: { slots: empty(2), charge: "kill", need: 4 },
  },
  chiiku: {
    id: "chiiku", name: "知育ボール", desc: "転がすとおやつが出る。ダメージを受けるとサブスロットがすぐ出て反撃",
    slots: empty(4), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
    sub: { slots: empty(3), charge: "hurt", need: 1 },
  },
  // ---- 電池式（持っているだけで自動で動く。持ち替えの3つとは別に2つまで） ----
  denmouse: {
    id: "denmouse", name: "電動ねずみ", desc: "電池で走り回るねずみ。1.4秒ごとに自動で一番近い虫へ。ひっかき入り",
    slots: ["claw", null], manaMax: 50, manaRegen: 20, castDelay: 0.2, recharge: 0.4, auto: 1.4,
  },
  autolaser: {
    id: "autolaser", name: "自動レーザー", desc: "置いておくと赤い点がくるくる動く。2.4秒ごとに自動。レーザーポインター入り",
    slots: ["laser", null], manaMax: 60, manaRegen: 22, castDelay: 0.2, recharge: 0.4, auto: 2.4,
  },
  pichifish: {
    id: "pichifish", name: "ぴちぴち魚", desc: "USBで充電する、ぴちぴち動く魚のぬいぐるみ。1.8秒ごとに自動。猫パンチ入り",
    slots: ["punch", null, null], manaMax: 55, manaRegen: 24, castDelay: 0.2, recharge: 0.4, auto: 1.8,
  },
  kurukuru: {
    id: "kurukuru", name: "電動くるくるじゃらし", desc: "台の上で羽根がくるくる回る。3秒ごとに自動。ぶんぶん入り",
    slots: ["swing", null, null], manaMax: 70, manaRegen: 22, castDelay: 0.2, recharge: 0.4, auto: 3,
  },
};

/** 電池式は2つまで（持ち替えのおもちゃとは別）。 */
export const MAX_BATT = 2;

export function starterToy(): ToyDef {
  const t = structuredClone(TOYS.jarashi);
  t.slots = ["claw", "claw", "matatabi", "bite", null, null];
  return t;
}

/** まとまり（1回で一緒に出る範囲）ごとの合計攻撃力と、使うやる気。 */
export function groupSummary(toy: ToyDef): { start: number; end: number; damage: number; mana: number }[] {
  // 多段は「1匹に当たりきったとき」の合計（置く技は5回ぶんで数える）
  const sum = (shots: Shot[]): number => shots.reduce((a, s) => a + s.stats.damage * Math.min(5, s.stats.hits) + sum(s.payload), 0);
  if (toy.castAll) {
    const r = castAll(toy, Infinity);
    return r.shots.length ? [{ start: 0, end: toy.slots.length, damage: Math.round(sum(r.shots)), mana: r.manaUsed }] : [];
  }
  return castGroups(toy).map(([start, end]) => {
    const r = planCast(toy, start, Infinity);
    return { start, end, damage: Math.round(sum(r.shots)), mana: r.manaUsed };
  });
}

/** おもちゃの説明欄の数値。 */
export function toyStats(t: ToyDef): [string, string][] {
  const out: [string, string][] = [
    ["スロット", `${t.slots.length}`],
    ["やる気 最大", `${t.manaMax}`],
    ["やる気 回復", `${t.manaRegen}/秒`],
    ["振る間隔", `${t.castDelay}秒`],
    ["休けい", `${t.recharge}秒`],
  ];
  if (t.baseMod?.homing) out.push(["性質", "技が少し追尾"]);
  if (t.baseMod?.bounce) out.push(["性質", `技が${t.baseMod.bounce}回はね返る`]);
  if (t.baseMod?.damageMul) out.push(["性質", `攻撃力×${t.baseMod.damageMul}`]);
  if (t.baseMod?.lifeMul) out.push(["性質", `とどく距離×${t.baseMod.lifeMul}`]);
  if (t.castAll) out.push(["性質", "全部いっぺんに出す"]);
  if (t.sub) out.push(["サブスロット", `${t.sub.slots.length}つ（${SUB_LABEL[t.sub.charge](t.sub.need)}と発動）`]);
  if (t.auto) out.push(["電池式", `${t.auto}秒ごとに自動`]);
  return out;
}
