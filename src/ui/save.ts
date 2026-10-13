// 冒険の途中セーブ（部屋に入るたびに自動）。ブラウザに保存する（使えないときは保存なし）。
import { SEASON_NAME, SEASONS } from "../game/stage";
import { ROOMS_PER_ACT, type SaveData } from "../game/world";
import { DIFFS } from "../core/meta";

const KEY = "paper-cat-magic:run";

export function saveRun(d: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 保存できなくても遊べる */ }
}
export function loadRun(): SaveData | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "null") as SaveData | null;
    return d && d.v === 1 ? d : null;
  } catch { return null; }
}
export function clearRun() {
  try { localStorage.removeItem(KEY); } catch { /* なにもしない */ }
}

/** 「つづきから」に出す、どこまで進んだか。 */
export function runLabel(d: SaveData) {
  const where = d.at.final ? "さいご・ママ"
    : `${SEASON_NAME[SEASONS[d.at.act]]}・${d.at.index === ROOMS_PER_ACT ? "ボス" : `${d.at.index + 1}/${ROOMS_PER_ACT}部屋目`}`;
  return `${where}（${DIFFS[d.opts.difficulty].name}）`;
}
