// 冒険の途中セーブ（部屋に入るたびに自動）。ブラウザに保存する（使えないときは保存なし）。
import { SEASON_NAME, SEASONS } from "../game/stage";
import { ROOMS_PER_ACT, type SaveData } from "../game/world";
import { DIFFS } from "../core/meta";
import { store } from "../platform";
import { L } from "../i18n";

const KEY = "paper-cat-magic:run";

export function saveRun(d: SaveData) {
  store.set(KEY, JSON.stringify(d));
}
export function loadRun(): SaveData | null {
  try {
    const d = JSON.parse(store.get(KEY) ?? "null") as SaveData | null;
    return d && d.v === 1 ? d : null;
  } catch { return null; }
}
export function clearRun() {
  store.remove(KEY);
}

/** 「つづきから」に出す、どこまで進んだか。 */
export function runLabel(d: SaveData) {
  const year = d.at.final ? 0 : Math.floor(d.at.act / SEASONS.length);
  const where = d.at.final ? L("さいご・ママ", "Final · Mama")
    : L(`${year ? `${year + 1}年目の` : ""}${SEASON_NAME[SEASONS[d.at.act % SEASONS.length]]}・${d.at.index === ROOMS_PER_ACT ? "ボス" : `${d.at.index + 1}/${ROOMS_PER_ACT}部屋目`}`,
      `${year ? `Year ${year + 1} ` : ""}${SEASON_NAME[SEASONS[d.at.act % SEASONS.length]]} · ${d.at.index === ROOMS_PER_ACT ? "Boss" : `Room ${d.at.index + 1}/${ROOMS_PER_ACT}`}`);
  return L(`${where}（${d.opts.endless ? "エンドレス" : DIFFS[d.opts.difficulty].name}）`, `${where} (${d.opts.endless ? "Endless" : DIFFS[d.opts.difficulty].name})`);
}
