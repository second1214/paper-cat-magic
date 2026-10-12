// おもちゃ（装備）と発射計画。スロットを左から読み、1回で出す技の一覧を決める（純粋関数）。
import { SPELLS, type Modifier, type ProjectileStats } from "./spells";

/** おもちゃの先（飛んでいくもの）の見た目。 */
export type Lure = "feather" | "dragonfly" | "tissue";

export interface ToyDef {
  id: string;
  name: string;
  lure: Lure;
  desc: string;
  slots: (string | null)[];
  manaMax: number; // やる気の最大
  manaRegen: number; // 毎秒
  castDelay: number; // 振る間隔（秒）
  recharge: number; // 最後のスロットまで使った後の休み（秒）
  /** このおもちゃで出す技すべてにかかる性質。 */
  baseMod?: Modifier;
}

/** 実際に飛ばす1発。payload は「つづけて」（命中地点から出す技）。 */
export interface Shot {
  stats: ProjectileStats;
  payload: Shot[];
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
  }
  return s;
}

/**
 * cursor の位置から1回ぶん出す。
 * - 修飾は右隣（次）の技に溜まる。技まで届かなかった修飾は捨てる。
 * - 二刀流は、続く技を count 個ぶん追加で引く。
 * - つづけては、次の技が当たったときに出す技をさらに1つ引いて payload に入れる。
 * - スロットの端に達したら打ち切って wrapped を立てる。
 */
export function planCast(toy: ToyDef, cursor: number, mana: number): CastResult {
  const slots = toy.slots;
  const start = cursor;
  let i = cursor;
  let used = 0;
  let wrapped = false;
  let fizzled = false;
  const toyMods = toy.baseMod ? [toy.baseMod] : [];

  const take = () => {
    while (i < slots.length && !slots[i]) i++;
    if (i >= slots.length) { wrapped = true; return null; }
    const def = SPELLS[slots[i]!];
    if (!def) { i++; return null; }
    if (used + def.mana > mana) { fizzled = true; return null; }
    used += def.mana;
    i++;
    return def;
  };

  const drawOne = (mods: Modifier[]): Shot[] | null => {
    let pendingMulti = 0;
    let triggered = false;
    for (;;) {
      if (wrapped || fizzled) return null;
      const def = take();
      if (!def) return null;
      if (def.kind === "modifier" && def.modifier) { mods = [...mods, def.modifier]; continue; }
      if (def.kind === "multicast") { pendingMulti += def.count ?? 2; continue; }
      if (def.kind === "trigger") { triggered = true; continue; }
      if (def.kind === "attack" && def.projectile) {
        const shot: Shot = { stats: applyMods(def.projectile, [...toyMods, ...mods]), payload: [] };
        if (triggered) shot.payload = drawOne([]) ?? [];
        const out = [shot];
        for (let k = 1; k < pendingMulti; k++) {
          const more = drawOne([]);
          if (!more) break;
          out.push(...more);
        }
        return out;
      }
    }
  };

  const shots = drawOne([]) ?? [];
  let j = i;
  while (j < slots.length && !slots[j]) j++;
  if (j >= slots.length) wrapped = true;
  return { shots, manaUsed: used, nextCursor: wrapped ? 0 : i, start, end: i, wrapped, fizzled };
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

export const TOYS: Record<string, ToyDef> = {
  jarashi: {
    id: "jarashi", name: "ねこじゃらし", lure: "feather", desc: "ふつうの使いやすさ。6スロット",
    slots: [null, null, null, null, null, null], manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
  },
  tombo: {
    id: "tombo", name: "トンボじゃらし", lure: "dragonfly", desc: "トンボが少し虫を追いかける。4スロットで休みが短い",
    slots: [null, null, null, null], manaMax: 70, manaRegen: 34, castDelay: 0.16, recharge: 0.35,
    baseMod: { homing: 0.35 },
  },
  tissue: {
    id: "tissue", name: "ティッシュボール", lure: "tissue", desc: "丸めたティッシュが壁で1回はね返る。8スロット、休みが長い",
    slots: [null, null, null, null, null, null, null, null], manaMax: 110, manaRegen: 28, castDelay: 0.22, recharge: 0.9,
    baseMod: { bounce: 1 },
  },
};

export function starterToy(): ToyDef {
  const t = structuredClone(TOYS.jarashi);
  t.slots = ["claw", "claw", "matatabi", "bite", null, null];
  return t;
}

/** まとまり（1回で一緒に出る範囲）ごとの合計攻撃力と、使うやる気。 */
export function groupSummary(toy: ToyDef): { start: number; end: number; damage: number; mana: number }[] {
  // 多段は「1匹に当たりきったとき」の合計（置く技は5回ぶんで数える）
  const sum = (shots: Shot[]): number => shots.reduce((a, s) => a + s.stats.damage * Math.min(5, s.stats.hits) + sum(s.payload), 0);
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
  return out;
}
