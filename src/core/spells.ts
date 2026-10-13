// 技（おもちゃにはめるアイテム）の定義。DOM・three.js 非依存。
//
// 猫がおもちゃを振ると、スロットの技（爪・牙・毛糸玉など）が出る。技ごとに「動き」（飛ぶ・回る・ビーム…）が違い、
// 修飾で強さ・大きさ・属性（おうちのもの属性）を足していく。

export type SpellKind = "attack" | "modifier" | "multicast" | "trigger";

/** 技が当たったときに出す絵（描画側で使う）。 */
export type TechFx = "claw" | "bite" | "hairball" | "hiss" | "swing" | "yarn" | "laser" | "pounce" | "punch" | "post" | "friend" | "roomba" | "enemy";

/** 技の動き。shot=飛ぶ / orbit=猫のまわりを回る / beam=猫から線で届く / ring=足元から広がる輪 / melee=目の前で連打 / trap=床に置く。 */
export type Motion = "shot" | "orbit" | "beam" | "ring" | "melee" | "trap" | "summon";
export const MOTION_LABEL: Record<Motion, string> = { shot: "飛ぶ", orbit: "まわりを回る", beam: "ビーム", ring: "衝撃波", melee: "近くを連打", trap: "床に置く", summon: "召喚" };

/**
 * おうちのもの属性（炎・雷の代わり）。組み合わせると強くなる:
 * びしょぬれの虫にビリビリ＝2倍・たくさん連鎖 / ねばねばの虫に虫よけ＝じわじわ2倍。
 */
export type Element = "none" | "static" | "wet" | "sticky" | "repel";
export const ELEMENT_INFO: Record<Exclude<Element, "none">, { name: string; color: string; desc: string }> = {
  static: { name: "ビリビリ", color: "#f5c400", desc: "毛の静電気。当たると近くの虫2匹へ飛び移る（びしょぬれの虫には2倍＆4匹）" },
  wet: { name: "びしょぬれ", color: "#3fa7ff", desc: "4秒ぬれて遅くなる。ビリビリがよく効く" },
  sticky: { name: "ねばねば", color: "#c9a227", desc: "ガムテープで1.6秒足止め（ボスは少しだけ）。虫よけがよく効く" },
  repel: { name: "虫よけ", color: "#5fbf5a", desc: "3秒間じわじわダメージ（ねばねばの虫には2倍）" },
};

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
  motion: Motion;
  /** 同じ虫に当たる最大回数（多段）。 */
  hits: number;
  /** 多段の間隔（秒）。 */
  hitEvery: number;
  /** 回る半径・ビームの長さ・輪の広がり・連打の届く距離。 */
  reach: number;
  element: Element;
  /** 当たった虫を押し出す強さ。 */
  knock: number;
}

/**
 * 召喚（Magicraft と同じ仕様）: 仲間を呼び出し、出ている間ずっと戦わせる。数の上限はない。
 * 左に置いた修飾・属性は、仲間の攻撃にそのままかかる（攻撃力・多段・属性・大きさ・速さ）。
 */
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
  hitsAdd?: number;
  /** 大きさ（当たり判定・回る半径・輪・爆発）の倍率。 */
  sizeMul?: number;
  element?: Element;
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
  damage: 5, speed: 12, radius: 0.2, life: 1.4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.04,
  motion: "shot", hits: 1, hitEvery: 0.12, reach: 0, element: "none", knock: 0, ...o,
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
  swing: {
    id: "swing", name: "ぶんぶん", kind: "attack", mana: 14, glyph: "回", color: "#e64980",
    desc: "ねこじゃらしを振り回す。先っぽが猫のまわりを回り、近づく虫を何度もたたく",
    projectile: base({ damage: 6, speed: 7, radius: 0.38, life: 1.4, motion: "orbit", reach: 1.7, hits: 3, hitEvery: 0.35, knock: 3, color: "#ff9ec4", tech: "swing" }),
  },
  yarn: {
    id: "yarn", name: "毛糸玉ころがし", kind: "attack", mana: 16, glyph: "糸", color: "#d6336c",
    desc: "毛糸玉がころがり、のびた糸がビームになって並んだ虫をまとめて何度もこする",
    projectile: base({ damage: 4, speed: 10, radius: 0.3, life: 1.1, motion: "beam", hits: 3, hitEvery: 0.3, spread: 0.02, color: "#f783ac", tech: "yarn" }),
  },
  laser: {
    id: "laser", name: "レーザーポインター", kind: "attack", mana: 10, glyph: "光", color: "#f03e3e",
    desc: "赤い点が一瞬で壁まで走る。線の上の虫ぜんぶに当たる",
    projectile: base({ damage: 7, speed: 0, radius: 0.15, life: 0.22, motion: "beam", reach: 14, spread: 0.01, color: "#ff3b3b", tech: "laser" }),
  },
  pounce: {
    id: "pounce", name: "ねこジャンプ", kind: "attack", mana: 14, glyph: "跳", color: "#f08c00",
    desc: "跳んで着地し、足元から輪の衝撃波。囲まれたときに虫をはじき飛ばす",
    projectile: base({ damage: 10, speed: 0, radius: 0.3, life: 0.4, motion: "ring", reach: 2.6, knock: 7, color: "#ffc078", tech: "pounce" }),
  },
  punch: {
    id: "punch", name: "猫パンチ連打", kind: "attack", mana: 8, glyph: "拳", color: "#e8590c",
    desc: "目の前をぺしぺし連打。近いけれど1匹に何度も当たる",
    projectile: base({ damage: 3, speed: 0, radius: 0.5, life: 0.45, motion: "melee", reach: 1.5, hits: 4, hitEvery: 0.1, knock: 1, color: "#ffa8a8", tech: "punch" }),
  },
  post: {
    id: "post", name: "爪とぎ", kind: "attack", mana: 18, glyph: "置", color: "#a0522d",
    desc: "段ボールの爪とぎを前に置く。上を通る虫を7秒間ガリガリ削る（4つまで）",
    projectile: base({ damage: 4, speed: 0, radius: 0.7, life: 7, motion: "trap", reach: 1.3, hits: 99, hitEvery: 0.6, color: "#d9a066", tech: "post" }),
  },
  friend: {
    id: "friend", name: "友達猫", kind: "attack", mana: 30, glyph: "猫", color: "#868e96",
    desc: "友達の猫を呼ぶ。近くの虫を追いかけてひっかく。修飾・属性は友達猫の攻撃にかかる",
    projectile: base({ damage: 5, speed: 5, radius: 0.34, life: 10, motion: "summon", reach: 0.85, hitEvery: 0.5, spread: 0, color: "#ced4da", tech: "friend" }),
  },
  roomba: {
    id: "roomba", name: "ルンバ", kind: "attack", mana: 26, glyph: "掃", color: "#495057",
    desc: "お掃除ロボを呼ぶ。部屋を走り回って壁ではね返り、ぶつかった虫を吸いこむ",
    projectile: base({ damage: 4, speed: 3.4, radius: 0.55, life: 12, motion: "summon", hits: 99, hitEvery: 0.45, knock: 2, spread: 0.6, color: "#adb5bd", tech: "roomba" }),
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
  kajikaji: {
    id: "kajikaji", name: "かじかじ", kind: "modifier", mana: 8, glyph: "多", color: "#ae3ec9",
    desc: "多段。右の技が同じ虫に＋2回当たる（1回の攻撃力は×0.7）", modifier: { hitsAdd: 2, damageMul: 0.7 },
  },
  big: {
    id: "big", name: "でっかく", kind: "modifier", mana: 10, glyph: "大", color: "#f59f00",
    desc: "右の技が大きくなる（当たり・回る半径・輪が×1.6）。少し遅くなる", modifier: { sizeMul: 1.6, damageMul: 1.2, speedMul: 0.8 },
  },
  small: {
    id: "small", name: "ちっちゃく", kind: "modifier", mana: 6, glyph: "小", color: "#74b816",
    desc: "右の技が豆つぶになる。当てにくいけれど攻撃力×1.8", modifier: { sizeMul: 0.45, damageMul: 1.8 },
  },
  quick: {
    id: "quick", name: "すばやく", kind: "modifier", mana: 6, glyph: "速", color: "#15aabf",
    desc: "右の技が1.8倍速くなる（回る・連打も速く）", modifier: { speedMul: 1.8 },
  },
  static: {
    id: "static", name: "静電気", kind: "modifier", mana: 8, glyph: "電", color: "#f5c400",
    desc: "右の技にビリビリ属性をつける", modifier: { element: "static" },
  },
  water: {
    id: "water", name: "水のみ皿", kind: "modifier", mana: 6, glyph: "水", color: "#3fa7ff",
    desc: "右の技にびしょぬれ属性をつける", modifier: { element: "wet" },
  },
  tape: {
    id: "tape", name: "ガムテープ", kind: "modifier", mana: 8, glyph: "粘", color: "#c9a227",
    desc: "右の技にねばねば属性をつける", modifier: { element: "sticky" },
  },
  spray: {
    id: "spray", name: "虫よけスプレー", kind: "modifier", mana: 8, glyph: "毒", color: "#5fbf5a",
    desc: "右の技に虫よけ属性をつける", modifier: { element: "repel" },
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
    out.push(["攻撃力", p.hits > 1 && p.hits < 99 ? `${p.damage} ×${p.hits}回` : p.hits >= 99 || p.motion === "summon" ? `${p.damage}（${p.hitEvery}秒ごと）` : `${p.damage}`]);
    out.push(["やる気", `${def.mana}`]);
    out.push(["動き", MOTION_LABEL[p.motion]]);
    if (p.motion === "shot" || (p.motion === "beam" && p.speed > 0)) out.push(["とどく距離", `${Math.round(p.speed * p.life)}マス`]);
    if (p.motion === "beam" && p.speed === 0) out.push(["とどく距離", "壁まで"]);
    if (p.motion === "orbit") out.push(["回る半径", `${p.reach}マス・${p.life}秒`]);
    if (p.motion === "ring") out.push(["輪の広さ", `半径${p.reach}`]);
    if (p.motion === "melee") out.push(["とどく距離", `${p.reach}マス`]);
    if (p.motion === "trap") out.push(["置いておく", `${p.life}秒`]);
    if (p.motion === "summon") { out.push(["出ている時間", `${p.life}秒`]); out.push(["攻撃の間隔", `${p.hitEvery}秒`]); out.push(["呼べる数", "上限なし"]); }
    if (p.explode) out.push(["範囲", `半径${p.explode}`]);
    if (p.slow) out.push(["すくみ", `${p.slow}秒`]);
    if (p.pierce) out.push(["貫通", `${p.pierce}匹`]);
    if (p.knock >= 3) out.push(["はじき飛ばし", "あり"]);
    return out;
  }
  out.push(["やる気", `${def.mana}`]);
  const m = def.modifier;
  if (m?.damageMul || m?.damageAdd) out.push(["攻撃力", `×${m.damageMul ?? 1}${m.damageAdd ? ` ＋${m.damageAdd}` : ""}`]);
  if (m?.hitsAdd) out.push(["当たる回数", `＋${m.hitsAdd}回`]);
  if (m?.sizeMul) out.push(["大きさ", `×${m.sizeMul}`]);
  if (m?.element && m.element !== "none") out.push(["属性", ELEMENT_INFO[m.element].name]);
  if (m?.homing) out.push(["追尾", "あり"]);
  if (m?.bounce) out.push(["はね返り", `＋${m.bounce}回`]);
  if (m?.pierce) out.push(["貫通", `＋${m.pierce}匹`]);
  if (m?.speedMul && m.speedMul !== 1) out.push(["速さ", `×${m.speedMul}`]);
  if (def.kind === "multicast") out.push(["同時に出す", `右の${def.count}つ`]);
  if (def.kind === "trigger") out.push(["命中で", "さらに右の技"]);
  return out;
}
