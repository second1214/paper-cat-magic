// 難易度と、周回で強くなる「ねこの成長」（にぼしで買う永続強化）。DOM 非依存。
import type { Part } from "./items";

export interface Difficulty {
  id: string;
  name: string;
  desc: string;
  hp: number; // 虫の体力の倍率
  speed: number; // 虫の速さの倍率
  extra: number; // 1つの波に出る虫の数（増減）
  dmg: number; // 当たったときに減るHP（半ハート）
  startHp: number; // 猫の最初の最大HP（半ハート）
  reward: number; // もらえるにぼしの倍率
}

export const DIFFS: Difficulty[] = [
  { id: "easy", name: "やさしい", desc: "虫が弱くて少ない。はじめての人向け", hp: 0.7, speed: 0.9, extra: -1, dmg: 1, startHp: 8, reward: 0.6 },
  { id: "normal", name: "ふつう", desc: "ふつうの1年", hp: 1, speed: 1, extra: 0, dmg: 1, startHp: 6, reward: 1 },
  { id: "hard", name: "むずかしい", desc: "虫がかたくて速く、数も多い", hp: 1.45, speed: 1.1, extra: 1, dmg: 1, startHp: 6, reward: 1.6 },
  { id: "nightmare", name: "悪夢", desc: "むずかしいをクリアすると選べる。当たると♥1減る", hp: 2, speed: 1.2, extra: 2, dmg: 2, startHp: 8, reward: 2.5 },
];

/** ねこの成長（レベル）。 */
export interface MetaLv { hp: number; atk: number; mana: number; speed: number; luck: number; gift: number; fav: number }
export const NO_META: MetaLv = { hp: 0, atk: 0, mana: 0, speed: 0, luck: 0, gift: 0, fav: 0 };

export const UPGRADES: { id: keyof MetaLv; name: string; desc: string; max: number; cost: (lv: number) => number; bonus: (lv: number) => Part }[] = [
  { id: "hp", name: "じょうぶな体", desc: "最大HP ＋♥1", max: 3, cost: (lv) => 15 + lv * 20, bonus: (lv) => ({ maxHp: lv * 2 }) },
  { id: "atk", name: "とがった爪", desc: "攻撃力 ＋6%", max: 5, cost: (lv) => 10 + lv * 12, bonus: (lv) => ({ dmgMul: 1 + lv * 0.06 }) },
  { id: "mana", name: "やる気満々", desc: "やる気の最大 ＋10", max: 5, cost: (lv) => 10 + lv * 10, bonus: (lv) => ({ manaMax: lv * 10 }) },
  { id: "speed", name: "しなやかな足", desc: "移動の速さ ＋3%", max: 3, cost: (lv) => 12 + lv * 12, bonus: (lv) => ({ speedMul: 1 + lv * 0.03 }) },
  { id: "luck", name: "招き猫の運", desc: "レアな装備が出やすい", max: 3, cost: (lv) => 20 + lv * 20, bonus: (lv) => ({ luck: lv }) },
  { id: "gift", name: "ママのおみやげ", desc: "最初からレリックを1つ持って始まる", max: 1, cost: () => 40, bonus: () => ({}) },
  { id: "fav", name: "おきにいりの箱", desc: "おきにいり枠 ＋1（クリアしたときに選んだ技を、次の冒険へ持っていける）", max: 4, cost: (lv) => 30 + lv * 30, bonus: () => ({}) },
];

/** 成長の合計効果。 */
export function metaBonus(lv: MetaLv): Part {
  const out: Part = {};
  for (const u of UPGRADES) for (const [k, v] of Object.entries(u.bonus(lv[u.id])) as [keyof Part, number][]) out[k] = v;
  return out;
}

/** 1回の冒険でもらえるにぼし（進んだ部屋・ボス・クリア × 難易度。呪い1つにつき＋15%）。 */
export function runReward(roomsCleared: number, bossesBeaten: number, win: boolean, diff: number, curses = 0): number {
  return Math.round((roomsCleared * 1 + bossesBeaten * 5 + (win ? 10 : 0)) * DIFFS[diff].reward * (1 + curses * 0.15));
}

/** locked: まだ解放していないもの（"spell:id" / "toy:id" / "relic:id"）。 */
/** endless: エンドレスモード（夏のあとも季節がめぐり続け、だんだん強くなる。ポイントでランキング）。 */
/** favorites: おきにいり（クリアしたときに選んだ技。最初から手持ちに入る）。 */
export interface RunOptions { difficulty: number; meta: MetaLv; locked?: string[]; endless?: boolean; favorites?: string[] }

/** おきにいり枠の数（はじめは1つ、おきにいりの箱で増える）。 */
export const favSlots = (m: MetaLv) => 1 + (m.fav ?? 0);
export const DEFAULT_RUN: RunOptions = { difficulty: 1, meta: NO_META };
