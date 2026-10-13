// 呪い（あやしい箱で、強いごほうびと引きかえに受ける。その冒険のあいだずっと続く）。DOM 非依存。
import type { Part } from "./items";

export interface CurseDef { id: string; name: string; desc: string; bonus?: Part }

export const CURSES: Record<string, CurseDef> = {
  katai: { id: "katai", name: "虫がかたい", desc: "虫の体力 ＋25%" },
  sekkachi: { id: "sekkachi", name: "虫がせっかち", desc: "虫の速さ ＋12%" },
  tsuyoi: { id: "tsuyoi", name: "強い虫がよく出る", desc: "強い虫（光っている虫）が出やすい" },
  mure: { id: "mure", name: "虫の群れ", desc: "1回に出てくる虫 ＋1匹" },
  neage: { id: "neage", name: "お店の値上げ", desc: "お店の値段 ×1.5" },
  nemui: { id: "nemui", name: "ねむい", desc: "やる気の回復 −15%", bonus: { regenMul: 0.85 } },
  kaze: { id: "kaze", name: "かぜぎみ", desc: "最大HP −♥1", bonus: { maxHp: -2 } },
};
export const CURSE_IDS = Object.keys(CURSES);

/** 呪いの効果のうち、ボーナスで表せる分の合計。 */
export function curseBonus(ids: string[]): Part[] {
  return ids.map((id) => CURSES[id].bonus).filter((b): b is Part => !!b);
}
