// きろく（いちばん遠くまで進んだ部屋・守りきった回数）。ブラウザに保存する（使えないときは記録なし）。
import { ROOMS_PER_ACT } from "../game/world";
import { SEASON_NAME, SEASONS } from "../game/stage";
import { NO_META, UPGRADES, type MetaLv } from "../core/meta";
import { addStats, newlyOpen, NO_STATS, type Stats, type Unlock } from "../core/unlock";

/** きろく＋周回の育成（にぼしと、ねこの成長のレベル）。 */
export interface Record { best: number; wins: number; plays: number; niboshi: number; meta: MetaLv; cleared: number[]; stats: Stats }

const KEY = "paper-cat-magic:record";
const EMPTY: Record = { best: -1, wins: 0, plays: 0, niboshi: 0, meta: { ...NO_META }, cleared: [], stats: { ...NO_STATS } };

export function loadRecord(): Record {
  try {
    const r = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    r.meta = { ...NO_META, ...r.meta }; r.stats = { ...NO_STATS, ...r.stats }; return r;
  } catch { return { ...EMPTY, meta: { ...NO_META }, stats: { ...NO_STATS } }; }
}
const save = (r: Record) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* 保存できなくても遊べる */ } };

/** 悪夢は、むずかしいを守りきると選べる。 */
export const canPick = (r: Record, diff: number) => diff < 3 || r.cleared.includes(2);

/** ねこの成長を1段上げる（にぼしが足りなければ false）。 */
export function buyUpgrade(id: keyof MetaLv): boolean {
  const r = loadRecord(), u = UPGRADES.find((x) => x.id === id)!, lv = r.meta[id];
  if (lv >= u.max || r.niboshi < u.cost(lv)) return false;
  r.niboshi -= u.cost(lv); r.meta[id] = lv + 1; save(r); return true;
}

/**
 * 1回ぶんの冒険を記録する。進んだ位置は「季節×(部屋数+ボス)＋部屋番号」で比べる。
 * 負けても記録（倒した虫・片付けた部屋など）は積み上がり、新しく解放されたものを返す。
 */
export function recordRun(act: number, index: number, win: boolean, diff = 1, niboshi = 0, run: Partial<Stats> = {}): Unlock[] {
  const r = loadRecord(), before = r.stats;
  r.best = Math.max(r.best, act * (ROOMS_PER_ACT + 1) + index);
  r.plays++; if (win) { r.wins++; if (!r.cleared.includes(diff)) r.cleared.push(diff); }
  r.niboshi += niboshi;
  r.stats = addStats(before, { ...run, wins: win ? 1 : 0, bestAct: act });
  save(r);
  return newlyOpen(before, r.stats);
}

export function recordText(r: Record) {
  if (r.plays === 0) return "まだ記録はありません";
  const act = Math.floor(r.best / (ROOMS_PER_ACT + 1)), idx = r.best % (ROOMS_PER_ACT + 1);
  const where = `${SEASON_NAME[SEASONS[act]]}・${idx === ROOMS_PER_ACT ? "ボス" : `${idx + 1}部屋目`}`;
  return `いちばん遠く: <b>${where}</b> ／ 守りきった: <b>${r.wins}回</b> ／ 遊んだ: ${r.plays}回 ／ にぼし: <b>${r.niboshi}</b>`;
}
