// レリック（持っているだけで効く）と装備（帽子・服・首輪。同じセットをそろえるとボーナス）。DOM 非依存。
//
// どちらも「ボーナス」を足し合わせるだけにして、ゲーム側は合計（Bonus）だけを見る。
import { L } from "../i18n";

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
  // 特殊効果
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
  if (b.maxHp) rows.push([L("最大HP", "Max HP"), `＋♥${b.maxHp / 2}`]);
  if (b.dmgMul) rows.push([L("攻撃力", "Damage"), pct(b.dmgMul)]);
  if (b.manaMax) rows.push([L("やる気 最大", "Max Energy"), `＋${b.manaMax}`]);
  if (b.regenMul) rows.push([L("やる気 回復", "Energy Regen"), pct(b.regenMul)]);
  if (b.stillRegen) rows.push([L("止まっているとき", "Standing Still"), L(`回復×${1 + b.stillRegen}`, `Regen ×${1 + b.stillRegen}`)]);
  if (b.speedMul) rows.push([L("移動の速さ", "Move Speed"), pct(b.speedMul)]);
  if (b.dashCdMul) rows.push([L("ダッシュの待ち", "Dash Cooldown"), pct(b.dashCdMul)]);
  if (b.iframes) rows.push([L("当たったあとのむてき", "Invincible After Hit"), L(`＋${b.iframes}秒`, `＋${b.iframes}s`)]);
  if (b.guard) rows.push([L("当たりを防ぐ", "Block Hits"), `${Math.round(b.guard * 100)}%`]);
  if (b.rangeMul) rows.push([L("とどく距離", "Range"), pct(b.rangeMul)]);
  if (b.elemMul) rows.push([L("属性の長さ", "Element Duration"), pct(b.elemMul)]);
  if (b.zapAdd) rows.push([L("ビリビリの飛び移り", "Zap Chains"), L(`＋${b.zapAdd}匹`, `＋${b.zapAdd}`)]);
  if (b.summonAdd) rows.push([L("召喚の上限", "Summon Limit"), `＋${b.summonAdd}`]);
  if (b.killMana) rows.push([L("虫を倒すと", "On Kill"), L(`やる気＋${b.killMana}`, `Energy ＋${b.killMana}`)]);
  if (b.clearHeal) rows.push([L("部屋を片付けると", "Room Cleared"), L(`♥${b.clearHeal / 2}回復`, `Heal ♥${b.clearHeal / 2}`)]);
  if (b.choiceAdd) rows.push([L("ごほうびの選択肢", "Reward Choices"), `＋${b.choiceAdd}`]);
  if (b.dashPower) rows.push([L("ダッシュのあと", "After Dash"), L(`${b.dashPower}秒 攻撃力1.5倍`, `Damage ×1.5 for ${b.dashPower}s`)]);
  if (b.crit) rows.push([L("会心（2倍）", "Crit (×2)"), `${Math.round(b.crit * 100)}%`]);
  if (b.killHeal) rows.push([L("倒すと♥0.5回復", "Heal ♥0.5 on Kill"), `${Math.round(b.killHeal * 100)}%`]);
  if (b.killBoom) rows.push([L("倒した虫がはじける", "Bugs Pop on Kill"), L(`攻撃力${Math.round(b.killBoom)}`, `Damage ${Math.round(b.killBoom)}`)]);
  if (b.thorns) rows.push([L("当たると反撃", "Counter When Hit"), L(`攻撃力${Math.round(b.thorns)}`, `Damage ${Math.round(b.thorns)}`)]);
  if (b.shield) rows.push([L("部屋ごとのバリア", "Shield per Room"), L(`${b.shield}回`, `×${b.shield}`)]);
  if (b.extraShot) rows.push([L("技がもう1発", "Extra Shot"), `${Math.round(b.extraShot * 100)}%`]);
  if (b.moveMana) rows.push([L("動くとやる気", "Energy While Moving"), L(`＋${b.moveMana}/秒`, `＋${b.moveMana}/s`)]);
  if (b.luck) rows.push([L("レア装備が出やすい", "Rare Gear Luck"), `＋${b.luck}`]);
  if (b.manaCostMul) rows.push([L("技のやる気", "Move Energy Cost"), pct(b.manaCostMul)]);
  if (b.castMul) rows.push([L("振る間隔・休けい", "Cast Delay / Resting"), pct(b.castMul)]);
  return rows;
}

// ---------- レリック ----------
export interface RelicDef { id: string; name: string; desc: string; bonus: Part }

export const RELICS: Record<string, RelicDef> = {
  oyatsu: { id: "oyatsu", name: L("ママの手作りおやつ", "Mama's Homemade Treat"), desc: L("ママが焼いたおやつ。元気が出る", "A treat Mama baked. Gives you pep"), bonus: { maxHp: 2 } },
  milk: { id: "milk", name: L("猫用ミルク", "Cat Milk"), desc: L("やる気がよく戻る", "Energy comes back faster"), bonus: { regenMul: 1.25 } },
  moufu: { id: "moufu", name: L("お気に入りの毛布", "Favorite Blanket"), desc: L("当たったあと、少し長くむてき", "Stay invincible a bit longer after a hit"), bonus: { iframes: 0.5 } },
  cream: { id: "cream", name: L("肉球クリーム", "Paw Cream"), desc: L("ダッシュがすぐにまた使える", "Dash recharges quickly"), bonus: { dashCdMul: 0.6 } },
  nekokusa: { id: "nekokusa", name: L("猫草", "Cat Grass"), desc: L("部屋を片付けるたびに少し回復", "Heal a little each time you clear a room"), bonus: { clearHeal: 1 } },
  tower: { id: "tower", name: L("キャットタワー", "Cat Tower"), desc: L("高い所で鍛えた。技がすべて強くなる", "Trained up high. All moves get stronger"), bonus: { dmgMul: 1.15 } },
  mushikago: { id: "mushikago", name: L("虫かご", "Bug Cage"), desc: L("虫を倒すたびにやる気が戻る", "Regain Energy with every bug defeated"), bonus: { killMana: 6 } },
  hige: { id: "hige", name: L("ピンとしたひげ", "Perky Whiskers"), desc: L("飛ぶ技・毛糸がより遠くまで届く", "Flying moves and yarn reach farther"), bonus: { rangeMul: 1.3 } },
  hinata: { id: "hinata", name: L("日なたクッション", "Sunny Cushion"), desc: L("止まっていると、やる気が2倍の速さで戻る", "Energy returns 2x faster while standing still"), bonus: { stillRegen: 1 } },
  nezumi: { id: "nezumi", name: L("ねずみのおもちゃ", "Mouse Toy"), desc: L("仲間を呼べる数が増える", "Summon more buddies"), bonus: { summonAdd: 1 } },
  maneki: { id: "maneki", name: L("招き猫", "Lucky Cat"), desc: L("ごほうびの選択肢が1つ増える", "One more reward choice"), bonus: { choiceAdd: 1 } },
  shippo: { id: "shippo", name: L("ふわふわしっぽ", "Fluffy Tail"), desc: L("少し速く動ける", "Move a little faster"), bonus: { speedMul: 1.1 } },
  towel: { id: "towel", name: L("ぬれタオル", "Wet Towel"), desc: L("属性（びしょぬれ・ねばねば・虫よけ）が長く効く", "Elements (Soaked, Sticky, Bug Spray) last longer"), bonus: { elemMul: 1.5 } },
  sheet: { id: "sheet", name: L("静電気シート", "Static Sheet"), desc: L("ビリビリがもう1匹に飛び移る", "Zap jumps to 1 more bug"), bonus: { zapAdd: 1 } },
  biidama: { id: "biidama", name: L("きらきらビー玉", "Shiny Marble"), desc: L("ときどき会心の一撃（攻撃力2倍）", "Sometimes lands a crit (×2 damage)"), bonus: { crit: 0.12 } },
  kaitenguruma: { id: "kaitenguruma", name: L("ハムスターの回し車", "Hamster Wheel"), desc: L("走り回るほどやる気が出る", "The more you run, the more Energy"), bonus: { moveMana: 6 } },
  buzzer: { id: "buzzer", name: L("防犯ブザー", "Safety Buzzer"), desc: L("当たると大きな音で、まわりの虫に反撃", "When hit, a loud blast hits nearby bugs"), bonus: { thorns: 14 } },
  omamori: { id: "omamori", name: L("ペットのお守り", "Pet Charm"), desc: L("部屋に入るたび、1回だけ当たりを防ぐ", "Blocks 1 hit each time you enter a room"), bonus: { shield: 1 } },
  nekokan: { id: "nekokan", name: L("高級猫缶", "Fancy Cat Food"), desc: L("虫を倒すと、ときどき元気が戻る", "Sometimes heal when defeating bugs"), bonus: { killHeal: 0.1 } },
  copy: { id: "copy", name: L("ママのコピー用紙", "Mama's Copy Paper"), desc: L("技がときどきもう1発出る", "Moves sometimes fire an extra shot"), bonus: { extraShot: 0.15 } },
  kyujiki: { id: "kyujiki", name: L("自動給餌器", "Auto Feeder"), desc: L("時間になるとごはんが出てくる。技のやる気が25%少なくてすむ", "Food comes out on schedule. Moves cost 25% less Energy"), bonus: { manaCostMul: 0.75 } },
  catwalk: { id: "catwalk", name: L("キャットウォーク", "Catwalk"), desc: L("壁の上の通り道で鍛えた。振る間隔・休けいが20%短い", "Trained on the wall-top path. Cast delay and Resting 20% shorter"), bonus: { castMul: 0.8 } },
};
export const RELIC_IDS = Object.keys(RELICS);

// ---------- 装備（同じセットをそろえるとボーナス） ----------
// 飼い主が「かわいい！」と思って買ってきた、よくわからない物を着せられている。
export type GearSlot = "hat" | "body" | "collar";
export const GEAR_SLOTS: GearSlot[] = ["hat", "body", "collar"];
export const SLOT_NAME: Record<GearSlot, string> = { hat: L("頭", "Head"), body: L("服", "Body"), collar: L("首", "Neck") };

export interface GearDef { id: string; name: string; slot: GearSlot; set: string; desc: string; bonus: Part }

/** レアリティ（上がるほど効果が大きく、エピック以上は特殊効果がつく）。 */
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY: { name: string; color: string; k: number; fx: number }[] = [
  { name: L("ふつう", "Common"), color: "#868e96", k: 1, fx: 0 },
  { name: L("レア", "Rare"), color: "#1c7ed6", k: 1.5, fx: 0 },
  { name: L("エピック", "Epic"), color: "#ae3ec9", k: 2, fx: 1 },
  { name: L("伝説", "Legendary"), color: "#f08c00", k: 2.6, fx: 2 },
];

/** 装備1つ（同じ装備でもレアリティと特殊効果が違う）。 */
export interface GearItem { id: string; rar: Rarity; fx: string[] }

/** エピック以上につく特殊効果。 */
export const GEAR_FX: Record<string, { name: string; bonus: Part }> = {
  crit: { name: L("会心", "Crit"), bonus: { crit: 0.1 } },
  killHeal: { name: L("倒して回復", "Kill Heal"), bonus: { killHeal: 0.08 } },
  killBoom: { name: L("倒すとはじける", "Pop on Kill"), bonus: { killBoom: 8 } },
  thorns: { name: L("反撃", "Counter"), bonus: { thorns: 12 } },
  shield: { name: L("バリア", "Shield"), bonus: { shield: 1 } },
  extraShot: { name: L("もう1発", "Extra Shot"), bonus: { extraShot: 0.12 } },
  moveMana: { name: L("走ってやる気", "Run Energy"), bonus: { moveMana: 5 } },
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
  hawaii: { id: "hawaii", name: L("ハワイのお土産セット", "Hawaii Souvenir Set"), color: "#f76707", two: { regenMul: 1.2 }, three: { stillRegen: 1 } },
  gacha: { id: "gacha", name: L("ガチャガチャの天使セット", "Capsule Toy Angel Set"), color: "#e64980", two: { guard: 0.1 }, three: { clearHeal: 2 } },
  fruit: { id: "fruit", name: L("くだものの被り物セット", "Fruit Hat Set"), color: "#f59f00", two: { maxHp: 2 }, three: { iframes: 0.5 } },
  knit: { id: "knit", name: L("ママの手編みセット", "Mama's Knit Set"), color: "#2f9e44", two: { dmgMul: 1.1 }, three: { dashPower: 1.5 } },
  hyakkin: { id: "hyakkin", name: L("100円ショップセット", "Dollar Store Set"), color: "#12b886", two: { crit: 0.1 }, three: { extraShot: 0.15 } },
  petshop: { id: "petshop", name: L("ペットショップの新作セット", "Pet Shop New Arrivals Set"), color: "#4c6ef5", two: { moveMana: 4 }, three: { shield: 1 } },
};

export const GEAR: Record<string, GearDef> = {
  hibiscus: { id: "hibiscus", name: L("ハイビスカスの髪飾り", "Hibiscus Hair Clip"), slot: "hat", set: "hawaii", desc: L("ハワイ土産。耳に引っかけてある", "A Hawaii souvenir. Hooked on one ear"), bonus: { regenMul: 1.1 } },
  aloha: { id: "aloha", name: L("アロハシャツ", "Aloha Shirt"), slot: "body", set: "hawaii", desc: L("人間用Sサイズ。すそを引きずる", "Human size S. The hem drags"), bonus: { speedMul: 1.05 } },
  lei: { id: "lei", name: L("フラのレイ", "Hula Lei"), slot: "collar", set: "hawaii", desc: L("造花のレイ。ちょっとかじった跡がある", "A fake-flower lei. Slightly chewed"), bonus: { manaMax: 10 } },
  halo: { id: "halo", name: L("天使の輪カチューシャ", "Angel Halo Headband"), slot: "hat", set: "gacha", desc: L("ガチャガチャで3回目に出た", "Came out on the 3rd capsule try"), bonus: { iframes: 0.2 } },
  wings: { id: "wings", name: L("天使の羽", "Angel Wings"), slot: "body", set: "gacha", desc: L("ガチャガチャの大当たり。飛べない", "The capsule toy jackpot. Can't fly"), bonus: { dashCdMul: 0.85 } },
  heartCollar: { id: "heartCollar", name: L("光るハートの首輪", "Glowing Heart Collar"), slot: "collar", set: "gacha", desc: L("ボタン電池で7色に光る", "Glows in 7 colors on a coin battery"), bonus: { maxHp: 2 } },
  mikan: { id: "mikan", name: L("みかんの被り物", "Orange Hat"), slot: "hat", set: "fruit", desc: L("SNSで流行っていたやつ。顔だけ出る", "That one trending online. Only your face pokes out"), bonus: { maxHp: 2 } },
  suika: { id: "suika", name: L("スイカ柄のTシャツ", "Watermelon T-Shirt"), slot: "body", set: "fruit", desc: L("夏祭りで買った。背中に種のもよう", "Bought at a summer festival. Seeds on the back"), bonus: { clearHeal: 1 } },
  cherry: { id: "cherry", name: L("さくらんぼの首輪", "Cherry Collar"), slot: "collar", set: "fruit", desc: L("鈴の代わりにさくらんぼが2つ", "Two cherries instead of a bell"), bonus: { regenMul: 1.1 } },
  beanie: { id: "beanie", name: L("毛糸の帽子", "Knit Cap"), slot: "hat", set: "knit", desc: L("耳の穴の位置がちょっとずれている", "The ear holes are a bit off"), bonus: { dmgMul: 1.05 } },
  sweater: { id: "sweater", name: L("手編みのセーター", "Hand-Knit Sweater"), slot: "body", set: "knit", desc: L("ママの力作。猫の顔のもよう入り", "Mama's masterpiece. Has a cat face on it"), bonus: { iframes: 0.2 } },
  sunglass: { id: "sunglass", name: L("おもちゃのサングラス", "Toy Sunglasses"), slot: "hat", set: "hyakkin", desc: L("レンズがハート形。すぐずり落ちる", "Heart-shaped lenses. Keep slipping off"), bonus: { dmgMul: 1.05 } },
  haramaki: { id: "haramaki", name: L("毛糸の腹巻き", "Knit Belly Warmer"), slot: "body", set: "hyakkin", desc: L("「おなかを冷やさないように」と言われた", "\"Don't let your tummy get cold,\" they said"), bonus: { maxHp: 2 } },
  bowtie: { id: "bowtie", name: L("蝶ネクタイ", "Bow Tie"), slot: "collar", set: "hyakkin", desc: L("なぜか金色。結婚式帰りっぽい", "Gold, for some reason. Looks fresh from a wedding"), bonus: { regenMul: 1.1 } },
  usamimi: { id: "usamimi", name: L("うさ耳フード", "Bunny Ear Hood"), slot: "hat", set: "petshop", desc: L("猫なのにうさぎ。店員さんのおすすめ", "A cat dressed as a bunny. Staff pick"), bonus: { speedMul: 1.05 } },
  raincoat: { id: "raincoat", name: L("黄色いレインコート", "Yellow Raincoat"), slot: "body", set: "petshop", desc: L("雨の日は外に出ないのに買った", "Bought it, though you never go out in the rain"), bonus: { iframes: 0.2 } },
  gps: { id: "gps", name: L("GPS首輪", "GPS Collar"), slot: "collar", set: "petshop", desc: L("家から一歩も出ないのに位置がわかる", "Tracks you, though you never leave the house"), bonus: { manaMax: 10 } },
  nametag: { id: "nametag", name: L("迷子札の首輪", "Name Tag Collar"), slot: "collar", set: "knit", desc: L("名前と「とてもかわいい」と書いてある", "Says your name and \"VERY CUTE\""), bonus: { dmgMul: 1.05 } },
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
