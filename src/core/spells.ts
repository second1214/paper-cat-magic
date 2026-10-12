// 魔法の定義。DOM・three.js 非依存（ロジックとテストで共有する）。

export type SpellKind = "projectile" | "modifier" | "multicast" | "trigger";

/** 弾そのものの性能。修飾魔法で上書き・加算される。 */
export interface ProjectileStats {
  damage: number;
  speed: number; // マス/秒
  radius: number;
  life: number; // 秒
  pierce: number; // 貫通できる敵の数
  bounce: number; // 壁で跳ね返る回数
  homing: number; // 0..1 追尾の強さ
  explode: number; // 爆発半径（0 で爆発なし）
  slow: number; // 命中時の鈍足秒数
  spread: number; // ばらつき（ラジアン）
  color: string;
}

/** 次に撃つ弾へ足し込む修飾。 */
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
  mana: number;
  /** 一言説明（UI 表示用）。 */
  desc: string;
  /** アイコンの文字と色（UI 表示用）。 */
  glyph: string;
  color: string;
  projectile?: ProjectileStats;
  modifier?: Modifier;
  /** multicast: この魔法の後に何発ぶん同時に撃つか。 */
  count?: number;
}

const base = (o: Partial<ProjectileStats> & { color: string }): ProjectileStats => ({
  damage: 5, speed: 12, radius: 0.18, life: 1.2, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.04, ...o,
});

export const SPELLS: Record<string, SpellDef> = {
  spark: {
    id: "spark", name: "火花", kind: "projectile", mana: 4, glyph: "✦", color: "#ffd166",
    desc: "速くて軽い弾。連射向き",
    projectile: base({ damage: 4, speed: 16, radius: 0.14, life: 0.8, spread: 0.08, color: "#ffd166" }),
  },
  fireball: {
    id: "fireball", name: "火の玉", kind: "projectile", mana: 18, glyph: "●", color: "#ff6b3d",
    desc: "遅いが着弾で爆発する",
    projectile: base({ damage: 10, speed: 8, radius: 0.26, life: 1.6, explode: 1.6, color: "#ff6b3d" }),
  },
  ice: {
    id: "ice", name: "氷の矢", kind: "projectile", mana: 10, glyph: "◆", color: "#8fd3ff",
    desc: "当てた敵を遅くする",
    projectile: base({ damage: 7, speed: 13, radius: 0.16, life: 1.2, slow: 1.5, color: "#8fd3ff" }),
  },
  bolt: {
    id: "bolt", name: "雷撃", kind: "projectile", mana: 14, glyph: "ϟ", color: "#c9a6ff",
    desc: "敵を3体まで貫通する",
    projectile: base({ damage: 8, speed: 22, radius: 0.15, life: 0.6, pierce: 3, spread: 0.02, color: "#c9a6ff" }),
  },
  empower: {
    id: "empower", name: "強化", kind: "modifier", mana: 8, glyph: "▲", color: "#ff8fab",
    desc: "次の弾のダメージ1.5倍＋2", modifier: { damageMul: 1.5, damageAdd: 2 },
  },
  homing: {
    id: "homing", name: "追尾", kind: "modifier", mana: 10, glyph: "◎", color: "#7bd389",
    desc: "次の弾が敵を追いかける", modifier: { homing: 0.7, speedMul: 0.9 },
  },
  bounce: {
    id: "bounce", name: "反射", kind: "modifier", mana: 6, glyph: "↯", color: "#5ec2b7",
    desc: "次の弾が壁で3回跳ね返る", modifier: { bounce: 3 },
  },
  twin: {
    id: "twin", name: "二連", kind: "multicast", mana: 6, glyph: "⇉", color: "#f4a261", count: 2,
    desc: "続く2発を同時に撃つ",
  },
  trigger: {
    id: "trigger", name: "誘発", kind: "trigger", mana: 8, glyph: "✚", color: "#e76f51",
    desc: "次の弾が当たった所から、その次の弾を撃つ",
  },
};

export const SPELL_IDS = Object.keys(SPELLS);
