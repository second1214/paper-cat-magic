// 呪い（あやしい箱で、強いごほうびと引きかえに受ける。その冒険のあいだずっと続く）。DOM 非依存。
import type { Part } from "./items";
import { L } from "../i18n";

export interface CurseDef { id: string; name: string; desc: string; bonus?: Part }

export const CURSES: Record<string, CurseDef> = {
  katai: { id: "katai", name: L("虫がかたい", "Tough Bugs"), desc: L("虫の体力 ＋25%", "Bug HP ＋25%") },
  sekkachi: { id: "sekkachi", name: L("虫がせっかち", "Hasty Bugs"), desc: L("虫の速さ ＋12%", "Bug speed ＋12%") },
  tsuyoi: { id: "tsuyoi", name: L("強い虫がよく出る", "More Elites"), desc: L("強い虫（光っている虫）が出やすい", "Elite bugs (glowing ones) appear more") },
  mure: { id: "mure", name: L("虫の群れ", "Bug Swarm"), desc: L("1回に出てくる虫 ＋1匹", "＋1 bug per wave") },
  neage: { id: "neage", name: L("ママがきびしい", "Strict Mama"), desc: L("ママのところでカリカリが1.5倍いる", "Mama's Repair Corner costs 1.5x kibble") },
  nemui: { id: "nemui", name: L("ねむい", "Sleepy"), desc: L("やる気の回復 −15%", "Energy Regen −15%"), bonus: { regenMul: 0.85 } },
  kaze: { id: "kaze", name: L("かぜぎみ", "Sniffles"), desc: L("最大HP −♥1", "Max HP −♥1"), bonus: { maxHp: -2 } },
};
export const CURSE_IDS = Object.keys(CURSES);

/** 呪いの効果のうち、ボーナスで表せる分の合計。 */
export function curseBonus(ids: string[]): Part[] {
  return ids.map((id) => CURSES[id].bonus).filter((b): b is Part => !!b);
}
