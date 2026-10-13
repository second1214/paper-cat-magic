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
  // Magicraft の装備・レリックにある特殊効果
  crit: number; // 会心（攻撃力2倍）の確率
  killHeal: number; // 虫を倒したとき♥0.5回復する確率
  killBoom: number; // 倒した虫がはじける（攻撃力）
  thorns: number; // 当たったとき、まわりの虫へ反撃（攻撃力）
  shield: number; // 部屋に入るたびのバリア（回数）
  extraShot: number; // 技がもう1発出る確率
  moveMana: number; // 動いている間のやる気回復（毎秒）
  luck: number; // 装備のレアリティが上がりやすい
  manaCostMul: number; // 技のやる気の消費
  castMul: number; // 振る間隔・休けい
}

export const NO_BONUS: Bonus = {
  maxHp: 0, dmgMul: 1, manaMax: 0, regenMul: 1, stillRegen: 0, speedMul: 1, dashCdMul: 1, iframes: 0, guard: 0,
  rangeMul: 1, elemMul: 1, zapAdd: 0, summonAdd: 0, killMana: 0, clearHeal: 0, choiceAdd: 0, dashPower: 0,
  crit: 0, killHeal: 0, killBoom: 0, thorns: 0, shield: 0, extraShot: 0, moveMana: 0, luck: 0,
  manaCostMul: 1, castMul: 1,
};

export type Part = Partial<Bonus>;

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
  if (b.crit) rows.push(["会心（2倍）", `${Math.round(b.crit * 100)}%`]);
  if (b.killHeal) rows.push(["倒すと♥0.5回復", `${Math.round(b.killHeal * 100)}%`]);
  if (b.killBoom) rows.push(["倒した虫がはじける", `攻撃力${Math.round(b.killBoom)}`]);
  if (b.thorns) rows.push(["当たると反撃", `攻撃力${Math.round(b.thorns)}`]);
  if (b.shield) rows.push(["部屋ごとのバリア", `${b.shield}回`]);
  if (b.extraShot) rows.push(["技がもう1発", `${Math.round(b.extraShot * 100)}%`]);
  if (b.moveMana) rows.push(["動くとやる気", `＋${b.moveMana}/秒`]);
  if (b.luck) rows.push(["レア装備が出やすい", `＋${b.luck}`]);
  if (b.manaCostMul) rows.push(["技のやる気", pct(b.manaCostMul)]);
  if (b.castMul) rows.push(["振る間隔・休けい", pct(b.castMul)]);
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
  biidama: { id: "biidama", name: "きらきらビー玉", desc: "ときどき会心の一撃（攻撃力2倍）", bonus: { crit: 0.12 } },
  kaitenguruma: { id: "kaitenguruma", name: "ハムスターの回し車", desc: "走り回るほどやる気が出る", bonus: { moveMana: 6 } },
  buzzer: { id: "buzzer", name: "防犯ブザー", desc: "当たると大きな音で、まわりの虫に反撃", bonus: { thorns: 14 } },
  omamori: { id: "omamori", name: "ペットのお守り", desc: "部屋に入るたび、1回だけ当たりを防ぐ", bonus: { shield: 1 } },
  nekokan: { id: "nekokan", name: "高級猫缶", desc: "虫を倒すと、ときどき元気が戻る", bonus: { killHeal: 0.1 } },
  copy: { id: "copy", name: "ママのコピー用紙", desc: "技がときどきもう1発出る", bonus: { extraShot: 0.15 } },
  kyujiki: { id: "kyujiki", name: "自動給餌器", desc: "時間になるとごはんが出てくる。技のやる気が25%少なくてすむ", bonus: { manaCostMul: 0.75 } },
  catwalk: { id: "catwalk", name: "キャットウォーク", desc: "壁の上の通り道で鍛えた。振る間隔・休けいが20%短い", bonus: { castMul: 0.8 } },
};
export const RELIC_IDS = Object.keys(RELICS);

// ---------- 装備（Magicraft の装備セットのように、同じセットをそろえるとボーナス） ----------
// 飼い主が「かわいい！」と思って買ってきた、よくわからない物を着せられている。
export type GearSlot = "hat" | "body" | "collar";
export const GEAR_SLOTS: GearSlot[] = ["hat", "body", "collar"];
export const SLOT_NAME: Record<GearSlot, string> = { hat: "頭", body: "服", collar: "首" };

export interface GearDef { id: string; name: string; slot: GearSlot; set: string; desc: string; bonus: Part }

/** レアリティ（Magicraft と同じく、上がるほど効果が大きく、エピック以上は特殊効果がつく）。 */
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY: { name: string; color: string; k: number; fx: number }[] = [
  { name: "ふつう", color: "#868e96", k: 1, fx: 0 },
  { name: "レア", color: "#1c7ed6", k: 1.5, fx: 0 },
  { name: "エピック", color: "#ae3ec9", k: 2, fx: 1 },
  { name: "伝説", color: "#f08c00", k: 2.6, fx: 2 },
];

/** 装備1つ（同じ装備でもレアリティと特殊効果が違う）。 */
export interface GearItem { id: string; rar: Rarity; fx: string[] }

/** エピック以上につく特殊効果（Magicraft の装備・レリックにある効果）。 */
export const GEAR_FX: Record<string, { name: string; bonus: Part }> = {
  crit: { name: "会心", bonus: { crit: 0.1 } },
  killHeal: { name: "倒して回復", bonus: { killHeal: 0.08 } },
  killBoom: { name: "倒すとはじける", bonus: { killBoom: 8 } },
  thorns: { name: "反撃", bonus: { thorns: 12 } },
  shield: { name: "バリア", bonus: { shield: 1 } },
  extraShot: { name: "もう1発", bonus: { extraShot: 0.12 } },
  moveMana: { name: "走ってやる気", bonus: { moveMana: 5 } },
};
export const GEAR_FX_IDS = Object.keys(GEAR_FX);

/** 効果をレアリティの倍率で強くする（倍率は1からの差を、加算はそのまま掛ける。HPは♥単位）。 */
export function scaleBonus(b: Part, k: number): Part {
  const out: Part = {};
  for (const [key, v] of Object.entries(b) as [keyof Bonus, number][]) {
    out[key] = key.endsWith("Mul") ? 1 + (v - 1) * k : key === "maxHp" || key === "shield" || key === "clearHeal" ? Math.max(v, Math.round((v * k) / 2) * 2 || v) : +(v * k).toFixed(2);
  }
  if (b.shield) out.shield = b.shield;
  return out;
}

/** 装備1つの効果（レアリティ倍率＋特殊効果）。 */
export function gearBonus(g: GearItem): Part {
  let b: Bonus = addBonus(NO_BONUS, scaleBonus(GEAR[g.id].bonus, RARITY[g.rar].k));
  for (const f of g.fx) b = addBonus(b, GEAR_FX[f].bonus);
  return diffBonus(b);
}

/** NO_BONUS との差だけを取り出す（説明欄用）。 */
function diffBonus(b: Bonus): Part {
  const out: Part = {};
  for (const k of Object.keys(b) as (keyof Bonus)[]) if (b[k] !== NO_BONUS[k]) out[k] = b[k];
  return out;
}

/** 装備を1つ作る（レアリティは運と章で上がりやすい）。 */
export function rollGear(id: string, rand: () => number, luck: number, act: number): GearItem {
  const w = [Math.max(10, 62 - act * 8 - luck * 6), 26 + act * 3, 9 + act * 3 + luck * 4, 3 + act * 2 + luck * 2];
  let x = rand() * w.reduce((a, b) => a + b, 0), rar = 0;
  while (x > w[rar] && rar < 3) { x -= w[rar]; rar++; }
  const pool = [...GEAR_FX_IDS], fx: string[] = [];
  for (let k = 0; k < RARITY[rar].fx; k++) fx.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return { id, rar: rar as Rarity, fx };
}
export interface SetDef { id: string; name: string; color: string; two: Part; three: Part }

export const SETS: Record<string, SetDef> = {
  hawaii: { id: "hawaii", name: "ハワイのお土産セット", color: "#f76707", two: { regenMul: 1.2 }, three: { stillRegen: 1 } },
  gacha: { id: "gacha", name: "ガチャガチャの天使セット", color: "#e64980", two: { guard: 0.1 }, three: { clearHeal: 2 } },
  fruit: { id: "fruit", name: "くだものの被り物セット", color: "#f59f00", two: { maxHp: 2 }, three: { iframes: 0.5 } },
  knit: { id: "knit", name: "ママの手編みセット", color: "#2f9e44", two: { dmgMul: 1.1 }, three: { dashPower: 1.5 } },
  hyakkin: { id: "hyakkin", name: "100円ショップセット", color: "#12b886", two: { crit: 0.1 }, three: { extraShot: 0.15 } },
  petshop: { id: "petshop", name: "ペットショップの新作セット", color: "#4c6ef5", two: { moveMana: 4 }, three: { shield: 1 } },
};

export const GEAR: Record<string, GearDef> = {
  hibiscus: { id: "hibiscus", name: "ハイビスカスの髪飾り", slot: "hat", set: "hawaii", desc: "ハワイ土産。耳に引っかけてある", bonus: { regenMul: 1.1 } },
  aloha: { id: "aloha", name: "アロハシャツ", slot: "body", set: "hawaii", desc: "人間用Sサイズ。すそを引きずる", bonus: { speedMul: 1.05 } },
  lei: { id: "lei", name: "フラのレイ", slot: "collar", set: "hawaii", desc: "造花のレイ。ちょっとかじった跡がある", bonus: { manaMax: 10 } },
  halo: { id: "halo", name: "天使の輪カチューシャ", slot: "hat", set: "gacha", desc: "ガチャガチャで3回目に出た", bonus: { iframes: 0.2 } },
  wings: { id: "wings", name: "天使の羽", slot: "body", set: "gacha", desc: "ガチャガチャの大当たり。飛べない", bonus: { dashCdMul: 0.85 } },
  heartCollar: { id: "heartCollar", name: "光るハートの首輪", slot: "collar", set: "gacha", desc: "ボタン電池で7色に光る", bonus: { maxHp: 2 } },
  mikan: { id: "mikan", name: "みかんの被り物", slot: "hat", set: "fruit", desc: "SNSで流行っていたやつ。顔だけ出る", bonus: { maxHp: 2 } },
  suika: { id: "suika", name: "スイカ柄のTシャツ", slot: "body", set: "fruit", desc: "夏祭りで買った。背中に種のもよう", bonus: { clearHeal: 1 } },
  cherry: { id: "cherry", name: "さくらんぼの首輪", slot: "collar", set: "fruit", desc: "鈴の代わりにさくらんぼが2つ", bonus: { regenMul: 1.1 } },
  beanie: { id: "beanie", name: "毛糸の帽子", slot: "hat", set: "knit", desc: "耳の穴の位置がちょっとずれている", bonus: { dmgMul: 1.05 } },
  sweater: { id: "sweater", name: "手編みのセーター", slot: "body", set: "knit", desc: "ママの力作。猫の顔のもよう入り", bonus: { iframes: 0.2 } },
  sunglass: { id: "sunglass", name: "おもちゃのサングラス", slot: "hat", set: "hyakkin", desc: "レンズがハート形。すぐずり落ちる", bonus: { dmgMul: 1.05 } },
  haramaki: { id: "haramaki", name: "毛糸の腹巻き", slot: "body", set: "hyakkin", desc: "「おなかを冷やさないように」と言われた", bonus: { maxHp: 2 } },
  bowtie: { id: "bowtie", name: "蝶ネクタイ", slot: "collar", set: "hyakkin", desc: "なぜか金色。結婚式帰りっぽい", bonus: { regenMul: 1.1 } },
  usamimi: { id: "usamimi", name: "うさ耳フード", slot: "hat", set: "petshop", desc: "猫なのにうさぎ。店員さんのおすすめ", bonus: { speedMul: 1.05 } },
  raincoat: { id: "raincoat", name: "黄色いレインコート", slot: "body", set: "petshop", desc: "雨の日は外に出ないのに買った", bonus: { iframes: 0.2 } },
  gps: { id: "gps", name: "GPS首輪", slot: "collar", set: "petshop", desc: "家から一歩も出ないのに位置がわかる", bonus: { manaMax: 10 } },
  nametag: { id: "nametag", name: "迷子札の首輪", slot: "collar", set: "knit", desc: "名前と「とてもかわいい」と書いてある", bonus: { dmgMul: 1.05 } },
};
export const GEAR_IDS = Object.keys(GEAR);

export type Gear = Record<GearSlot, GearItem | null>;

/** 装備しているセットごとの数。 */
export function setCounts(gear: Gear): Record<string, number> {
  const n: Record<string, number> = {};
  for (const s of GEAR_SLOTS) { const g = gear[s]; if (g) n[GEAR[g.id].set] = (n[GEAR[g.id].set] ?? 0) + 1; }
  return n;
}

/** レリックと装備（セットボーナス込み）の合計。 */
export function totalBonus(relics: string[], gear: Gear, extra: Part = {}): Bonus {
  let b = addBonus(NO_BONUS, extra);
  for (const r of relics) b = addBonus(b, RELICS[r].bonus);
  for (const s of GEAR_SLOTS) { const g = gear[s]; if (g) b = addBonus(b, gearBonus(g)); }
  for (const [set, n] of Object.entries(setCounts(gear))) {
    if (n >= 2) b = addBonus(b, SETS[set].two);
    if (n >= 3) b = addBonus(b, SETS[set].three);
  }
  return b;
}
