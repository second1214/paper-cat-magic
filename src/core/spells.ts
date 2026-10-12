// 技（おもちゃにはめるアイテム）の定義。DOM・three.js 非依存。
//
// 遠距離の仕組み: 猫がおもちゃを振ると、おもちゃの先（羽・トンボ・ティッシュ玉）が虫へ飛んでいき、
// 当たった所で猫の技（爪・噛みつきなど）が発動する。

export type SpellKind = "attack" | "modifier" | "multicast" | "trigger";

/** 技が当たったときに出す絵（描画側で使う）。 */
export type TechFx = "claw" | "bite" | "hairball" | "hiss" | "enemy";

/** 飛んでいく弾の性能。修飾で上書き・加算される。 */
export interface ProjectileStats {
  damage: number;
  speed: number; // マス/秒
  radius: number;
  life: number; // 秒
  pierce: number; // 貫通できる虫の数
  bounce: number; // 壁で跳ね返る回数
  homing: number; // 0..1 追尾の強さ
  explode: number; // 範囲半径（0 で範囲なし）
  slow: number; // 命中時の鈍足秒数
  spread: number; // ばらつき（ラジアン）
  color: string;
  tech: TechFx;
}

/** 次（右隣）の技へ足し込む修飾。 */
export interface Modifier {
  damageMul?: number;
  damageAdd?: number;
  speedMul?: number;
  homing?: number;
  bounce?: number;
  pierce?: number;
  explodeAdd?: number;
  spread?: number;
}

export interface SpellDef {
  id: string;
  name: string;
  kind: SpellKind;
  mana: number; // やる気の消費
  desc: string;
  glyph: string;
  color: string;
  projectile?: ProjectileStats;
  modifier?: Modifier;
  count?: number; // multicast: 右に続く技を何個同時に出すか
}

const base = (o: Partial<ProjectileStats> & { color: string; tech: TechFx }): ProjectileStats => ({
  damage: 5, speed: 12, radius: 0.2, life: 1.4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.04, ...o,
});

/** 種類ごとの表示名（UI の凡例に使う）。 */
export const KIND_LABEL: Record<SpellKind, string> = {
  attack: "技",
  modifier: "修飾",
  multicast: "修飾",
  trigger: "修飾",
};

export const SPELLS: Record<string, SpellDef> = {
  claw: {
    id: "claw", name: "ひっかき", kind: "attack", mana: 4, glyph: "爪", color: "#e85d4a",
    desc: "爪でひっかく。速くて軽い。連発向き",
    projectile: base({ damage: 5, speed: 15, life: 1.0, spread: 0.08, color: "#ff8a70", tech: "claw" }),
  },
  bite: {
    id: "bite", name: "かみつき", kind: "attack", mana: 12, glyph: "牙", color: "#c0392b",
    desc: "ガブッと強い一撃。少し遅い",
    projectile: base({ damage: 14, speed: 10, radius: 0.24, life: 1.5, color: "#ff6b6b", tech: "bite" }),
  },
  hairball: {
    id: "hairball", name: "毛玉", kind: "attack", mana: 18, glyph: "毛", color: "#b07a3c",
    desc: "当たった所で毛玉がはじけ、まわりの虫にも当たる",
    projectile: base({ damage: 9, speed: 8, radius: 0.26, life: 1.8, explode: 1.7, color: "#e0a060", tech: "hairball" }),
  },
  hiss: {
    id: "hiss", name: "シャー", kind: "attack", mana: 8, glyph: "シ", color: "#7c5cbf",
    desc: "威嚇。当たった虫がすくんで遅くなる",
    projectile: base({ damage: 4, speed: 12, life: 1.3, slow: 2.0, color: "#c9a6ff", tech: "hiss" }),
  },
  matatabi: {
    id: "matatabi", name: "またたび", kind: "modifier", mana: 8, glyph: "強", color: "#2f9e44",
    desc: "右の技のダメージ1.5倍＋3", modifier: { damageMul: 1.5, damageAdd: 3 },
  },
  stare: {
    id: "stare", name: "じーっ", kind: "modifier", mana: 8, glyph: "追", color: "#1c7ed6",
    desc: "右の技が虫を追いかける", modifier: { homing: 0.75, speedMul: 0.9 },
  },
  bouncy: {
    id: "bouncy", name: "ぽよん", kind: "modifier", mana: 6, glyph: "跳", color: "#0ca678",
    desc: "右の技が壁で3回はね返る", modifier: { bounce: 3 },
  },
  pushy: {
    id: "pushy", name: "ぐいぐい", kind: "modifier", mana: 8, glyph: "貫", color: "#5c7cfa",
    desc: "右の技が虫を2匹ぶん突き抜ける", modifier: { pierce: 2 },
  },
  double: {
    id: "double", name: "二刀流", kind: "multicast", mana: 6, glyph: "×2", color: "#e67700", count: 2,
    desc: "右に続く2つの技を同時に出す",
  },
  chain: {
    id: "chain", name: "つづけて", kind: "trigger", mana: 8, glyph: "連", color: "#d6336c",
    desc: "右の技が当たった所から、さらに右の技を出す",
  },
};

export const SPELL_IDS = Object.keys(SPELLS);

/** 説明欄に出す数値（ラベル・値）。Magicraft の魔法説明のように、選ぶ判断に使う数字をそろえて見せる。 */
export function spellStats(def: SpellDef): [string, string][] {
  const out: [string, string][] = [];
  if (def.kind === "attack" && def.projectile) {
    const p = def.projectile;
    out.push(["攻撃力", `${p.damage}`]);
    out.push(["やる気", `${def.mana}`]);
    out.push(["弾の速さ", `${p.speed}`]);
    out.push(["とどく距離", `${Math.round(p.speed * p.life)}マス`]);
    if (p.explode) out.push(["範囲", `半径${p.explode}`]);
    if (p.slow) out.push(["すくみ", `${p.slow}秒`]);
    if (p.pierce) out.push(["貫通", `${p.pierce}匹`]);
    return out;
  }
  out.push(["やる気", `${def.mana}`]);
  const m = def.modifier;
  if (m?.damageMul || m?.damageAdd) out.push(["攻撃力", `×${m.damageMul ?? 1}${m.damageAdd ? ` ＋${m.damageAdd}` : ""}`]);
  if (m?.homing) out.push(["追尾", "あり"]);
  if (m?.bounce) out.push(["はね返り", `＋${m.bounce}回`]);
  if (m?.pierce) out.push(["貫通", `＋${m.pierce}匹`]);
  if (m?.speedMul && m.speedMul !== 1) out.push(["弾の速さ", `×${m.speedMul}`]);
  if (def.kind === "multicast") out.push(["同時に出す", `右の${def.count}つ`]);
  if (def.kind === "trigger") out.push(["命中で", "さらに右の技"]);
  return out;
}
