// きろく（いちばん遠くまで進んだ部屋・守りきった回数）。ブラウザに保存する（使えないときは記録なし）。
import { ROOMS_PER_ACT } from "../game/world";
import { SEASON_NAME, SEASONS } from "../game/stage";

export interface Record { best: number; wins: number; plays: number }

const KEY = "paper-cat-magic:record";
const EMPTY: Record = { best: -1, wins: 0, plays: 0 };

export function loadRecord(): Record {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { ...EMPTY }; }
}

/** 1回ぶんの冒険を記録する。進んだ位置は「季節×(部屋数+ボス)＋部屋番号」で比べる。 */
export function recordRun(act: number, index: number, win: boolean) {
  const r = loadRecord();
  r.best = Math.max(r.best, act * (ROOMS_PER_ACT + 1) + index);
  r.plays++; if (win) r.wins++;
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* 保存できなくても遊べる */ }
}

export function recordText(r: Record) {
  if (r.plays === 0) return "まだ記録はありません";
  const act = Math.floor(r.best / (ROOMS_PER_ACT + 1)), idx = r.best % (ROOMS_PER_ACT + 1);
  const where = `${SEASON_NAME[SEASONS[act]]}・${idx === ROOMS_PER_ACT ? "ボス" : `${idx + 1}部屋目`}`;
  return `いちばん遠く: <b>${where}</b> ／ 守りきった: <b>${r.wins}回</b> ／ 遊んだ: ${r.plays}回`;
}
