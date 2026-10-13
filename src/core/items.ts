// レリック（持っているだけで効く）と装備（帽子・服・首輪。同じセットをそろえるとボーナス）。DOM 非依存。
//
// どちらも「ボーナス」を足し合わせるだけにして、ゲーム側は合計（Bonus）だけを見る。

/** すべての効果の合計。倍率は 1、加算は 0 が「効果なし」。 */
export interface Bonus {
  maxHp: number; // 最大HP（半ハート単位。2 で ♥1つ）
  dmgMul: number; // 技の攻撃力
  manaMax: number; // やる気の最大（全部のおもちゃ）
  regenMul: number; // やる気の回復
  stillRegen: number; // 止まっているときの回復の上乗せ（1 で2倍）
  speedMul: number; // 移動の速さ
  dashCdMul: number; // ダッシュの待ち時間
  iframes: number; // 当たったあとのむてき時間（秒）
  guard: number; // 当たりを防ぐ確率
  rangeMul: number; // 飛ぶ技のとどく距離
  elemMul: number; // 属性の効き目の長さ
  zapAdd: number; // ビリビリが飛び移る数
  summonAdd: number; // 召喚の上限
  killMana: number; // 虫を倒すたびのやる気
  clearHeal: number; // 部屋を片付けるたびの回復（半ハート）
  choiceAdd: number; // ごほうびの選択肢
  dashPower: number; // ダッシュのあと攻撃力1.5倍になる秒数
}

export const NO_BONUS: Bonus = {
  maxHp: 0, dmgMul: 1, manaMax: 0, regenMul: 1, stillRegen: 0, speedMul: 1, dashCdMul: 1, iframes: 0, guard: 0,
  rangeMul: 1, elemMul: 1, zapAdd: 0, summonAdd: 0, killMana: 0, clearHeal: 0, choiceAdd: 0, dashPower: 0,
};

type Part = Partial<Bonus>;

/** 倍率（*Mul）は掛け、それ以外は足す。 */
export function addBonus(a: Bonus, b: Part): Bonus {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Bonus, number][]) out[k] = k.endsWith("Mul") ? out[k] * v : out[k] + v;
  return out;
}

/** 効果の説明（説明欄の表）。 */
export function bonusRows(b: Part): [string, string][] {
  const pct = (m: number) => `${m > 1 ? "＋" : "−"}${Math.round(Math.abs(m - 1) * 100)}%`;
  const rows: [string, string][] = [];
  if (b.maxHp) rows.push(["最大HP", `＋♥${b.maxHp / 2}`]);
  if (b.dmgMul) rows.push(["攻撃力", pct(b.dmgMul)]);
  if (b.manaMax) rows.push(["やる気 最大", `＋${b.manaMax}`]);
  if (b.regenMul) rows.push(["やる気 回復", pct(b.regenMul)]);
  if (b.stillRegen) rows.push(["止まっているとき", `回復×${1 + b.stillRegen}`]);
  if (b.speedMul) rows.push(["移動の速さ", pct(b.speedMul)]);
  if (b.dashCdMul) rows.push(["ダッシュの待ち", pct(b.dashCdMul)]);
  if (b.iframes) rows.push(["当たったあとのむてき", `＋${b.iframes}秒`]);
  if (b.guard) rows.push(["当たりを防ぐ", `${Math.round(b.guard * 100)}%`]);
  if (b.rangeMul) rows.push(["とどく距離", pct(b.rangeMul)]);
  if (b.elemMul) rows.push(["属性の長さ", pct(b.elemMul)]);
  if (b.zapAdd) rows.push(["ビリビリの飛び移り", `＋${b.zapAdd}匹`]);
  if (b.summonAdd) rows.push(["召喚の上限", `＋${b.summonAdd}`]);
  if (b.killMana) rows.push(["虫を倒すと", `やる気＋${b.killMana}`]);
  if (b.clearHeal) rows.push(["部屋を片付けると", `♥${b.clearHeal / 2}回復`]);
  if (b.choiceAdd) rows.push(["ごほうびの選択肢", `＋${b.choiceAdd}`]);
  if (b.dashPower) rows.push(["ダッシュのあと", `${b.dashPower}秒 攻撃力1.5倍`]);
  return rows;
}

// ---------- レリック ----------
export interface RelicDef { id: string; name: string; desc: string; bonus: Part }

export const RELICS: Record<string, RelicDef> = {
  oyatsu: { id: "oyatsu", name: "ママの手作りおやつ", desc: "ママが焼いたおやつ。元気が出る", bonus: { maxHp: 2 } },
  milk: { id: "milk", name: "猫用ミルク", desc: "やる気がよく戻る", bonus: { regenMul: 1.25 } },
  moufu: { id: "moufu", name: "お気に入りの毛布", desc: "当たったあと、少し長くむてき", bonus: { iframes: 0.5 } },
  cream: { id: "cream", name: "肉球クリーム", desc: "ダッシュがすぐにまた使える", bonus: { dashCdMul: 0.6 } },
  nekokusa: { id: "nekokusa", name: "猫草", desc: "部屋を片付けるたびに少し回復", bonus: { clearHeal: 1 } },
  tower: { id: "tower", name: "キャットタワー", desc: "高い所で鍛えた。技がすべて強くなる", bonus: { dmgMul: 1.15 } },
  mushikago: { id: "mushikago", name: "虫かご", desc: "虫を倒すたびにやる気が戻る", bonus: { killMana: 6 } },
  hige: { id: "hige", name: "ピンとしたひげ", desc: "飛ぶ技・毛糸がより遠くまで届く", bonus: { rangeMul: 1.3 } },
  hinata: { id: "hinata", name: "日なたクッション", desc: "止まっていると、やる気が2倍の速さで戻る", bonus: { stillRegen: 1 } },
  nezumi: { id: "nezumi", name: "ねずみのおもちゃ", desc: "仲間を呼べる数が増える", bonus: { summonAdd: 1 } },
  maneki: { id: "maneki", name: "招き猫", desc: "ごほうびの選択肢が1つ増える", bonus: { choiceAdd: 1 } },
  shippo: { id: "shippo", name: "ふわふわしっぽ", desc: "少し速く動ける", bonus: { speedMul: 1.1 } },
  towel: { id: "towel", name: "ぬれタオル", desc: "属性（びしょぬれ・ねばねば・虫よけ）が長く効く", bonus: { elemMul: 1.5 } },
  sheet: { id: "sheet", name: "静電気シート", desc: "ビリビリがもう1匹に飛び移る", bonus: { zapAdd: 1 } },
};
export const RELIC_IDS = Object.keys(RELICS);

// ---------- 装備（Magicraft の装備セットのように、同じセットをそろえるとボーナス） ----------
export type GearSlot = "hat" | "body" | "collar";
export const GEAR_SLOTS: GearSlot[] = ["hat", "body", "collar"];
export const SLOT_NAME: Record<GearSlot, string> = { hat: "帽子", body: "服", collar: "首輪" };

export interface GearDef { id: string; name: string; slot: GearSlot; set: string; bonus: Part }
export interface SetDef { id: string; name: string; color: string; two: Part; three: Part }

export const SETS: Record<string, SetDef> = {
  ninja: { id: "ninja", name: "忍者猫セット", color: "#5c5f8a", two: { speedMul: 1.08 }, three: { dashPower: 1.5 } },
  wizard: { id: "wizard", name: "魔法使い猫セット", color: "#7048e8", two: { manaMax: 20 }, three: { regenMul: 1.3 } },
  knight: { id: "knight", name: "騎士猫セット", color: "#868e96", two: { maxHp: 2 }, three: { guard: 0.2 } },
};

export const GEAR: Record<string, GearDef> = {
  ninjaHat: { id: "ninjaHat", name: "忍びずきん", slot: "hat", set: "ninja", bonus: { dashCdMul: 0.85 } },
  ninjaBody: { id: "ninjaBody", name: "忍び装束", slot: "body", set: "ninja", bonus: { speedMul: 1.05 } },
  ninjaCollar: { id: "ninjaCollar", name: "鈴なし首輪", slot: "collar", set: "ninja", bonus: { iframes: 0.2 } },
  wizHat: { id: "wizHat", name: "とんがり帽子", slot: "hat", set: "wizard", bonus: { manaMax: 10 } },
  wizBody: { id: "wizBody", name: "星のマント", slot: "body", set: "wizard", bonus: { regenMul: 1.1 } },
  wizCollar: { id: "wizCollar", name: "魔法の首輪", slot: "collar", set: "wizard", bonus: { dmgMul: 1.05 } },
  knightHat: { id: "knightHat", name: "小さなかぶと", slot: "hat", set: "knight", bonus: { maxHp: 2 } },
  knightBody: { id: "knightBody", name: "ねこよろい", slot: "body", set: "knight", bonus: { guard: 0.1 } },
  knightCollar: { id: "knightCollar", name: "盾の首輪", slot: "collar", set: "knight", bonus: { iframes: 0.3 } },
};
export const GEAR_IDS = Object.keys(GEAR);

export type Gear = Record<GearSlot, string | null>;

/** 装備しているセットごとの数。 */
export function setCounts(gear: Gear): Record<string, number> {
  const n: Record<string, number> = {};
  for (const s of GEAR_SLOTS) { const g = gear[s]; if (g) n[GEAR[g].set] = (n[GEAR[g].set] ?? 0) + 1; }
  return n;
}

/** レリックと装備（セットボーナス込み）の合計。 */
export function totalBonus(relics: string[], gear: Gear): Bonus {
  let b = NO_BONUS;
  for (const r of relics) b = addBonus(b, RELICS[r].bonus);
  for (const s of GEAR_SLOTS) { const g = gear[s]; if (g) b = addBonus(b, GEAR[g].bonus); }
  for (const [set, n] of Object.entries(setCounts(gear))) {
    if (n >= 2) b = addBonus(b, SETS[set].two);
    if (n >= 3) b = addBonus(b, SETS[set].three);
  }
  return b;
}
