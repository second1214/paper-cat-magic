// 難易度と、周回で強くなる「ねこの成長」（にぼしで買う永続強化）。DOM 非依存。
import type { Part } from "./items";
import { L } from "../i18n";

export interface Difficulty {
  id: string;
  name: string;
  desc: string;
  hp: number; // 虫の体力の倍率
  speed: number; // 虫の速さの倍率
  extra: number; // 1つの波に出る虫の数（増減）
  dmg: number; // 虫の攻撃力の倍率
  startHp: number; // 猫の最初の最大HP
  reward: number; // もらえるにぼしの倍率
}

export const DIFFS: Difficulty[] = [
  { id: "easy", name: L("やさしい", "Easy"), desc: L("虫が弱くて少ない。はじめての人向け", "Fewer, weaker bugs. For first-timers"), hp: 0.75, speed: 0.9, extra: -1, dmg: 0.7, startHp: 110, reward: 0.6 },
  { id: "normal", name: L("ふつう", "Normal"), desc: L("ふつうの1年", "A normal year"), hp: 1, speed: 1, extra: 0, dmg: 1, startHp: 80, reward: 1 },
  { id: "hard", name: L("むずかしい", "Hard"), desc: L("虫がかたくて速く、数も多い", "Tougher, faster, and more bugs"), hp: 1.45, speed: 1.1, extra: 1, dmg: 1.3, startHp: 80, reward: 1.6 },
  { id: "nightmare", name: L("悪夢", "Nightmare"), desc: L("むずかしいをクリアすると選べる。虫の攻撃がとても痛い", "Unlocked by clearing Hard. Bugs hit very hard"), hp: 2, speed: 1.2, extra: 2, dmg: 1.7, startHp: 70, reward: 2.5 },
];

/** ねこの成長（レベル）。 */
export interface MetaLv { hp: number; atk: number; mana: number; speed: number; regen: number; armor: number; luck: number; gift: number; coins: number; nine: number; fav: number; sun: number }
export const NO_META: MetaLv = { hp: 0, atk: 0, mana: 0, speed: 0, regen: 0, armor: 0, luck: 0, gift: 0, coins: 0, nine: 0, fav: 0, sun: 0 };

/** にぼしで買う永続強化。ひなたぼっこは上限なし（ずっと使い道があるように）。 */
export const UPGRADES: { id: keyof MetaLv; name: string; desc: string; max: number; cost: (lv: number) => number; bonus: (lv: number) => Part }[] = [
  { id: "hp", name: L("じょうぶな体", "Sturdy Body"), desc: L("最大HP ＋10", "Max HP ＋10"), max: 10, cost: (lv) => 15 + lv * 15, bonus: (lv) => ({ maxHp: lv * 10 }) },
  { id: "atk", name: L("とがった爪", "Sharp Claws"), desc: L("攻撃力 ＋5%", "Damage ＋5%"), max: 10, cost: (lv) => 12 + lv * 14, bonus: (lv) => ({ dmgMul: 1 + lv * 0.05 }) },
  { id: "mana", name: L("やる気満々", "Full of Energy"), desc: L("やる気の最大 ＋10", "Max Energy ＋10"), max: 10, cost: (lv) => 10 + lv * 12, bonus: (lv) => ({ manaMax: lv * 10 }) },
  { id: "regen", name: L("ごはん大好き", "Big Appetite"), desc: L("やる気の回復 ＋6%", "Energy Regen ＋6%"), max: 5, cost: (lv) => 20 + lv * 20, bonus: (lv) => ({ regenMul: 1 + lv * 0.06 }) },
  { id: "speed", name: L("しなやかな足", "Nimble Paws"), desc: L("移動の速さ ＋3%", "Move Speed ＋3%"), max: 5, cost: (lv) => 15 + lv * 15, bonus: (lv) => ({ speedMul: 1 + lv * 0.03 }) },
  { id: "armor", name: L("もふもふの毛", "Fluffy Coat"), desc: L("受けるダメージ −4%", "Damage Taken −4%"), max: 8, cost: (lv) => 25 + lv * 25, bonus: (lv) => ({ hurtMul: 1 - lv * 0.04 }) },
  { id: "luck", name: L("招き猫の運", "Lucky Cat Luck"), desc: L("レアな装備が出やすい", "Rare gear shows up more"), max: 3, cost: (lv) => 20 + lv * 20, bonus: (lv) => ({ luck: lv }) },
  { id: "gift", name: L("ママのおみやげ", "Mama's Souvenir"), desc: L("最初からレリックを1つ多く持って始まる", "Start with 1 more charm"), max: 3, cost: (lv) => 40 + lv * 60, bonus: () => ({}) },
  { id: "coins", name: L("へそくり", "Secret Stash Money"), desc: L("最初のカリカリ ＋5", "Starting kibble ＋5"), max: 5, cost: (lv) => 20 + lv * 15, bonus: () => ({}) },
  { id: "nine", name: L("九つの命", "Nine Lives"), desc: L("1回の冒険に1度だけ、やられてもHP30%で起き上がる", "Once per run, get back up with 30% HP when defeated"), max: 1, cost: () => 300, bonus: () => ({}) },
  { id: "fav", name: L("おきにいりの箱", "Favorites Box"), desc: L("おきにいり枠 ＋1（クリアしたときに選んだ技を、次の冒険へ持っていける）", "Favorites slot ＋1 (bring a move picked on clear into your next run)"), max: 4, cost: (lv) => 30 + lv * 30, bonus: () => ({}) },
  { id: "sun", name: L("ひなたぼっこ", "Sunbathing"), desc: L("攻撃力・最大HP ＋1%（上限なし）", "Damage & Max HP ＋1% (no limit)"), max: 9999, cost: (lv) => 80 + lv * 10, bonus: () => ({}) },
];

/** 成長の合計効果。 */
export function metaBonus(lv: MetaLv): Part {
  const out: Part = {};
  for (const u of UPGRADES) for (const [k, v] of Object.entries(u.bonus(lv[u.id] ?? 0)) as [keyof Part, number][]) out[k] = v;
  if (lv.sun) out.dmgMul = (out.dmgMul ?? 1) * (1 + lv.sun * 0.01);   // 最大HPの％は World 側で掛ける
  return out;
}

/** 1回の冒険でもらえるにぼし（進んだ部屋・ボス・クリア × 難易度。呪い1つにつき＋15%）。 */
export function runReward(roomsCleared: number, bossesBeaten: number, win: boolean, diff: number, curses = 0): number {
  return Math.round((roomsCleared * 1 + bossesBeaten * 5 + (win ? 10 : 0)) * DIFFS[diff].reward * (1 + curses * 0.15));
}

/** locked: まだ解放していないもの（"spell:id" / "toy:id" / "relic:id"）。 */
/** endless: エンドレスモード（夏のあとも季節がめぐり続け、だんだん強くなる。ポイントでランキング）。 */
/** favorites: おきにいり（クリアしたときに選んだ技。最初から手持ちに入る）。 */
/** training: トレーニング部屋（技を自由に試してDPSを見る）。 */
export interface RunOptions { difficulty: number; meta: MetaLv; locked?: string[]; endless?: boolean; favorites?: string[]; training?: boolean }

/** おきにいり枠の数（はじめは1つ、おきにいりの箱で増える）。 */
export const favSlots = (m: MetaLv) => 1 + (m.fav ?? 0);
export const DEFAULT_RUN: RunOptions = { difficulty: 1, meta: NO_META };
