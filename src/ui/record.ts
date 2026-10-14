// きろく（いちばん遠くまで進んだ部屋・守りきった回数）。ブラウザに保存する（使えないときは記録なし）。
import { ROOMS_PER_ACT } from "../game/world";
import { SEASON_NAME, SEASONS } from "../game/stage";
import { NO_META, UPGRADES, type MetaLv } from "../core/meta";
import { addStats, newlyOpen, NO_STATS, type Stats, type Unlock } from "../core/unlock";
import type { Entry } from "../core/score";
import { store } from "../platform";
import { L } from "../i18n";

/** じぶんのエンドレスの記録（上位10回）。 */
export interface LocalScore extends Entry { at: number; act: number }

/** きろく＋周回の育成（にぼしと、ねこの成長のレベル）。 */
export interface Record { best: number; wins: number; plays: number; niboshi: number; meta: MetaLv; cleared: number[]; stats: Stats; endless: LocalScore[]; favorites: string[] }

const KEY = "paper-cat-magic:record";
const EMPTY: Record = { best: -1, wins: 0, plays: 0, niboshi: 0, meta: { ...NO_META }, cleared: [], stats: { ...NO_STATS }, endless: [], favorites: [] };

export function loadRecord(): Record {
  try {
    const r = { ...EMPTY, ...JSON.parse(store.get(KEY) ?? "{}") };
    r.meta = { ...NO_META, ...r.meta }; r.stats = { ...NO_STATS, ...r.stats }; r.endless = Array.isArray(r.endless) ? r.endless : [];
    r.favorites = Array.isArray(r.favorites) ? r.favorites : []; return r;
  } catch { return { ...EMPTY, meta: { ...NO_META }, stats: { ...NO_STATS }, endless: [], favorites: [] }; }
}
const save = (r: Record) => store.set(KEY, JSON.stringify(r));

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
export function recordRun(act: number, index: number, win: boolean, diff = 1, niboshi = 0, run: Partial<Stats> = {}, endless = false): Unlock[] {
  const r = loadRecord(), before = r.stats;
  if (!endless) r.best = Math.max(r.best, act * (ROOMS_PER_ACT + 1) + index);   // エンドレスは「いちばん遠く」に入れない
  r.plays++; if (win) { r.wins++; if (!r.cleared.includes(diff)) r.cleared.push(diff); }
  r.niboshi += niboshi;
  r.stats = addStats(before, { ...run, wins: win ? 1 : 0, bestAct: Math.min(act, SEASONS.length - 1) });
  save(r);
  return newlyOpen(before, r.stats);
}

/** にぼしを足す（広告のごほうび）。 */
export function addNiboshi(n: number) { const r = loadRecord(); r.niboshi += n; save(r); }

/** エンドレスの記録を残す。何位に入ったか（1〜10、圏外は 0）を返す。 */
export function recordEndless(e: LocalScore): number {
  const r = loadRecord();
  r.endless = [...r.endless, e].sort((a, b) => b.score - a.score).slice(0, 10);
  save(r);
  return r.endless.indexOf(e) + 1;
}

/** おきにいり（クリアしたときに選んだ技。次からの冒険で最初から手持ちに入る）。 */
export function setFavorites(ids: string[]) { const r = loadRecord(); r.favorites = ids; save(r); }

/** あとから名前を入れたエンドレスの記録に、名前をつける。 */
export function nameEndless(at: number, name: string) {
  const r = loadRecord(), e = r.endless.find((x) => x.at === at);
  if (e) { e.name = name; save(r); }
}

export function recordText(r: Record) {
  if (r.plays === 0) return L("まだ記録はありません", "No records yet");
  const act = Math.floor(r.best / (ROOMS_PER_ACT + 1)), idx = r.best % (ROOMS_PER_ACT + 1);
  const where = L(`${SEASON_NAME[SEASONS[act]]}・${idx === ROOMS_PER_ACT ? "ボス" : `${idx + 1}部屋目`}`,
    `${SEASON_NAME[SEASONS[act]]} · ${idx === ROOMS_PER_ACT ? "Boss" : `Room ${idx + 1}`}`);
  return L(`いちばん遠く: <b>${where}</b> ／ 守りきった: <b>${r.wins}回</b> ／ 遊んだ: ${r.plays}回 ／ にぼし: <b>${r.niboshi}</b>`,
    `Farthest: <b>${where}</b> / Wins: <b>${r.wins}</b> / Plays: ${r.plays} / Sardines: <b>${r.niboshi}</b>`);
}
